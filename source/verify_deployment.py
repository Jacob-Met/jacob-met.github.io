"""Compare a declared static deployment with a checked local build.

Run explicitly; never modifies the host. No browser session or credentials.
Only local HTTP fixtures and HTTPS origins are accepted; redirects are reported.
"""
from __future__ import annotations
import argparse
import hashlib
import json
import time
from datetime import datetime, timezone
from pathlib import Path
from urllib.error import HTTPError, URLError
from urllib.parse import quote, urlsplit
from urllib.request import HTTPRedirectHandler, Request, build_opener
from check import check


class NoRedirect(HTTPRedirectHandler):
    def redirect_request(self, req, fp, code, msg, headers, newurl):
        return None


def validate_base(base: str) -> str:
    u = urlsplit(base)
    local = u.hostname in {'localhost', '127.0.0.1', '::1'}
    if (u.username or u.password or u.query or u.fragment or not u.hostname
            or not (u.scheme == 'https' or (u.scheme == 'http' and local))):
        raise ValueError('Expected credential-free HTTPS base or local HTTP fixture')
    return base.rstrip('/')+'/'

def verify(root: Path, base: str, timeout: float = 15) -> dict:
    base = validate_base(base)
    root = root.resolve()
    local = check(root)
    if not local['passed']:
        return {'passed': False, 'local_check': local, 'files': [], 'network_requests': 0}
    opener = build_opener(NoRedirect())
    started = time.monotonic()
    files = []
    expected_files = sorted(p for p in root.rglob('*') if p.is_file())
    for path in expected_files:
        name = path.relative_to(root).as_posix()
        expected = path.read_bytes()
        item = {'path': name, 'expected_sha256': hashlib.sha256(expected).hexdigest()}
        request = Request(base+quote(name, safe='/'), headers={
            'User-Agent': 'Static-site release verification',
            'Accept-Encoding': 'identity', 'Cache-Control': 'no-cache'})
        try:
            with opener.open(request, timeout=timeout) as response:
                actual = response.read(len(expected)+1)
                mime = response.headers.get_content_type()
                wanted = {'.html': 'text/html', '.css': 'text/css', '.svg': 'image/svg+xml',
                          '.webp': 'image/webp'}.get(path.suffix)
                item.update(status=response.status, received_bytes=len(actual), mime=mime,
                            actual_sha256=hashlib.sha256(actual).hexdigest(),
                            bytes_match=actual == expected, mime_match=not wanted or mime == wanted)
                item['passed'] = response.status == 200 and item['bytes_match'] and item['mime_match']
        except HTTPError as error:
            item.update(passed=False, status=error.code, error='http_error')
        except (URLError, OSError, TimeoutError) as error:
            item.update(passed=False, error=type(error).__name__)
        files.append(item)
    return {'at_utc': datetime.now(timezone.utc).isoformat(), 'base_url': base,
            'passed': all(f['passed'] for f in files), 'files': files,
            'network_requests': len(files), 'elapsed_seconds': round(time.monotonic()-started, 3),
            'local_check': local, 'scope': 'Exact bytes and MIME types; not audience or functional acceptance.'}


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--root', required=True, type=Path)
    parser.add_argument('--base', required=True)
    parser.add_argument('--receipt', required=True, type=Path)
    args = parser.parse_args()
    if args.receipt.exists(): parser.error('Receipt already exists; preserve prior evidence')
    result = verify(args.root, args.base)
    args.receipt.parent.mkdir(parents=True, exist_ok=True)
    with args.receipt.open('x', encoding='utf-8', newline='\n') as stream:
        json.dump(result, stream, indent=2)
        stream.write('\n')
    print(json.dumps({'passed': result['passed'], 'files': len(result['files']),
                      'failures': [f['path'] for f in result['files'] if not f['passed']]}))
    raise SystemExit(0 if result['passed'] else 1)


if __name__ == '__main__': main()
