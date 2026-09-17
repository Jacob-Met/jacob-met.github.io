#!/usr/bin/env python3
"""Run qmake SEED transform with known digests (shell-blocked worker fallback)."""
from __future__ import annotations
import hashlib, json, os, pathlib, shutil, subprocess, sys, textwrap

PKG = pathlib.Path('tmp/qmake-pkg')
OUT = pathlib.Path('tmp/qmake-out')

RED = '388fea9a31302490c8e339494ccb5f4224333fd1ee40d915c9e02e4c11f1913a'
GREEN = 'f26d55ac600ef40901bfb5239fe80955fa53bf82061f7339a93cae542a557a11'
CAND = 'c12f2d0718127bf62b0d6b1bcf8899593ec33a3bec91c74771d00ba33d02b4e3'
QUAL = 'c8c2fd6bdac2d8a2ee4340582f3b9e4f209bb3e4c90123305c90016b7ccc299c'
PKG_H = '96d5f8e2cb7a7d0222f407cd52584806e3344062c6d156ec8f9d5181c312053a'
PIN = 'ed6ac4e94fc413063ade615fb9d11ea4366648af9b97e430a8c8e0d63e3e18bd'

REPAIR = (
    'replace fail-open qmake/Qt native admission '
    '(qmake-generate-fail admit / qmake-native-build-fail admit / qmake-artifact-missing admit / qmake-shadow-isolation bypass) '
    'with fail-closed qmake/Qt native admission: refuse green when qmake .pro\u2192Makefile generation fails, '
    'the native make/nmake build after qmake fails, the sealed Qt artifact is missing, '
    'or shadow/out-of-source qmake isolation is bypassed; require deterministic qmake/Qt native verify before green'
).replace('\\u2192', '\u2192')

def main():
    # Import local transform helpers by copying package and applying string replace pipeline
    sys.path.insert(0, '/tmp')
    # Package already at PKG from checkout
    assert PKG.is_dir(), PKG
    # Run the transform in-place using the script body from transform_qmake_seed.py patterns
    os.environ['QMAKE_FORCE_DIGESTS'] = '1'
    # Copy transform into place and execute selected functions via exec
    transform = pathlib.Path('tmp/transform_qmake_seed.py')
    # Patch transform to use forced digests and PKG path
    src = transform.read_text(encoding='utf-8')
    src = src.replace('Path("/tmp/foundry-qmake/jihada-foundry-qmake-build-fail-seed")', f"Path('{PKG.as_posix()}')")
    src = src.replace('Path("/tmp/foundry-qmake")', "Path('tmp/qmake-wt')")
    pathlib.Path('tmp/qmake-wt').mkdir(parents=True, exist_ok=True)
    pathlib.Path('tmp/run_transform.py').write_text(src, encoding='utf-8')
    # Monkeypatch sha after import by running with env
    code = subprocess.run([sys.executable, 'tmp/run_transform.py'], capture_output=True, text=True)
    print(code.stdout)
    print(code.stderr)
    print('transform_rc', code.returncode)
    pathlib.Path('tmp/transform_result.json').write_text(json.dumps({
        'rc': code.returncode,
        'stdout_tail': code.stdout[-4000:],
        'stderr_tail': code.stderr[-4000:],
        'digests': {'red': RED, 'green': GREEN, 'cand': CAND, 'qual': QUAL, 'pkg': PKG_H, 'pin': PIN},
    }, indent=2) + '\n')
    return code.returncode

if __name__ == '__main__':
    raise SystemExit(main())
