export interface SampleRecord {
  id: string;
  category: string;
  property: string;
  utility: string;
  account: string;
  signal: string;
  summary: string;
  evidence: string[];
  searchText: string;
}

export type SortMode = 'source' | 'property' | 'signal';

function fold(value: string): string {
  return value.trim().toLocaleLowerCase('en');
}

export function filterRecords(
  records: readonly SampleRecord[],
  query: string,
  category: string,
): SampleRecord[] {
  const needle = fold(query);
  return records.filter((record) => {
    const categoryMatches = category === 'all' || record.category === category;
    const textMatches = needle.length === 0 || fold(record.searchText).includes(needle);
    return categoryMatches && textMatches;
  });
}

export function sortRecords(records: readonly SampleRecord[], mode: SortMode): SampleRecord[] {
  if (mode === 'source') return [...records];
  const collator = new Intl.Collator('en', { numeric: true, sensitivity: 'base' });
  const key = mode === 'property' ? 'property' : 'signal';
  return [...records].sort((left, right) => collator.compare(left[key], right[key])
    || collator.compare(left.id, right.id));
}

function rowRecord(row: HTMLTableRowElement): SampleRecord | null {
  const data = row.dataset;
  if (!data.recordId || !data.category || !data.property || !data.utility || !data.account
      || !data.signal || !data.summary || !data.evidence || !data.searchText) return null;
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

function setText(root: ParentNode, selector: string, value: string): void {
  const element = root.querySelector<HTMLElement>(selector);
  if (element) element.textContent = value;
}

export function mountSampleUI(root: HTMLElement): void {
  const search = root.querySelector<HTMLInputElement>('#sample-search');
  const category = root.querySelector<HTMLSelectElement>('#sample-category');
  const sortButton = root.querySelector<HTMLButtonElement>('#sample-sort');
  const resetButton = root.querySelector<HTMLButtonElement>('#sample-reset');
  const body = root.querySelector<HTMLTableSectionElement>('#demo-records');
  const resultCount = root.querySelector<HTMLElement>('#sample-results');
  const emptyState = root.querySelector<HTMLElement>('#sample-empty');
  const dialog = root.querySelector<HTMLDialogElement>('#record-dialog');
  const closeButton = root.querySelector<HTMLButtonElement>('#record-close');
  const detailEvidence = root.querySelector<HTMLUListElement>('#detail-evidence');
  const detailSource = root.querySelector<HTMLAnchorElement>('#detail-source');
  if (!search || !category || !sortButton || !resetButton || !body || !resultCount
      || !emptyState || !dialog || !closeButton || !detailEvidence || !detailSource) return;

  const rows = Array.from(body.querySelectorAll<HTMLTableRowElement>('tr[data-record-id]'));
  const records = rows.map(rowRecord).filter((record): record is SampleRecord => record !== null);
  const rowsById = new Map(rows.map((row) => [row.dataset.recordId ?? '', row]));
  const readmeUrl = root.dataset.readmeUrl ?? '';
  let sortMode: SortMode = 'source';
  let activeTrigger: HTMLButtonElement | null = null;

  const render = (): void => {
    const visible = sortRecords(filterRecords(records, search.value, category.value), sortMode);
    const visibleIds = new Set(visible.map((record) => record.id));
    for (const row of rows) row.hidden = !visibleIds.has(row.dataset.recordId ?? '');
    for (const record of visible) {
      const row = rowsById.get(record.id);
      if (row) body.append(row);
    }
    resultCount.textContent = `Showing ${visible.length} of ${records.length} synthetic records.`;
    emptyState.hidden = visible.length !== 0;
    sortButton.textContent = `Sort: ${sortMode === 'source' ? 'sample order' : sortMode}`;
    sortButton.setAttribute('aria-pressed', String(sortMode !== 'source'));
  };

  const openDetails = (record: SampleRecord, trigger: HTMLButtonElement): void => {
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
    if (typeof dialog.showModal === 'function') dialog.showModal();
    else dialog.setAttribute('open', '');
  };

  search.disabled = false;
  category.disabled = false;
  sortButton.disabled = false;
  resetButton.disabled = false;
  closeButton.disabled = false;
  for (const button of root.querySelectorAll<HTMLButtonElement>('[data-open-record]')) {
    button.disabled = false;
    button.addEventListener('click', () => {
      const record = records.find((item) => item.id === button.dataset.openRecord);
      if (record) openDetails(record, button);
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
  dialog.addEventListener('click', (event: MouseEvent) => {
    if (event.target === dialog) dialog.close();
  });
  render();
  setText(root, '#sample-script-status', 'Local filters are ready. Nothing is sent or saved.');
}

if (typeof document !== 'undefined') {
  const start = (): void => {
    const root = document.querySelector<HTMLElement>('[data-sample-ui]');
    if (root) mountSampleUI(root);
  };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start, { once: true });
  else start();
}
