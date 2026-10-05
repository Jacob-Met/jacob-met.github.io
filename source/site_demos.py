"""Validated, static renderers for the browser demo gallery and first Bid Inbox route."""
from __future__ import annotations

import html
import json
import re
from datetime import date

DATE_RE = re.compile(r"\d{4}-\d{2}-\d{2}")
ID_RE = re.compile(r"bid-[0-9]{3}")
REFERENCE_RE = re.compile(r"BID-[0-9]{3}")
STAGES = {"review": "Review", "hold": "Hold", "ready": "Index complete"}
REQUIRED_RECORD_FIELDS = {
    "id", "reference", "project", "contractor", "trade", "received",
    "received_order", "due", "amount_cents", "stage", "signal", "summary",
    "documents", "notes",
}


def _text(value: object, limit: int, field: str) -> str:
    if not isinstance(value, str) or not value.strip() or len(value) > limit:
        raise ValueError(f"Invalid bid fixture field: {field}")
    return value


def validate_bid_data(data: dict) -> None:
    """Reject non-synthetic, malformed, or unexpectedly shaped bid fixture data."""
    if not isinstance(data, dict) or set(data) != {"schema", "snapshot_date", "synthetic", "records"}:
        raise ValueError("Invalid Bid Inbox dataset shape")
    if data["schema"] != 1 or data["synthetic"] is not True or not isinstance(data["snapshot_date"], str) or not DATE_RE.fullmatch(data["snapshot_date"]):
        raise ValueError("Bid Inbox requires a dated synthetic snapshot")
    date.fromisoformat(data["snapshot_date"])
    records = data["records"]
    if not isinstance(records, list) or not 3 <= len(records) <= 40:
        raise ValueError("Bid Inbox requires 3–40 synthetic fixture records")
    seen: set[str] = set()
    for record in records:
        if not isinstance(record, dict) or set(record) != REQUIRED_RECORD_FIELDS:
            raise ValueError("Unexpected bid fixture record fields")
        ident = record["id"]
        if not isinstance(ident, str) or not ID_RE.fullmatch(ident) or ident in seen:
            raise ValueError("Invalid or duplicate bid fixture id")
        seen.add(ident)
        if not isinstance(record["reference"], str) or not REFERENCE_RE.fullmatch(record["reference"]):
            raise ValueError("Invalid bid fixture reference")
        project = _text(record["project"], 120, "project")
        contractor = _text(record["contractor"], 120, "contractor")
        if "(synthetic)" not in project.lower() or "(synthetic)" not in contractor.lower():
            raise ValueError("Every project and bidder label must be explicitly synthetic")
        for field, limit in (("trade", 60), ("received", 60), ("due", 60), ("signal", 120), ("summary", 500)):
            _text(record[field], limit, field)
        for field in ("received_order", "amount_cents"):
            value = record[field]
            if not isinstance(value, int) or isinstance(value, bool) or value < 0:
                raise ValueError(f"Invalid numeric fixture field: {field}")
        if record["amount_cents"] == 0:
            raise ValueError("Synthetic bid amount must be positive")
        if record["stage"] not in STAGES:
            raise ValueError("Unknown bid review stage")
        documents = record["documents"]
        if not isinstance(documents, list) or not 1 <= len(documents) <= 12:
            raise ValueError("Each fixture needs a bounded document index")
        labels: set[str] = set()
        for document in documents:
            if not isinstance(document, dict) or set(document) != {"label", "present"}:
                raise ValueError("Invalid synthetic document-index entry")
            label = _text(document["label"], 100, "document label")
            if label in labels or not isinstance(document["present"], bool):
                raise ValueError("Duplicate label or invalid document presence value")
            labels.add(label)
        notes = record["notes"]
        if not isinstance(notes, list) or not 1 <= len(notes) <= 8:
            raise ValueError("Each fixture needs bounded reviewer notes")
        for note in notes:
            _text(note, 400, "note")


def _money(cents: int) -> str:
    return f"${cents // 100:,}"


def render_bid_inbox(data: dict) -> str:
    validate_bid_data(data)
    rows: list[str] = []
    for record in data["records"]:
        search_text = " ".join(
            [record["reference"], record["project"], record["contractor"], record["trade"], record["received"],
             record["due"], record["signal"], record["summary"], *(d["label"] for d in record["documents"]), *record["notes"]]
        )
        attrs = {
            "data-bid-id": record["id"], "data-reference": record["reference"],
            "data-project": record["project"], "data-contractor": record["contractor"],
            "data-trade": record["trade"], "data-received": record["received"],
            "data-received-order": str(record["received_order"]), "data-due": record["due"],
            "data-amount-cents": str(record["amount_cents"]), "data-stage": record["stage"],
            "data-signal": record["signal"], "data-summary": record["summary"],
            "data-documents": json.dumps(record["documents"], ensure_ascii=False, separators=(",", ":")),
            "data-notes": json.dumps(record["notes"], ensure_ascii=False, separators=(",", ":")),
            "data-search-text": search_text,
        }
        encoded_attrs = " ".join(f'{key}="{html.escape(value, quote=True)}"' for key, value in attrs.items())
        stage = record["stage"]
        documents = json.dumps(record["documents"], ensure_ascii=False, separators=(",", ":"))
        rows.append(
            f"<tr {encoded_attrs}>"
            f'<td><label class="bid-select"><input type="checkbox" data-select-bid="{html.escape(record["id"], quote=True)}" aria-label="Select {html.escape(record["reference"], quote=True)} for comparison" disabled><span>{html.escape(record["reference"])}</span></label></td>'
            f'<td><span class="bid-project">{html.escape(record["project"])}</span><span class="bid-contractor">{html.escape(record["contractor"])}</span></td>'
            f'<td>{html.escape(record["trade"])}</td>'
            f'<td><span class="bid-amount">{_money(record["amount_cents"])}</span></td>'
            f'<td><span class="bid-due">{html.escape(record["due"])}</span></td>'
            f'<td><span class="bid-signal bid-signal-{stage}">{html.escape(STAGES[stage])}</span><br><span class="bid-contractor">{html.escape(record["signal"])}</span></td>'
            f'<td><button class="bid-open" type="button" data-open-bid="{html.escape(record["id"], quote=True)}" disabled>Inspect</button></td>'
            "</tr>"
        )
    trades = sorted({record["trade"] for record in data["records"]})
    trade_options = '<option value="all">All trades</option>' + "".join(
        f'<option value="{html.escape(trade, quote=True)}">{html.escape(trade)}</option>' for trade in trades
    )
    ready = sum(record["stage"] == "ready" for record in data["records"])
    review = sum(record["stage"] == "review" for record in data["records"])
    held = sum(record["stage"] == "hold" for record in data["records"])
    total = len(data["records"])
    return (
        '<a class="skip" href="#bid-workspace">Skip to bid desk</a>'
        '<header class="bid-topbar"><a class="bid-brand" href="/"><span class="bid-brand-mark" aria-hidden="true">JM</span> Jacob Metoyer / demo lab</a>'
        '<nav aria-label="Demo navigation"><a href="/demos/">All demos</a><a href="/#research">Selected work</a><a href="https://github.com/Jacob-Met/jacob-met.github.io" rel="noopener">Source ↗</a></nav></header>'
        '<section class="bid-hero" aria-labelledby="bid-title"><div class="bid-hero-copy"><p class="bid-eyebrow">Demo 01 · synthetic package desk</p>'
        '<h1 id="bid-title">Bid <span>Inbox.</span></h1>'
        '<p class="bid-hero-lede">A small browser workbench for finding missing package items, opening the evidence index, and comparing two invented records without turning a checklist into a decision.</p></div>'
        '<aside class="bid-index-stamp" aria-label="Scenario classification"><span>Scenario file</span><strong>SIM / 01</strong><span>All names, amounts, packages and dates are invented.</span></aside></section>'
        '<main id="main" class="bid-main"><div id="bid-workspace" class="bid-main-inner" data-bid-inbox>'
        '<div class="bid-boundary"><strong>Boundary</strong><p>This is a static synthetic scenario. “Index complete” means only that the five sample labels appear in the fixture. The page does not contact bidders, verify files, normalize scope, rank packages, select a winner, or submit an award.</p></div>'
        f'<dl class="bid-metrics" aria-label="Synthetic package counts"><div class="bid-metric"><dt>Visible now</dt><dd id="metric-visible">{total:02d}</dd></div>'
        f'<div class="bid-metric"><dt>Hold for a person</dt><dd id="metric-hold">{held:02d}</dd></div>'
        f'<div class="bid-metric"><dt>Clarify</dt><dd id="metric-review">{review:02d}</dd></div>'
        f'<div class="bid-metric"><dt>Index complete · not approved</dt><dd id="metric-ready">{ready:02d}</dd></div></dl>'
        '<section class="bid-workspace" aria-labelledby="workspace-title"><header class="bid-workspace-head"><div><p>Review surface / local only</p><h2 id="workspace-title">Incoming packages</h2></div>'
        f'<span class="bid-date-stamp">Scenario snapshot · {html.escape(data["snapshot_date"])}</span></header>'
        '<div class="bid-controls" aria-label="Search and filter synthetic packages">'
        '<label class="bid-control" for="bid-search">Find project, trade, bidder, or signal<input id="bid-search" type="search" autocomplete="off" placeholder="e.g. Electrical, BID-101, exclusions" disabled></label>'
        '<label class="bid-control" for="bid-stage">Review state<select id="bid-stage" disabled><option value="all">All states</option><option value="hold">Hold</option><option value="review">Clarify</option><option value="ready">Index complete</option></select></label>'
        f'<label class="bid-control" for="bid-trade">Trade<select id="bid-trade" disabled>{trade_options}</select></label>'
        '<label class="bid-control" for="bid-sort">Order<select id="bid-sort" disabled><option value="recent">Most recent</option><option value="amount-asc">Amount · low first</option><option value="amount-desc">Amount · high first</option></select></label>'
        '<button id="bid-reset" class="bid-button" type="button" disabled>Reset</button><button id="bid-compare" class="bid-button" type="button" disabled>Compare packages · 0/2</button></div>'
        '<p id="bid-script-status" class="bid-status" aria-live="polite">The static fixture is visible; browser-only controls are loading.</p>'
        f'<p id="bid-status" class="bid-status" role="status" aria-live="polite">{total} of {total} synthetic packages shown.</p>'
        '<p id="bid-empty" class="bid-empty" hidden>No packages match these filters. Reset to restore the full synthetic scenario.</p>'
        '<div class="bid-table-scroll" role="region" aria-label="Synthetic bid packages; scroll horizontally to inspect all columns" tabindex="0">'
        '<table class="bid-table"><caption>Invented scenario records · a package label is not an inspected document</caption>'
        '<thead><tr><th scope="col">Compare</th><th scope="col">Project / bidder</th><th scope="col">Trade</th><th scope="col">Amount · fixture</th><th scope="col">Scenario due</th><th scope="col">Package signal</th><th scope="col"><span class="visually-hidden">Inspect package</span></th></tr></thead>'
        '<tbody id="bid-records">' + "".join(rows) + '</tbody></table></div>'
        '<div class="bid-table-foot"><p>Source: invented fixture rows. “Listed” means a label exists in this page’s sample data.</p><p>No file picker · no upload · no outbound request</p></div>'
        '</section></div></main>'
        '<footer class="bid-footer"><span>Part of the <a href="/">Jacob Metoyer portfolio</a> · <a href="/demos/">Demo index</a></span><span>TypeScript · static fixture · no backend</span></footer>'
        '<dialog id="bid-detail" class="bid-dialog" aria-labelledby="detail-reference" aria-describedby="detail-summary">'
        '<div class="bid-dialog-head"><div><p>Package detail / synthetic</p><h2 id="detail-reference">Bid record</h2></div><button id="bid-detail-close" class="bid-button" type="button" disabled>Close</button></div>'
        '<p id="detail-project" class="detail-subtitle"></p><p id="detail-contractor" class="detail-subtitle"></p><p id="detail-summary"></p>'
        '<dl class="bid-facts"><div><dt>Trade</dt><dd id="detail-trade"></dd></div><div><dt>Fixture amount</dt><dd id="detail-amount"></dd></div>'
        '<div><dt>Received in scenario</dt><dd id="detail-received"></dd></div><div><dt>Due in scenario</dt><dd id="detail-due"></dd></div><div><dt>Package signal</dt><dd id="detail-signal"></dd></div></dl>'
        '<div class="bid-detail-grid"><section><h3>Package index · labels only</h3><ul id="detail-documents"></ul></section><section><h3>Open notes</h3><ul id="detail-notes"></ul></section></div>'
        '<p class="dialog-limit">This view does not contain, open, verify, or download real bid documents. It is a synthetic UI study; ask a person to resolve any unknown.</p></dialog>'
        '<dialog id="bid-comparison" class="bid-dialog" aria-labelledby="comparison-title"><div class="bid-dialog-head"><div><p>Side by side / synthetic</p><h2 id="comparison-title">Comparison, not recommendation</h2></div>'
        '<button id="bid-comparison-close" class="bid-button" type="button" disabled>Close</button></div>'
        '<p class="detail-subtitle">Amounts and checklist labels are shown as fixtures. Scope differences and suitability are not calculated.</p>'
        '<div id="comparison-cards" class="comparison-cards"></div><p class="dialog-limit">No package is ranked or selected. No contact, submission, or award action exists in this demo.</p></dialog>'
        '<script type="module" src="/demos/bid-inbox/bid-inbox.js"></script>'
    )


def render_demo_gallery() -> str:
    return (
        '<a class="skip" href="#demo-index">Skip to demo index</a>'
        '<header class="masthead"><p class="gallery-brand"><a href="/">Jacob Metoyer</a></p>'
        '<nav class="primary-nav" aria-label="Primary"><a href="/#research">Selected work</a><a href="/demos/">Demo gallery</a><a href="/">Home</a></nav>'
        '<a class="masthead-profile" href="https://github.com/Jacob-Met" rel="noopener">GitHub ↗</a></header>'
        '<main id="demo-index" class="demo-gallery-page"><section class="gallery-hero"><p class="gallery-kicker">Open lab / browser-first</p>'
        '<h1>Try the interface.<br><span>Keep the boundary.</span></h1>'
        '<p>Small, target-specific prototypes built around invented scenarios. Each one states what it can show, what it cannot, and where its source lives.</p>'
        '<div class="gallery-index-mark" aria-hidden="true"><span>DEMO</span><strong>01</strong><span>LIVE / LOCAL</span></div></section>'
        '<section class="gallery-live" aria-labelledby="gallery-live-title"><div class="gallery-section-label">Available now · 01</div><h2 id="gallery-live-title">A useful screen, not a screenshot.</h2>'
        '<article class="gallery-feature"><div><p class="gallery-kicker">01 / Commercial workflow study</p><h3>Bid Inbox</h3>'
        '<p>Search a synthetic package desk, inspect its label index, and compare two records without generating a winner.</p>'
        '<a class="gallery-cta" href="/demos/bid-inbox/">Open the synthetic demo <span aria-hidden="true">↗</span></a></div>'
        '<aside class="gallery-feature-aside"><span>SCENARIO</span><strong>05</strong><span>INVENTED PACKAGES</span><hr><span>NETWORK WRITES</span><strong>00</strong><span>CONNECTIVITY DISABLED</span></aside></article></section>'
        '<section class="gallery-boundary" aria-labelledby="gallery-boundary-title"><p class="gallery-kicker">Build standard</p><h2 id="gallery-boundary-title">The sample is part of the spec.</h2>'
        '<p>Commercial and contest owners get separate routes and synthetic fixtures. No private exports, remote APIs, or submission paths are included. <a href="https://github.com/Jacob-Met/jacob-met.github.io/blob/main/source/demo-authoring.md" rel="noopener">Read the authoring and publishing pattern</a>.</p></section></main>'
        '<footer class="site-footer"><div class="site-footer-inner"><h2>Every demo points back to its source.</h2><p><a href="/">Return to Jacob Metoyer’s site</a> · <a href="https://github.com/Jacob-Met/jacob-met.github.io" rel="noopener">Public site repository</a></p></div></footer>'
    )


def render_legacy_notice() -> str:
    return (
        '<a class="skip" href="#legacy-main">Skip to notice</a>'
        '<header class="masthead"><div class="brand-lockup"><span class="registration" aria-hidden="true"></span><h1><a href="/">Jacob Metoyer</a></h1></div>'
        '<nav class="primary-nav" aria-label="Primary"><a href="/demos/">Demo gallery</a><a href="/">Home</a></nav></header>'
        '<main id="legacy-main" class="legacy-page"><p class="gallery-kicker">Route note / archived sample</p><h1>This sample moved.</h1>'
        '<p>The former utility review sample is no longer the featured demo. The current browser-only prototype is Bid Inbox, with invented records and no backend.</p>'
        '<a class="gallery-cta" href="/demos/bid-inbox/">Open Bid Inbox <span aria-hidden="true">↗</span></a></main>'
        '<footer class="site-footer"><div class="site-footer-inner"><h2>Inspect the current work.</h2><p><a href="/">Return home</a> · <a href="/demos/">Browse the demo gallery</a></p></div></footer>'
    )
