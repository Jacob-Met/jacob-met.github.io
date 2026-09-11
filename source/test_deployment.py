"""Local HTTP integration tests; no request to the public host."""
import functools
import json
import tempfile
import threading
import unittest
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from unittest.mock import patch
import build
from verify_deployment import verify, validate_base


class DeploymentTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.root = Path(self.temp.name)/'site'
        build.build(self.root)
        class Handler(SimpleHTTPRequestHandler):
            mode = 'normal'
            extensions_map = {**SimpleHTTPRequestHandler.extensions_map, '.webp': 'image/webp'}
            def log_message(self, *args): pass
            def do_GET(self):
                if self.path == '/index.html' and self.mode == 'redirect':
                    self.send_response(302); self.send_header('Location', '/about.html'); self.end_headers(); return
                if self.path == '/index.html' and self.mode == 'missing':
                    self.send_error(404); return
                return super().do_GET()
            def guess_type(self, path):
                if path.endswith('index.html') and self.mode == 'wrong_mime': return 'text/plain'
                return super().guess_type(path)
        import shutil
        self.served = Path(self.temp.name)/'served'
        shutil.copytree(self.root, self.served)
        self.handler = Handler
        self.server = ThreadingHTTPServer(('127.0.0.1', 0), functools.partial(Handler, directory=str(self.served)))
        self.thread = threading.Thread(target=self.server.serve_forever, daemon=True)
        self.thread.start()
        self.addCleanup(self.close_server)
        self.base = f'http://127.0.0.1:{self.server.server_port}'

    def close_server(self):
        self.server.shutdown(); self.server.server_close(); self.thread.join(timeout=3)

    def test_all_expected_files_match(self):
        result = verify(self.root, self.base)
        self.assertTrue(result['passed'], result)
        self.assertEqual(len(result['files']), 21)
        self.assertEqual((self.root/'CNAME').read_text(encoding='utf-8'), 'jacobmetoyer.com\n')

    def test_server_drift_is_not_success(self):
        with (self.served/'index.html').open('a', encoding='utf-8') as f: f.write('STALE')
        result = verify(self.root, self.base)
        self.assertFalse(result['passed'])
        self.assertFalse(next(f for f in result['files'] if f['path']=='index.html')['bytes_match'])
    def test_redirect_missing_and_wrong_mime_are_distinct_failures(self):
        for mode, status in [('redirect',302), ('missing',404), ('wrong_mime',200)]:
            with self.subTest(mode=mode):
                self.handler.mode = mode
                result = verify(self.root, self.base)
                item = next(f for f in result['files'] if f['path']=='index.html')
                self.assertFalse(result['passed'])
                self.assertEqual(item['status'], status)
                if mode == 'wrong_mime': self.assertFalse(item['mime_match'])

    def test_invalid_local_build_sends_nothing(self):
        (self.root/'build-manifest.json').write_text('{}', encoding='utf-8')
        result = verify(self.root, self.base)
        self.assertFalse(result['passed'])
        self.assertEqual(result['network_requests'], 0)

    def test_base_credentials_and_remote_plaintext_rejected(self):
        for base in ['http://example.invalid', 'https://u:p@example.invalid',
                     'https://example.invalid?token=x', 'https://example.invalid#x']:
            with self.subTest(base=base), self.assertRaises(ValueError): validate_base(base)


if __name__ == '__main__': unittest.main()
