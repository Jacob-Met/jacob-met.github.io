import assert from 'node:assert/strict';
import test from 'node:test';
import { filterRecords, sortRecords } from '../source/compiled/sample-ui.js';

const rows = [
  {
    id: 'usage-1', category: 'usage', property: 'Cypress Court', utility: 'Gas', account: 'SYN-7002',
    signal: 'USAGE_SPIKE', summary: '92.7 therm/day vs 49.4 year earlier',
    evidence: ['bills.csv:33', 'bills.csv:21'], searchText: 'cypress court gas syn-7002 usage_spike 92.7 bills.csv:33 bills.csv:21',
  },
  {
    id: 'payment-1', category: 'payment', property: 'Bayou Flats', utility: 'Water', account: 'SYN-7007',
    signal: 'PAYMENT_MISMATCH', summary: 'Two payments do not match the bill',
    evidence: ['bills.csv:126', 'payments.csv:120'], searchText: 'bayou flats water syn-7007 payment_mismatch bills.csv:126 payments.csv:120',
  },
  {
    id: 'integrity-1', category: 'integrity', property: 'Gaylord Ridge', utility: 'Trash', account: 'SYN-7012',
    signal: 'DUPLICATE_BILL', summary: 'Duplicate invoice',
    evidence: ['bills.csv:214'], searchText: 'gaylord ridge trash syn-7012 duplicate_bill bills.csv:214',
  },
];

test('search is case-insensitive, trimmed, and includes evidence pointers', () => {
  assert.deepEqual(filterRecords(rows, '  PAYMENTS.CSV:120 ', 'all').map((row) => row.id), ['payment-1']);
  assert.deepEqual(filterRecords(rows, 'cypress', 'all').map((row) => row.id), ['usage-1']);
});

test('category and search filters compose without mutating the source list', () => {
  const originalOrder = rows.map((row) => row.id);
  assert.deepEqual(filterRecords(rows, 'bill', 'payment').map((row) => row.id), ['payment-1']);
  assert.deepEqual(filterRecords(rows, '', 'unknown'), []);
  assert.deepEqual(rows.map((row) => row.id), originalOrder);
});

test('sort modes are deterministic and leave the input order unchanged', () => {
  assert.deepEqual(sortRecords(rows, 'source').map((row) => row.id), ['usage-1', 'payment-1', 'integrity-1']);
  assert.deepEqual(sortRecords(rows, 'property').map((row) => row.id), ['payment-1', 'usage-1', 'integrity-1']);
  assert.deepEqual(sortRecords(rows, 'signal').map((row) => row.id), ['integrity-1', 'payment-1', 'usage-1']);
  assert.deepEqual(rows.map((row) => row.id), ['usage-1', 'payment-1', 'integrity-1']);
});
