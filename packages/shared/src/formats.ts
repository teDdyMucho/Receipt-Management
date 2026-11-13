import type { ReceiptDetails } from './types';

// Display formats, access-name parsing and wizard validation (spec sections 8.4 and 9).

/** `MM/DD/YYYY` from the leading `YYYY-MM-DD`; anything else is returned unchanged. */
export function formatReceiptDate(value: string | null | undefined): string {
  if (!value) return '';
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(value);
  return m ? `${m[2]}/${m[3]}/${m[1]}` : value;
}

/** `MM/DD/YYYY hh:mm AM` in en-US from a timestamp. */
export function formatCreatedAt(value: string | null | undefined, timeZone?: string): string {
  if (!value) return '';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '';
  const date = d.toLocaleDateString('en-US', {
    month: '2-digit',
    day: '2-digit',
    year: 'numeric',
    timeZone,
  });
  const time = d.toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
    timeZone,
  });
  return `${date} ${time}`;
}

/** The access NAME from a bare name or from a URL that carries `?access=NAME`. */
export function parseAccessName(input: string | null | undefined): string | null {
  const text = (input ?? '').trim();
  if (!text) return null;

  const m = /[?&]access=([^&#]*)/i.exec(text);
  if (m) {
    let name = m[1] ?? '';
    try {
      name = decodeURIComponent(name.replace(/\+/g, ' '));
    } catch {
      // keep the raw value when it is not valid percent-encoding
    }
    name = name.trim();
    return name || null;
  }

  // A URL without an access parameter is not a name.
  if (/^https?:\/\//i.test(text)) return null;
  return text;
}

/** A link name needs at least one letter or digit (spec 8.10). */
export function isValidLinkName(name: string): boolean {
  return /[\p{L}\p{N}]/u.test(name);
}

export const RECEIPT_TYPES = [
  { value: 'renovation', label: 'Renovation', colour: 'emerald' },
  { value: 'turn_over', label: 'Turn Over', colour: 'amber' },
  { value: 'work_order', label: 'Work Order', colour: 'indigo' },
] as const;

/** Row colour by Type; anything that is not a known type is Other (slate). */
export function typeColour(type: string | null | undefined): 'emerald' | 'amber' | 'indigo' | 'slate' {
  return RECEIPT_TYPES.find((t) => t.value === type)?.colour ?? 'slate';
}

export function typeLabel(type: string | null | undefined, typeOther?: string | null): string {
  const known = RECEIPT_TYPES.find((t) => t.value === type);
  if (known) return known.label;
  return typeOther || type || 'Other';
}

/** Work order is shown and required only for Turn Over and Work Order. */
export function needsWorkOrder(type: string | null | undefined): boolean {
  return type === 'turn_over' || type === 'work_order';
}

export type DetailsErrors = Partial<Record<keyof ReceiptDetails, string>>;

/**
 * Validation on Done: date, total and address are required; work order for the
 * two types; the Other label when the type is Other. `isOther` is passed in
 * because an Other receipt stores its label in `type`.
 */
export function validateDetails(details: Partial<ReceiptDetails>, isOther: boolean): DetailsErrors {
  const errors: DetailsErrors = {};
  const blank = (v: string | null | undefined) => !v || !v.trim();

  if (isOther) {
    if (blank(details.type_other) && blank(details.type)) errors.type_other = 'Enter a label for Other';
  } else if (blank(details.type)) {
    errors.type = 'Choose a type';
  }
  if (blank(details.receipt_date)) errors.receipt_date = 'Receipt date is required';
  else if (!/^\d{4}-\d{2}-\d{2}$/.test(details.receipt_date ?? '')) errors.receipt_date = 'Use a valid date';
  if (blank(details.total)) errors.total = 'Total is required';
  if (!isOther && needsWorkOrder(details.type) && blank(details.work_order)) {
    errors.work_order = 'Work order is required';
  }
  if (blank(details.tenant_address)) errors.tenant_address = 'Tenant address is required';
  return errors;
}
