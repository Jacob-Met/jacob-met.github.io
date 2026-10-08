"""Admit only the pinned TasteTable recording studio at the declared route.

This is an immutable upstream copy, not a general permission for site applications.
The portfolio pages retain their existing HTML, CSS and CSP policy.
"""
from __future__ import annotations
import hashlib
import json
from pathlib import Path, PurePosixPath

DIRECTORY = 'tastetable'
MANIFEST_SHA256 = '0d26c1c54a376282d6b8778b32a3880c49b4be5c7ad08d5afffb6b096ea6c982'


def manifest_entries() -> dict[str, dict]:
    raw = Path(__file__).with_name('tastetable-manifest.json').read_bytes()
    if hashlib.sha256(raw).hexdigest() != MANIFEST_SHA256:
        raise ValueError('TasteTable provenance manifest differs from the reviewed pin')
    record = json.loads(raw)
    return {item['path']: item for item in record['files']}


def directories(names) -> set[str]:
    return {parent.as_posix() for name in names
            for parent in PurePosixPath(name).parents if parent.as_posix() != '.'}


def read_files(root: Path) -> dict[str, bytes]:
    """Read the complete, regular-file-only, exact-byte application inventory."""
    entries = manifest_entries()
    if root.is_symlink() or not root.is_dir():
        raise ValueError('TasteTable directory is missing or is a symlink')
    files = {}
    actual_dirs = set()
    for path in sorted(root.rglob('*')):
        name = path.relative_to(root).as_posix()
        if path.is_symlink():
            raise ValueError(f'TasteTable symlink refused: {name}')
        if path.is_dir():
            actual_dirs.add(name)
        elif path.is_file():
            if name not in entries:
                raise ValueError(f'TasteTable file outside pinned inventory: {name}')
            expected = entries[name]
            if path.stat().st_size != expected['bytes']:
                raise ValueError(f'TasteTable size differs: {name}')
            raw = path.read_bytes()
            if len(raw) != expected['bytes'] or hashlib.sha256(raw).hexdigest() != expected['sha256']:
                raise ValueError(f'TasteTable bytes differ: {name}')
            files[name] = raw
        else:
            raise ValueError(f'TasteTable entry is not a regular file or directory: {name}')
    if set(files) != set(entries):
        raise ValueError('TasteTable pinned inventory is incomplete')
    if actual_dirs != directories(entries):
        raise ValueError('TasteTable directories differ from pinned inventory')
    return files
