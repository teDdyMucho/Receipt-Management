import { describe, expect, it } from 'vitest';
import {
  formatCreatedAt,
  formatReceiptDate,
  isValidLinkName,
  parseAccessName,
  typeColour,
  validateDetails,
} from '../src/formats';
import { backoffDelayMs, dueQueue, hasExhaustedRetries, nextRetryAt, reconcileStatus } from '../src/backoff';

describe('formats', () => {
  it('formats receipt dates', () => {
    expect(formatReceiptDate('2026-11-02')).toBe('11/02/2026');
    expect(formatReceiptDate('2026-11-02T00:00:00Z')).toBe('11/02/2026');
    expect(formatReceiptDate(null)).toBe('');
    expect(formatReceiptDate('Nov 2')).toBe('Nov 2');
  });

  it('formats created_at as en-US date and 12-hour time', () => {
    expect(formatCreatedAt('2026-11-02T15:05:00Z', 'UTC')).toBe('11/02/2026 03:05 PM');
    expect(formatCreatedAt('not a date')).toBe('');
  });

  it('reads the access NAME from a name or a URL', () => {
    expect(parseAccessName(' Mike ')).toBe('Mike');
    expect(parseAccessName('https://x.test/receipt-management?access=Mike%20B')).toBe('Mike B');
    expect(parseAccessName('https://x.test/receipt-management?foo=1&access=Mike#top')).toBe('Mike');
    expect(parseAccessName('https://x.test/receipt-management')).toBeNull();
    expect(parseAccessName('')).toBeNull();
  });

  it('validates link names and type colours', () => {
    expect(isValidLinkName('---')).toBe(false);
    expect(isValidLinkName('Mike-2')).toBe(true);
    expect(typeColour('turn_over')).toBe('amber');
    expect(typeColour('Plumbing')).toBe('slate');
  });

  it('validates the wizard on Done', () => {
    const base = { type: 'work_order', receipt_date: '2026-11-02', total: '5', tenant_address: '12 Main' };
    expect(validateDetails(base, false)).toEqual({ work_order: 'Work order is required' });
    expect(validateDetails({ ...base, work_order: '1' }, false)).toEqual({});
    expect(validateDetails({ ...base, type: 'renovation' }, false)).toEqual({});
    expect(validateDetails({ ...base, type: '', type_other: '' }, true)).toHaveProperty('type_other');
    expect(Object.keys(validateDetails({ type: 'renovation' }, false)).sort()).toEqual([
      'receipt_date',
      'tenant_address',
      'total',
    ]);
  });
});

describe('backoff and queue', () => {
  it('follows 30 s, 1, 2, 5, 10 min, then 30 min', () => {
    const minutes = [1, 2, 3, 4, 5, 6, 7, 9].map((n) => backoffDelayMs(n) / 60000);
    expect(minutes).toEqual([0.5, 1, 2, 5, 10, 30, 30, 30]);
    expect(nextRetryAt(1, new Date('2026-11-14T10:00:00Z'))).toBe('2026-11-14T10:00:30.000Z');
    expect(hasExhaustedRetries(9)).toBe(false);
    expect(hasExhaustedRetries(10)).toBe(true);
  });

  it('orders due pending receipts oldest first', () => {
    const now = new Date('2026-11-14T10:00:00Z');
    const item = (id: string, taken: string, status: 'pending' | 'synced' | 'failed', retry: string | null = null) => ({
      client_uuid: id,
      taken_at: taken,
      sync_status: status,
      next_retry_at: retry,
    });
    const queue = dueQueue(
      [
        item('new', '2026-11-14T09:00:00Z', 'pending'),
        item('old', '2026-11-14T08:00:00Z', 'pending'),
        item('waiting', '2026-11-14T07:00:00Z', 'pending', '2026-11-14T10:05:00Z'),
        item('done', '2026-11-14T06:00:00Z', 'synced'),
        item('failed', '2026-11-14T05:00:00Z', 'failed'),
      ],
      now,
    );
    expect(queue.map((i) => i.client_uuid)).toEqual(['old', 'new']);
  });

  it('reconciles an interrupted upload', () => {
    expect(reconcileStatus('abc', { sync_status: 'synced', checksum: 'abc' })).toBe('synced');
    expect(reconcileStatus('abc', { sync_status: 'synced', checksum: 'zzz' })).toBe('pending');
    expect(reconcileStatus('abc', { sync_status: 'pending_on_device', checksum: 'abc' })).toBe('pending');
    expect(reconcileStatus('abc', null)).toBe('pending');
  });
});
