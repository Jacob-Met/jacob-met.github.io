"""Readers can open the exact captured screen without following a live-demo link."""
import copy
import json
import tempfile
import unittest
from html.parser import HTMLParser
from pathlib import Path

import build
from check import check


class Links(HTMLParser):
    def __init__(self, markup):
        super().__init__()
        self.links = []
        self.current = None
        self.feed(markup)

    def handle_starttag(self, tag, attrs):
        if tag == "a":
            self.current = {"attrs": dict(attrs), "text": ""}
            self.links.append(self.current)

    def handle_data(self, data):
        if self.current is not None:
            self.current["text"] += data

    def handle_endtag(self, tag):
        if tag == "a":
            self.current = None


class ScreenshotAccess(unittest.TestCase):
    def check_access(self, record):
        with tempfile.TemporaryDirectory() as temp:
            out = Path(temp) / "site"
            build.build(out, record)
            markup = (out / "index.html").read_text(encoding="utf-8")
            links = Links(markup).links
            shots = [a for a in links if "screenshot-link" in a["attrs"].get("class", "").split()]
            expected = [
                (demo, device, demo["shots"][key])
                for demo in record["demos"]
                for key, device in (("desktop", "desktop"), ("mobile", "phone"))
            ]
            self.assertEqual(len(shots), len(expected), "Every captured screen needs a visible full-image link")
            for link, (demo, device, shot) in zip(shots, expected):
                with self.subTest(demo=demo["id"], device=device):
                    self.assertEqual(link["text"], device.title())
                    self.assertEqual(link["attrs"]["aria-label"], f"{demo['name']}: full {device} screenshot")
                    self.assertEqual(link["attrs"]["href"], shot["src"])
                    self.assertNotIn("download", link["attrs"])
                    self.assertNotIn("target", link["attrs"])
                    self.assertEqual((out / shot["src"]).read_bytes(), (build.ROOT / shot["src"]).read_bytes())
            for demo in record["demos"]:
                self.assertIn(demo["play"]["url"], [a["attrs"]["href"] for a in links])
                self.assertIn(demo["repo"], [a["attrs"]["href"] for a in links])
            self.assertEqual(json.loads((out / "cv.json").read_text(encoding="utf-8")), record)
            self.assertTrue(check(out)["passed"])

    def test_all_screens_open_exact_local_assets_and_keep_live_actions(self):
        self.check_access(json.loads((build.ROOT / "content.json").read_text(encoding="utf-8")))

    def test_labels_and_destinations_follow_changed_approved_content(self):
        record = json.loads((build.ROOT / "content.json").read_text(encoding="utf-8"))
        record["demos"][0]["name"] = 'Reader & "review"'
        record["demos"][0]["shots"] = copy.deepcopy(record["demos"][1]["shots"])
        record["demos"].reverse()
        self.check_access(record)


if __name__ == "__main__":
    unittest.main()
