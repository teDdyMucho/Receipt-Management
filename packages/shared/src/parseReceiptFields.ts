import type { ExtractedFields } from './types';

// The n8n `/webhook/upload` response comes back in many shapes (spec section 7):
// an object, an array of items, an item with the object under `output`,
// `text_sample`, `receipt data` or `receipt_data`, a stringified JSON, or JSON
// inside markdown fences. This unwraps all of them.

const WRAPPER_KEYS = ['output', 'text_sample', 'receipt data', 'receipt_data', 'json'];
const FIELD_KEYS = ['receipt_date', 'total', 'work_order', 'tenant_address'] as const;
const MAX_DEPTH = 8;

/** Pulls a JSON value out of a string that may be fenced or surrounded by prose. */
function parseJsonString(text: string): unknown {
  const trimmed = text.trim();
  if (!trimmed) return null;

  const fenced = /```(?:json)?\s*([\s\S]*?)```/i.exec(trimmed);
  const candidates = [fenced?.[1], trimmed];

  // Last resort: the first {...} or [...] block inside surrounding text.
  const firstBrace = trimmed.search(/[{[]/);
  const lastBrace = Math.max(trimmed.lastIndexOf('}'), trimmed.lastIndexOf(']'));
  if (firstBrace >= 0 && lastBrace > firstBrace) {
    candidates.push(trimmed.slice(firstBrace, lastBrace + 1));
  }

  for (const candidate of candidates) {
    if (!candidate) continue;
    try {
      return JSON.parse(candidate.trim());
    } catch {
      // try the next candidate
    }
  }
  return null;
}

function hasAnyField(obj: Record<string, unknown>): boolean {
  return FIELD_KEYS.some((key) => key in obj);
}

/** Finds the object that carries the receipt fields, however deeply it is wrapped. */
function unwrap(value: unknown, depth: number): Record<string, unknown> | null {
  if (depth > MAX_DEPTH || value === null || value === undefined) return null;

  if (typeof value === 'string') {
    return unwrap(parseJsonString(value), depth + 1);
  }

  if (Array.isArray(value)) {
    for (const item of value) {
      const found = unwrap(item, depth + 1);
      if (found) return found;
    }
    return null;
  }

  if (typeof value === 'object') {
    const obj = value as Record<string, unknown>;
    if (hasAnyField(obj)) return obj;
    for (const key of WRAPPER_KEYS) {
      if (key in obj) {
        const found = unwrap(obj[key], depth + 1);
        if (found) return found;
      }
    }
  }
  return null;
}

function toText(value: unknown): string | null {
  if (value === null || value === undefined) return null;
  if (typeof value === 'number') return String(value);
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  if (!trimmed || /^(null|undefined|n\/a)$/i.test(trimmed)) return null;
  return trimmed;
}

/**
 * Unwraps any n8n extraction response into the four receipt fields.
 * Returns null when no receipt object can be found or every field is empty.
 */
export function parseReceiptFields(raw: unknown): ExtractedFields | null {
  const obj = unwrap(raw, 0);
  if (!obj) return null;

  const fields: ExtractedFields = {
    receipt_date: toText(obj.receipt_date),
    total: toText(obj.total),
    work_order: toText(obj.work_order),
    tenant_address: toText(obj.tenant_address),
  };

  const allEmpty = FIELD_KEYS.every((key) => fields[key] === null);
  return allEmpty ? null : fields;
}
