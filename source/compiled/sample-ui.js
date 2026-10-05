function fold(value) {
    return value.trim().toLocaleLowerCase('en');
}
export function filterRecords(records, query, category) {
    const needle = fold(query);
    return records.filter((record) => {
        const categoryMatches = category === 'all' || record.category === category;
        const textMatches = needle.length === 0 || fold(record.searchText).includes(needle);
        return categoryMatches && textMatches;
    });
}
export function sortRecords(records, mode) {
    if (mode === 'source')
        return [...records];
    const collator = new Intl.Collator('en', { numeric: true, sensitivity: 'base' });
    const key = mode === 'property' ? 'property' : 'signal';
    return [...records].sort((left, right) => collator.compare(left[key], right[key])
        || collator.compare(left.id, right.id));
}
function rowRecord(row) {
    const data = row.dataset;
    if (!data.recordId || !data.category || !data.property || !data.utility || !data.account
        || !data.signal || !data.summary || !data.evidence || !data.searchText)
        return null;
    return {
        id: data.recordId,
        category: data.category,
        property: data.property,
        utility: data.utility,
        account: data.account,
        signal: data.signal,
        summary: data.summary,
        evidence: (data.evidence ?? '').split('|').filter((item) => item.length > 0),
        searchText: data.searchText,
    };
}
function setText(root, selector, value) {
    const element = root.querySelector(selector);
    if (element)
        element.textContent = value;
}
export function mountSampleUI(root) {
    const search = root.querySelector('#sample-search');
    const category = root.querySelector('#sample-category');
    const sortButton = root.querySelector('#sample-sort');
    const resetButton = root.querySelector('#sample-reset');
    const body = root.querySelector('#demo-records');
    const resultCount = root.querySelector('#sample-results');
    const emptyState = root.querySelector('#sample-empty');
    const dialog = root.querySelector('#record-dialog');
    const closeButton = root.querySelector('#record-close');
    const detailEvidence = root.querySelector('#detail-evidence');
    const detailSource = root.querySelector('#detail-source');
    if (!search || !category || !sortButton || !resetButton || !body || !resultCount
        || !emptyState || !dialog || !closeButton || !detailEvidence || !detailSource)
        return;
    const rows = Array.from(body.querySelectorAll('tr[data-record-id]'));
    const records = rows.map(rowRecord).filter((record) => record !== null);
    const rowsById = new Map(rows.map((row) => [row.dataset.recordId ?? '', row]));
    const readmeUrl = root.dataset.readmeUrl ?? '';
    let sortMode = 'source';
    let activeTrigger = null;
    const render = () => {
        const visible = sortRecords(filterRecords(records, search.value, category.value), sortMode);
        const visibleIds = new Set(visible.map((record) => record.id));
        for (const row of rows)
            row.hidden = !visibleIds.has(row.dataset.recordId ?? '');
        for (const record of visible) {
            const row = rowsById.get(record.id);
            if (row)
                body.append(row);
        }
        resultCount.textContent = `Showing ${visible.length} of ${records.length} synthetic records.`;
        emptyState.hidden = visible.length !== 0;
        sortButton.textContent = `Sort: ${sortMode === 'source' ? 'sample order' : sortMode}`;
        sortButton.setAttribute('aria-pressed', String(sortMode !== 'source'));
    };
    const openDetails = (record, trigger) => {
        activeTrigger = trigger;
        setText(dialog, '#detail-property', record.property);
        setText(dialog, '#detail-utility', record.utility);
        setText(dialog, '#detail-account', record.account);
        setText(dialog, '#detail-signal', record.signal);
        setText(dialog, '#detail-summary', record.summary);
        detailEvidence.replaceChildren(...record.evidence
            .map((item) => {
            const line = document.createElement('li');
            line.textContent = item;
            return line;
        }));
        detailSource.href = readmeUrl;
        if (typeof dialog.showModal === 'function')
            dialog.showModal();
        else
            dialog.setAttribute('open', '');
    };
    search.disabled = false;
    category.disabled = false;
    sortButton.disabled = false;
    resetButton.disabled = false;
    closeButton.disabled = false;
    for (const button of root.querySelectorAll('[data-open-record]')) {
        button.disabled = false;
        button.addEventListener('click', () => {
            const record = records.find((item) => item.id === button.dataset.openRecord);
            if (record)
                openDetails(record, button);
        });
    }
    search.addEventListener('input', render);
    category.addEventListener('change', render);
    sortButton.addEventListener('click', () => {
        sortMode = sortMode === 'source' ? 'property' : sortMode === 'property' ? 'signal' : 'source';
        render();
    });
    resetButton.addEventListener('click', () => {
        search.value = '';
        category.value = 'all';
        sortMode = 'source';
        render();
        search.focus();
    });
    closeButton.addEventListener('click', () => dialog.close());
    dialog.addEventListener('close', () => {
        activeTrigger?.focus();
        activeTrigger = null;
    });
    dialog.addEventListener('click', (event) => {
        if (event.target === dialog)
            dialog.close();
    });
    render();
    setText(root, '#sample-script-status', 'Local filters are ready. Nothing is sent or saved.');
}
if (typeof document !== 'undefined') {
    const start = () => {
        const root = document.querySelector('[data-sample-ui]');
        if (root)
            mountSampleUI(root);
    };
    if (document.readyState === 'loading')
        document.addEventListener('DOMContentLoaded', start, { once: true });
    else
        start();
}
