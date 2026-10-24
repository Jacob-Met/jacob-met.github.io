"""Keep private evidence ledgers and unreviewed files out of the source candidate."""
from __future__ import annotations
import json
import re
from pathlib import Path, PurePosixPath

SOURCE_POLICY_FILE = 'source-allowlist.json'
PRIVATE_LEDGER_KEYS = {'internalevidence', 'privateevidence', 'rawevidence', 'privaterepo', 'privatesourceurl'}


def reject_private_ledgers(value):
    if isinstance(value, dict):
        for key, item in value.items():
            if re.sub('[^a-z]', '', key.lower()) in PRIVATE_LEDGER_KEYS:
                raise ValueError('Private evidence ledger cannot enter the source publication candidate')
            reject_private_ledgers(item)
    elif isinstance(value, list):
        for item in value: reject_private_ledgers(item)


def validate_source_publication(root: Path) -> None:
    policy_path = root / SOURCE_POLICY_FILE
    if policy_path.is_symlink(): raise ValueError('Source allowlist cannot be a symlink')
    policy = json.loads(policy_path.read_text(encoding='utf-8'))
    if not isinstance(policy, dict) or set(policy) != {'schema', 'files'} or policy['schema'] != 1:
        raise ValueError('Malformed source publication allowlist')
    files = policy['files']
    if (not isinstance(files, list) or any(not isinstance(name, str) or not name or '\\' in name
            or name.startswith('/') or '..' in PurePosixPath(name).parts for name in files)
            or files != sorted(set(files)) or SOURCE_POLICY_FILE not in files):
        raise ValueError('Unsafe or duplicate source publication path')
    actual = set()
    for path in root.rglob('*'):
        relative = path.relative_to(root)
        if '__pycache__' in relative.parts: continue
        if path.is_symlink(): raise ValueError('Source publication candidate cannot contain symlinks')
        if not path.is_file(): continue
        actual.add(relative.as_posix())
        if path.suffix == '.json': reject_private_ledgers(json.loads(path.read_text(encoding='utf-8')))
    if actual != set(files):
        raise ValueError('Source files differ from explicit publication inventory: ' +
                         ', '.join(sorted(actual ^ set(files))))
