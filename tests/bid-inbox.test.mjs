import assert from 'node:assert/strict';
import test from 'node:test';
import { documentCount, filterBids, sortBids } from '../source/compiled/bid-inbox.js';

const bids = [
  { id: 'bid-1', project: 'Project Lantern (synthetic)', contractor: 'Bidder Aster (synthetic)', trade: 'Electrical',
    received: '05 Oct', receivedOrder: 2, due: '07 Oct', amountCents: 18450000, stage: 'review', signal: 'Exclusions list not present',
    summary: 'Clarify before comparing', documents: [{ label: 'Scope', present: true }, { label: 'Exclusions', present: false }],
    notes: ['No data leaves this page'], searchText: 'bid-1 lantern aster electrical review exclusions' },
  { id: 'bid-2', project: 'Project Glasshouse (synthetic)', contractor: 'Bidder Birch (synthetic)', trade: 'Glazing',
    received: '04 Oct', receivedOrder: 1, due: '07 Oct', amountCents: 9680000, stage: 'hold', signal: 'Schedule missing',
    summary: 'Human completeness check', documents: [{ label: 'Scope', present: true }, { label: 'Schedule', present: false }],
    notes: ['Ask a person'], searchText: 'bid-2 glasshouse birch glazing hold schedule missing' },
  { id: 'bid-3', project: 'Project Lantern (synthetic)', contractor: 'Bidder Cedar (synthetic)', trade: 'Mechanical',
    received: '05 Oct', receivedOrder: 3, due: '07 Oct', amountCents: 21200000, stage: 'ready', signal: 'Package index complete',
    summary: 'Human scope review still needed', documents: [{ label: 'Scope', present: true }, { label: 'Schedule', present: true }],
    notes: ['No award decision'], searchText: 'bid-3 lantern cedar mechanical ready package index complete' },
];

test('filter composes search, review stage, and trade without changing source order', () => {
  assert.deepEqual(filterBids(bids, '  EXCLUSIONS ', 'review', 'Electrical').map((bid) => bid.id), ['bid-1']);
  assert.deepEqual(filterBids(bids, '', 'hold', 'all').map((bid) => bid.id), ['bid-2']);
  assert.deepEqual(filterBids(bids, 'not-there', 'all', 'all'), []);
  assert.deepEqual(bids.map((bid) => bid.id), ['bid-1', 'bid-2', 'bid-3']);
});

test('sort modes order recent and amounts deterministically without mutating input', () => {
  assert.deepEqual(sortBids(bids, 'recent').map((bid) => bid.id), ['bid-3', 'bid-1', 'bid-2']);
  assert.deepEqual(sortBids(bids, 'amount-asc').map((bid) => bid.id), ['bid-2', 'bid-1', 'bid-3']);
  assert.deepEqual(sortBids(bids, 'amount-desc').map((bid) => bid.id), ['bid-3', 'bid-1', 'bid-2']);
  assert.deepEqual(bids.map((bid) => bid.id), ['bid-1', 'bid-2', 'bid-3']);
});

test('package-index count reports presence, not bid quality or award readiness', () => {
  assert.deepEqual(documentCount(bids[0].documents), { present: 1, total: 2 });
  assert.deepEqual(documentCount([]), { present: 0, total: 0 });
});
