#!/usr/bin/env python3
"""Compose the maintained portfolio generators into a fresh output tree.

The source checkout contains both generated pages and separately maintained
applications and inputs. Only declared inputs enter the temporary build; the
generated project pages and build manifest are recreated by their generators.
"""
from __future__ import annotations

import argparse
import hashlib
import json
import os
from pathlib import Path, PurePosixPath
import shutil
import subprocess
import sys
import tempfile


PRESERVED_APPS = ("brain", "forge", "wildside")


def regular_file(root: Path, relative: str) -> Path:
    parts = PurePosixPath(relative)
    if (not relative or "\\" in relative or parts.is_absolute()
            or any(part in (".", "..") for part in relative.split("/"))
            or "" in relative.split("/")):
        raise ValueError(f"Invalid input path: {relative}")
    path = root
    for part in parts.parts:
        path /= part
        if path.is_symlink():
            raise ValueError(f"Symlinked input: {relative}")
    if not path.is_file() or not path.resolve().is_relative_to(root):
        raise ValueError(f"Missing or escaped input: {relative}")
    return path


def read_inputs(path: Path) -> dict:
    data = json.loads(path.read_text(encoding="utf-8"))
    if (not isinstance(data, dict)
            or set(data) != {"schema", "authored_files", "media_files"}
            or data["schema"] != 1):
        raise ValueError("Unexpected current-site input inventory")
    authored = data["authored_files"]
    media = data["media_files"]
    if (not isinstance(authored, list) or any(not isinstance(p, str) for p in authored)
            or authored != sorted(set(authored)) or not isinstance(media, list)):
        raise ValueError("Invalid authored input inventory")
    for entry in media:
        if (not isinstance(entry, dict) or set(entry) != {"path", "bytes", "sha256"}
                or not isinstance(entry["path"], str)
                or type(entry["bytes"]) is not int or entry["bytes"] < 0
                or not isinstance(entry["sha256"], str)
                or len(entry["sha256"]) != 64
                or any(c not in "0123456789abcdef" for c in entry["sha256"])):
            raise ValueError("Invalid media input declaration")
    media_paths = [entry["path"] for entry in media]
    if media_paths != sorted(set(media_paths)) or set(authored) & set(media_paths):
        raise ValueError("Repeated current-site input")
    return data


def rebuild(source_tree: Path, output: Path, inventory: Path, *, preview: bool = False) -> dict:
    root = source_tree.resolve()
    output = output.absolute()
    if output.exists() or output.is_symlink():
        raise ValueError("Output must be a new directory")
    if output.resolve().is_relative_to(root) or root.is_relative_to(output.resolve()):
        raise ValueError("Output must be outside the input checkout")
    inputs = read_inputs(inventory)
    docs_source = root / "docs"
    if docs_source.is_symlink() or not docs_source.is_dir():
        raise ValueError("Missing or symlinked maintained application inputs")
    for entry in inputs["media_files"]:
        raw = regular_file(docs_source, entry["path"]).read_bytes()
        if len(raw) != entry["bytes"] or hashlib.sha256(raw).hexdigest() != entry["sha256"]:
            raise ValueError(f"Current-site media differs: {entry['path']}")
    for name in inputs["authored_files"]:
        regular_file(docs_source, name)
    for name in ("source/build.py", "tools/site/make-brain.mjs", "tools/site/build.mjs",
                 "tools/site/demo-videos.json"):
        regular_file(root, name)

    output.parent.mkdir(parents=True, exist_ok=True)
    with tempfile.TemporaryDirectory(prefix="portfolio-build-", dir=output.parent) as temporary:
        work = Path(temporary)
        docs = work / "docs"
        docs.mkdir()
        for app in PRESERVED_APPS:
            source = docs_source / app
            if source.is_symlink() or not source.is_dir():
                raise ValueError(f"Missing or symlinked maintained application: {app}")
            shutil.copytree(source, docs / app, symlinks=True)

        command = [sys.executable, str(root / "source/build.py"), "--out", str(docs)]
        if preview:
            command.append("--preview")
        subprocess.run(command, cwd=root, check=True)

        for name in inputs["authored_files"] + [entry["path"] for entry in inputs["media_files"]]:
            target = docs / name
            if target.exists() or target.is_symlink():
                raise ValueError(f"Declared input overlaps generated output: {name}")
            target.parent.mkdir(parents=True, exist_ok=True)
            shutil.copy2(regular_file(docs_source, name), target)
        tool_data = work / "tools/site"
        tool_data.mkdir(parents=True)
        shutil.copy2(root / "tools/site/demo-videos.json", tool_data / "demo-videos.json")
        for script in ("make-brain.mjs", "build.mjs"):
            subprocess.run(["node", str(root / "tools/site" / script)], cwd=work, check=True)

        if (docs / "index.html").read_bytes() != (docs / "brain/index.html").read_bytes():
            raise ValueError("Brain home and compatibility route differ")
        manifest = json.loads((docs / "build-manifest.json").read_text(encoding="utf-8"))
        result = {"output": str(output), "publication": manifest["publication"],
                  "files": sum(p.is_file() for p in docs.rglob("*")),
                  "declared_inputs": len(inputs["authored_files"]) + len(inputs["media_files"])}
        os.rename(docs, output)
        return result


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--source-tree", type=Path, default=Path(__file__).resolve().parents[2])
    parser.add_argument("--out", type=Path, required=True)
    parser.add_argument("--inputs", type=Path, default=Path(__file__).with_name("current-inputs.json"))
    parser.add_argument("--preview", action="store_true")
    args = parser.parse_args()
    print(json.dumps(rebuild(args.source_tree, args.out, args.inputs, preview=args.preview), indent=2))
