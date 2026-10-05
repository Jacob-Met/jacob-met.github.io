function fold(value) {
    return value.trim().toLocaleLowerCase('en');
}
export function filterBids(records, query, stage, trade) {
    const needle = fold(query);
    return records.filter((bid) => {
        const stageMatches = stage === 'all' || bid.stage === stage;
        const tradeMatches = trade === 'all' || bid.trade === trade;
        const textMatches = needle.length === 0 || fold(bid.searchText).includes(needle);
        return stageMatches && tradeMatches && textMatches;
    });
}
export function sortBids(records, mode) {
    const copy = [...records];
    if (mode === 'recent')
        return copy.sort((a, b) => b.receivedOrder - a.receivedOrder || a.id.localeCompare(b.id));
    const direction = mode === 'amount-asc' ? 1 : -1;
    return copy.sort((a, b) => direction * (a.amountCents - b.amountCents) || a.id.localeCompare(b.id));
}
export function documentCount(documents) {
    return { present: documents.filter((document) => document.present).length, total: documents.length };
}
function rowRecord(row) {
    const data = row.dataset;
    const amountCents = Number(data.amountCents);
    const receivedOrder = Number(data.receivedOrder);
    let documents;
    let notes;
    try {
        documents = JSON.parse(data.documents ?? 'null');
        notes = JSON.parse(data.notes ?? 'null');
    }
    catch {
        return null;
    }
    if (!data.bidId || !data.reference || !data.project || !data.contractor || !data.trade
        || !data.received || !data.due || !Number.isSafeInteger(amountCents) || amountCents < 0
        || !Number.isFinite(receivedOrder) || !['review', 'hold', 'ready'].includes(data.stage ?? '')
        || !data.signal || !data.summary || !Array.isArray(documents) || !Array.isArray(notes)
        || !data.searchText)
        return null;
    return {
        id: data.bidId,
        reference: data.reference,
        project: data.project,
        contractor: data.contractor,
        trade: data.trade,
        received: data.received,
        receivedOrder,
        due: data.due,
        amountCents,
        stage: data.stage,
        signal: data.signal,
        summary: data.summary,
        documents,
        notes,
        searchText: data.searchText,
    };
}
function setText(root, selector, value) {
    const element = root.querySelector(selector);
    if (element)
        element.textContent = value;
}
function formatAmount(cents) {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 })
        .format(cents / 100);
}
function appendDefinition(parent, label, value) {
    const wrapper = document.createElement('div');
    const term = document.createElement('dt');
    const description = document.createElement('dd');
    term.textContent = label;
    description.textContent = value;
    wrapper.append(term, description);
    parent.append(wrapper);
}
function comparisonCard(bid) {
    const card = document.createElement('article');
    card.className = 'compare-card';
    const heading = document.createElement('h3');
    heading.textContent = bid.reference;
    const project = document.createElement('p');
    project.className = 'compare-project';
    project.textContent = `${bid.project} · ${bid.trade}`;
    const facts = document.createElement('dl');
    appendDefinition(facts, 'Amount in fixture', formatAmount(bid.amountCents));
    appendDefinition(facts, 'Package signal', bid.signal);
    appendDefinition(facts, 'Received', bid.received);
    appendDefinition(facts, 'Checklist labels present', `${documentCount(bid.documents).present} of ${bid.documents.length}`);
    const boundary = document.createElement('p');
    boundary.className = 'compare-boundary';
    boundary.textContent = 'Side-by-side display only. It does not normalize scope, judge price, rank bidders, or select a winner.';
    card.append(heading, project, facts, boundary);
    return card;
}
export function mountBidInbox(root) {
    const search = root.querySelector('#bid-search');
    const stage = root.querySelector('#bid-stage');
    const trade = root.querySelector('#bid-trade');
    const sort = root.querySelector('#bid-sort');
    const reset = root.querySelector('#bid-reset');
    const compare = root.querySelector('#bid-compare');
    const body = root.querySelector('#bid-records');
    const status = root.querySelector('#bid-status');
    const empty = root.querySelector('#bid-empty');
    const detail = root.querySelector('#bid-detail');
    const detailClose = root.querySelector('#bid-detail-close');
    const detailDocuments = root.querySelector('#detail-documents');
    const detailNotes = root.querySelector('#detail-notes');
    const comparison = root.querySelector('#bid-comparison');
    const comparisonClose = root.querySelector('#bid-comparison-close');
    const comparisonCards = root.querySelector('#comparison-cards');
    if (!search || !stage || !trade || !sort || !reset || !compare || !body || !status || !empty
        || !detail || !detailClose || !detailDocuments || !detailNotes || !comparison
        || !comparisonClose || !comparisonCards)
        return;
    const rows = Array.from(body.querySelectorAll('tr[data-bid-id]'));
    const records = rows.map(rowRecord).filter((bid) => bid !== null);
    const rowsById = new Map(rows.map((row) => [row.dataset.bidId ?? '', row]));
    const selected = new Set();
    let activeTrigger = null;
    const render = () => {
        const visible = sortBids(filterBids(records, search.value, stage.value, trade.value), sort.value);
        const visibleIds = new Set(visible.map((bid) => bid.id));
        for (const row of rows)
            row.hidden = !visibleIds.has(row.dataset.bidId ?? '');
        for (const bid of visible) {
            const row = rowsById.get(bid.id);
            if (row)
                body.append(row);
        }
        status.textContent = `${visible.length} of ${records.length} synthetic packages shown. ${selected.size} selected for side-by-side review.`;
        empty.hidden = visible.length !== 0;
        compare.disabled = selected.size !== 2;
        compare.textContent = `Compare packages · ${selected.size}/2`;
        setText(root, '#metric-visible', String(visible.length).padStart(2, '0'));
        setText(root, '#metric-hold', String(records.filter((bid) => bid.stage === 'hold').length).padStart(2, '0'));
        setText(root, '#metric-review', String(records.filter((bid) => bid.stage === 'review').length).padStart(2, '0'));
        setText(root, '#metric-ready', String(records.filter((bid) => bid.stage === 'ready').length).padStart(2, '0'));
    };
    const openDetails = (bid, trigger) => {
        activeTrigger = trigger;
        setText(detail, '#detail-reference', bid.reference);
        setText(detail, '#detail-project', bid.project);
        setText(detail, '#detail-contractor', bid.contractor);
        setText(detail, '#detail-trade', bid.trade);
        setText(detail, '#detail-amount', formatAmount(bid.amountCents));
        setText(detail, '#detail-received', bid.received);
        setText(detail, '#detail-due', bid.due);
        setText(detail, '#detail-signal', bid.signal);
        setText(detail, '#detail-summary', bid.summary);
        detailDocuments.replaceChildren(...bid.documents.map((doc) => {
            const item = document.createElement('li');
            item.className = doc.present ? 'document-present' : 'document-missing';
            item.textContent = `${doc.present ? 'Listed in fixture' : 'Not listed'} · ${doc.label}`;
            return item;
        }));
        detailNotes.replaceChildren(...bid.notes.map((note) => {
            const item = document.createElement('li');
            item.textContent = note;
            return item;
        }));
        if (typeof detail.showModal === 'function')
            detail.showModal();
        else
            detail.setAttribute('open', '');
    };
    search.disabled = false;
    stage.disabled = false;
    trade.disabled = false;
    sort.disabled = false;
    reset.disabled = false;
    for (const checkbox of root.querySelectorAll('[data-select-bid]')) {
        checkbox.disabled = false;
        checkbox.addEventListener('change', () => {
            const id = checkbox.dataset.selectBid ?? '';
            if (checkbox.checked && selected.size >= 2) {
                checkbox.checked = false;
                status.textContent = 'Compare exactly two packages at a time. Clear one selection before choosing another.';
                return;
            }
            if (checkbox.checked)
                selected.add(id);
            else
                selected.delete(id);
            render();
        });
    }
    for (const button of root.querySelectorAll('[data-open-bid]')) {
        button.disabled = false;
        button.addEventListener('click', () => {
            const bid = records.find((candidate) => candidate.id === button.dataset.openBid);
            if (bid)
                openDetails(bid, button);
        });
    }
    search.addEventListener('input', render);
    stage.addEventListener('change', render);
    trade.addEventListener('change', render);
    sort.addEventListener('change', render);
    reset.addEventListener('click', () => {
        search.value = '';
        stage.value = 'all';
        trade.value = 'all';
        sort.value = 'recent';
        for (const checkbox of root.querySelectorAll('[data-select-bid]'))
            checkbox.checked = false;
        selected.clear();
        render();
        search.focus();
    });
    compare.addEventListener('click', () => {
        if (selected.size !== 2)
            return;
        comparisonCards.replaceChildren(...Array.from(selected, (id) => records.find((bid) => bid.id === id))
            .filter((bid) => bid !== undefined)
            .map(comparisonCard));
        activeTrigger = compare;
        if (typeof comparison.showModal === 'function')
            comparison.showModal();
        else
            comparison.setAttribute('open', '');
    });
    detailClose.disabled = false;
    comparisonClose.disabled = false;
    detailClose.addEventListener('click', () => detail.close());
    comparisonClose.addEventListener('click', () => comparison.close());
    for (const dialog of [detail, comparison]) {
        dialog.addEventListener('click', (event) => {
            if (event.target === dialog)
                dialog.close();
        });
        dialog.addEventListener('close', () => {
            activeTrigger?.focus();
            activeTrigger = null;
        });
    }
    render();
    setText(root, '#bid-script-status', 'Browser-only controls are ready. No files, messages, or bid data leave this page.');
}
if (typeof document !== 'undefined') {
    const start = () => {
        const root = document.querySelector('[data-bid-inbox]');
        if (root)
            mountBidInbox(root);
    };
    if (document.readyState === 'loading')
        document.addEventListener('DOMContentLoaded', start, { once: true });
    else
        start();
}
