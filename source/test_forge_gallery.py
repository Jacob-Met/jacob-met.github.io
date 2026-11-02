"""The separately maintained /forge/ walk keeps every original image inspectable."""
from html.parser import HTMLParser
from pathlib import Path
from urllib.parse import urlsplit
import unittest

GALLERY = Path(__file__).resolve().parents[1] / "docs" / "forge" / "index.html"
STOPS = {"approach": "approach", "yard": "yard", "threshold": "threshold", "inside": "doorway", "hearth": "hearth"}


class Parse(HTMLParser):
    def __init__(self, html):
        super().__init__(convert_charrefs=True)
        self.figures = []
        self.routes = []
        self.inspections = []
        self.images = []
        self.in_route = False
        self.feed(html)

    def handle_starttag(self, tag, attrs):
        a = dict(attrs)
        if tag == "nav" and a.get("aria-label") == "Forge views":
            self.in_route = True
        if tag == "figure":
            self.figures.append(a.get("id"))
        if tag == "img":
            self.images.append(a.get("src"))
        if tag == "a":
            if self.in_route:
                self.routes.append(a.get("href"))
            if "inspect" in (a.get("class") or "").split():
                self.inspections.append(a)

    def handle_endtag(self, tag):
        if tag == "nav":
            self.in_route = False


def verify(html):
    p = Parse(html)
    assert p.figures == list(STOPS), f"chapter IDs differ: {p.figures!r}"
    assert p.routes == ["#" + stop for stop in STOPS], f"chapter order differs: {p.routes!r}"
    assert p.images == [f"media/kajiba-{stem}-1920.webp" for stem in STOPS.values()]
    assert len(p.inspections) == 5, f"missing native render links: {len(p.inspections)}"
    for image, link in zip(p.images, p.inspections):
        assert link.get("href") == image, f"nonmatching render destination: {link!r}"
        assert link.get("aria-label", "").startswith("Open full 1920-pixel render of ")
        assert not urlsplit(link["href"]).scheme
    return p


class ForgeGalleryTests(unittest.TestCase):
    def test_all_five_viewpoints_remain_linked(self):
        verify(GALLERY.read_text())

    def test_missing_inspection_is_caught(self):
        text = GALLERY.read_text().replace('class="inspect"', 'class="not-inspect"', 1)
        with self.assertRaises(AssertionError):
            verify(text)

    def test_misrouted_image_is_caught(self):
        text = GALLERY.read_text().replace('class="inspect" href="media/kajiba-yard-1920.webp"', 'class="inspect" href="media/kajiba-hearth-1920.webp"')
        with self.assertRaises(AssertionError):
            verify(text)

    def test_missing_stop_is_caught(self):
        text = GALLERY.read_text().replace('id="inside"', 'id="wrong"')
        with self.assertRaises(AssertionError):
            verify(text)


if __name__ == "__main__":
    unittest.main()
