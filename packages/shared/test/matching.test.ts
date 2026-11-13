import { describe, expect, it } from 'vitest';
import {
  candidatesForTransaction,
  duplicateIds,
  duplicateKey,
  greenAmounts,
  isRecentReceipt,
  normAmount,
} from '../src/matching';

// Local noon on 14 Nov 2026.
const now = new Date(2026, 10, 14, 12, 0, 0);

const receipt = (id: string, receipt_date: string | null, total: string) => ({
  id,
  receipt_date,
  total,
  work_order: 'WO-1',
  tenant_address: '12 Main St',
});

describe('normAmount', () => {
  it('strips a leading dollar sign and spaces', () => {
    expect(normAmount('$41.17')).toBe('41.17');
    expect(normAmount(' 41.17 ')).toBe('41.17');
    expect(normAmount(null)).toBe('');
  });
});

describe('isRecentReceipt', () => {
  it('accepts null and the last two days, rejects three days old', () => {
    expect(isRecentReceipt(null, now)).toBe(true);
    expect(isRecentReceipt('2026-11-14', now)).toBe(true);
    expect(isRecentReceipt('2026-11-12', now)).toBe(true);
    expect(isRecentReceipt('2026-11-11', now)).toBe(false);
  });
});

describe('candidates', () => {
  const receipts = [
    receipt('r-today', '2026-11-14', '$41.17'),
    receipt('r-old', '2026-11-11', '41.17'),
    receipt('r-matched', '2026-11-13', '41.17'),
    receipt('r-other', '2026-11-13', '99.00'),
  ];
  const transactions = [
    { transaction_amount: '41.17', receipt_id: null },
    { transaction_amount: '$41.17', receipt_id: 'r-matched' },
  ];

  it('needs the same amount, a recent date and an unmatched receipt', () => {
    const found = candidatesForTransaction(transactions[0]!, receipts, transactions, now);
    expect(found.map((r) => r.id)).toEqual(['r-today']);
  });

  it('green highlight ignores matched and old receipts', () => {
    expect([...greenAmounts(receipts, transactions, now)].sort()).toEqual(['41.17', '99.00']);
    const onlyMatched = [receipt('r-matched', '2026-11-13', '41.17')];
    expect(greenAmounts(onlyMatched, transactions, now).size).toBe(0);
  });
});

describe('duplicates', () => {
  it('builds the key with nulls as empty', () => {
    expect(duplicateKey({ receipt_date: '2026-11-14', total: null, work_order: 'W', tenant_address: null })).toBe(
      '2026-11-14||W|',
    );
  });

  it('flags every receipt that shares a key', () => {
    const list = [receipt('a', '2026-11-14', '1'), receipt('b', '2026-11-14', '1'), receipt('c', '2026-11-14', '2')];
    expect([...duplicateIds(list)].sort()).toEqual(['a', 'b']);
  });
});
