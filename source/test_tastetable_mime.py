"""Verify real studio JavaScript over local HTTP, including the release CLI."""
import functools
import json
import subprocess
import sys
import tempfile
import threading
import unittest
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path

import build
from verify_deployment import verify


JAVASCRIPT_PATHS = ('tastetable/app.mjs', 'tastetable/calendar.js')


class TasteTableMimeTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.root = Path(self.temp.name) / 'site'
        build.build(self.root)
        self.file_count = sum(path.is_file() for path in self.root.rglob('*'))
        for name in JAVASCRIPT_PATHS:
            self.assertTrue((self.root / name).is_file(), name)
        self.deliveries = []

        class Handler(SimpleHTTPRequestHandler):
            content_types = {}

            def log_message(self, *args):
                pass

            def send_header(self, keyword, value):
                if keyword.lower() == 'content-type' and self.path in self.content_types:
                    value = self.content_types[self.path]
                    if value is None:
                        return  # Actually omit the header, preserving the file body.
                super().send_header(keyword, value)

        self.handler = Handler
        self.server = ThreadingHTTPServer(
            ('127.0.0.1', 0), functools.partial(Handler, directory=str(self.root)))
        self.thread = threading.Thread(target=self.server.serve_forever, daemon=True)
        self.thread.start()
        self.addCleanup(self.close)
        self.base = f'http://127.0.0.1:{self.server.server_port}'

    def close(self):
        self.server.shutdown()
        self.server.server_close()
        self.thread.join(timeout=3)

    def delivery(self, content_type):
        self.handler.content_types = {'/' + name: content_type for name in JAVASCRIPT_PATHS}
        result = verify(self.root, self.base)
        self.deliveries.append({'content_type': content_type, 'result': result})
        self.assertTrue(result['local_check']['passed'], result)
        self.assertEqual(result['network_requests'], self.file_count)
        self.assertTrue(all(item.get('bytes_match') for item in result['files']), result)
        return result

    def test_browser_javascript_types_are_accepted(self):
        for content_type in (
                'text/javascript; charset=utf-8',
                'APPLICATION/JAVASCRIPT; charset=UTF-8',
                'text/javascript1.5'):
            with self.subTest(content_type=content_type):
                result = self.delivery(content_type)
                self.assertTrue(result['passed'], result)
                for item in result['files']:
                    if item['path'] in JAVASCRIPT_PATHS:
                        self.assertEqual(item['status'], 200)
                        self.assertTrue(item['mime_match'], item)

    def test_non_javascript_types_are_refused(self):
        for content_type in (
                'text/plain', 'application/octet-stream', 'text/html',
                'text/javascript1.6', None):
            with self.subTest(content_type=content_type):
                result = self.delivery(content_type)
                self.assertFalse(result['passed'], result)
                failures = {item['path'] for item in result['files'] if not item['passed']}
                self.assertEqual(failures, set(JAVASCRIPT_PATHS))
                for item in result['files']:
                    if item['path'] in JAVASCRIPT_PATHS:
                        self.assertEqual(item['status'], 200)
                        self.assertFalse(item['mime_match'], item)

    def test_cli_records_and_refuses_a_wrong_module_type(self):
        self.handler.content_types = {'/tastetable/app.mjs': 'text/plain'}
        receipt_path = Path(self.temp.name) / 'delivery.json'
        command = [
            sys.executable, str(Path(__file__).with_name('verify_deployment.py')),
            '--root', str(self.root), '--base', self.base,
            '--receipt', str(receipt_path),
        ]
        completed = subprocess.run(command, text=True, capture_output=True, timeout=30)
        result = json.loads(receipt_path.read_text(encoding='utf-8'))
        self.cli_result = {
            'returncode': completed.returncode, 'stdout': completed.stdout,
            'stderr': completed.stderr, 'receipt': result,
        }
        self.assertEqual(completed.returncode, 1, self.cli_result)
        self.assertFalse(result['passed'], result)
        self.assertEqual(result['network_requests'], self.file_count)
        self.assertTrue(all(item.get('bytes_match') for item in result['files']), result)
        self.assertEqual(
            [item['path'] for item in result['files'] if not item['passed']],
            ['tastetable/app.mjs'])
        self.assertEqual(json.loads(completed.stdout)['failures'], ['tastetable/app.mjs'])


if __name__ == '__main__':
    unittest.main()
