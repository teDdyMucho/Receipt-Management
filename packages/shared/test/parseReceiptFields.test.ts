import { describe, expect, it } from 'vitest';
import { parseReceiptFields } from '../src/parseReceiptFields';

const fields = {
  receipt_date: '2026-11-02',
  total: '$41.17',
  work_order: '12345-1',
  tenant_address: '12 Main St',
};

describe('parseReceiptFields', () => {
  it('reads a plain object', () => {
    expect(parseReceiptFields(fields)).toEqual(fields);
  });

  it('reads an array of items', () => {
    expect(parseReceiptFields([fields])).toEqual(fields);
  });

  it.each(['output', 'text_sample', 'receipt data', 'receipt_data'])('unwraps "%s"', (key) => {
    expect(parseReceiptFields([{ [key]: fields }])).toEqual(fields);
  });

  it('reads stringified JSON', () => {
    expect(parseReceiptFields(JSON.stringify(fields))).toEqual(fields);
    expect(parseReceiptFields({ output: JSON.stringify(fields) })).toEqual(fields);
  });

  it('reads JSON inside markdown fences', () => {
    const fenced = 'Here you go:\n```json\n' + JSON.stringify(fields, null, 2) + '\n```';
    expect(parseReceiptFields(fenced)).toEqual(fields);
    expect(parseReceiptFields([{ output: fenced }])).toEqual(fields);
  });

  it('fills missing fields with null and turns numbers into text', () => {
    expect(parseReceiptFields({ total: 12.5, receipt_date: ' ' })).toEqual({
      receipt_date: null,
      total: '12.5',
      work_order: null,
      tenant_address: null,
    });
  });

  it('returns null for unusable input', () => {
    expect(parseReceiptFields(null)).toBeNull();
    expect(parseReceiptFields('sorry, no receipt found')).toBeNull();
    expect(parseReceiptFields({ message: 'Workflow was started' })).toBeNull();
    expect(parseReceiptFields({ total: null, receipt_date: '' })).toBeNull();
  });
});
