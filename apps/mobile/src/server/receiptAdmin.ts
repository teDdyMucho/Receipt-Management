import { needsWorkOrder, RECEIPT_TYPES, typeLabel, validateDetails, type ReceiptDetails } from '@lionrock/shared';
import { rows, supabase } from './admin';
import { HttpError } from './http';
import type { SessionUser } from './session';

// SERVER ONLY. Editing and deleting receipts, and the audit log of who did what.

interface ReceiptRow {
  id: string;
  user: string | null;
  receipt_date: string | null;
  total: string | null;
  work_order: string | null;
  tenant_address: string | null;
  type: string | null;
  type_other: string | null;
  deleted_at: string | null;
}

export interface AuditEntry {
  id: string;
  at: string;
  actor: string;
  actor_kind: string;
  action: 'upload' | 'edit' | 'delete';
  receipt_id: string | null;
  receipt_owner: string | null;
  summary: string | null;
  changes: Record<string, { from: string | null; to: string | null }> | null;
}

const FIELDS = ['type', 'type_other', 'receipt_date', 'total', 'work_order', 'tenant_address'] as const;
const eq = (value: string) => `eq.${encodeURIComponent(value)}`;
const blank = (v: unknown) => (typeof v === 'string' && v.trim() ? v.trim() : null);

/** "$40.00 · Work Order · 11/13/2026" - enough to recognise the receipt in the log. */
function describe(r: Pick<ReceiptRow, 'total' | 'type' | 'type_other' | 'receipt_date'>): string {
  return [r.total ? `$${r.total}` : 'No total', r.type ? typeLabel(r.type, r.type_other) : null, r.receipt_date].filter(Boolean).join(' · ');
}

/** Writes one line to the audit log. It must never stop the action it describes, so errors are only logged. */
export async function logAudit(
  user: SessionUser,
  action: AuditEntry['action'],
  receipt: { id: string | null; owner: string | null; summary: string },
  changes?: AuditEntry['changes'],
): Promise<void> {
  try {
    const res = await supabase('/rest/v1/receipt_audit', {
      method: 'POST',
      prefer: 'return=minimal',
      body: {
        actor: user.name,
        actor_kind: user.kind,
        action,
        receipt_id: receipt.id,
        receipt_owner: receipt.owner,
        summary: receipt.summary,
        changes: changes ?? null,
      },
    });
    if (!res.ok) console.error('[audit] not written', res.status, (await res.text()).slice(0, 200));
  } catch (e) {
    console.error('[audit] not written', e);
  }
}

export function auditUpload(user: SessionUser, receiptId: string, details: Partial<ReceiptDetails> | undefined): Promise<void> {
  const d = details ?? {};
  return logAudit(user, 'upload', {
    id: receiptId,
    owner: user.name,
    summary: describe({ total: blank(d.total), type: blank(d.type), type_other: blank(d.type_other), receipt_date: blank(d.receipt_date) }),
  });
}

async function findReceipt(id: unknown): Promise<ReceiptRow> {
  if (typeof id !== 'string' || !/^[0-9a-f-]{1,40}$/i.test(id)) throw new HttpError('Receipt not found.', 404, 'not_found');
  const receipt = (await rows<ReceiptRow>(`/rest/v1/receipt?id=${eq(id)}&select=id,user,receipt_date,total,work_order,tenant_address,type,type_other,deleted_at`))[0];
  if (!receipt || receipt.deleted_at) throw new HttpError('Receipt not found.', 404, 'not_found');
  return receipt;
}

async function patchReceipt(id: string, values: Record<string, unknown>): Promise<void> {
  const res = await supabase(`/rest/v1/receipt?id=${eq(id)}`, { method: 'PATCH', body: values, prefer: 'return=minimal' });
  if (!res.ok) {
    console.error('[receipt] change failed', res.status, (await res.text()).slice(0, 300));
    throw new HttpError('The change could not be saved.', 502, 'db_failed');
  }
}

/** Staff and admins may correct the details of any receipt. */
export async function updateReceipt(user: SessionUser, id: unknown, input: Partial<ReceiptDetails> | undefined) {
  if (user.kind !== 'staff') throw new HttpError('Only staff can edit a receipt.', 403, 'forbidden');
  const before = await findReceipt(id);

  const type = blank(input?.type);
  const isOther = !RECEIPT_TYPES.some((t) => t.value === type);
  const next: Record<(typeof FIELDS)[number], string | null> = {
    type,
    type_other: isOther ? blank(input?.type_other) : null,
    receipt_date: blank(input?.receipt_date),
    total: blank(input?.total)?.replace(/^\$/, '') ?? null,
    // The work order only exists for Turn Over and Work Order receipts.
    work_order: needsWorkOrder(type) ? blank(input?.work_order) : null,
    tenant_address: blank(input?.tenant_address),
  };
  const problem = Object.values(validateDetails(next as ReceiptDetails, isOther))[0];
  if (problem) throw new HttpError(problem, 400, 'bad_details');

  const changes: NonNullable<AuditEntry['changes']> = {};
  for (const field of FIELDS) {
    if ((before[field] ?? null) !== next[field]) changes[field] = { from: before[field] ?? null, to: next[field] };
  }
  if (Object.keys(changes).length === 0) return { ok: true, changed: 0 };

  await patchReceipt(before.id, { ...next, details_confirmed: true });
  await logAudit(user, 'edit', { id: before.id, owner: before.user, summary: describe({ ...before, ...next }) }, changes);
  return { ok: true, changed: Object.keys(changes).length };
}

/** A link name may delete its own receipts; staff may delete any. The receipt disappears from the app. */
export async function deleteReceipt(user: SessionUser, id: unknown) {
  const receipt = await findReceipt(id);
  if (user.kind !== 'staff' && receipt.user !== user.name) throw new HttpError('Receipt not found.', 404, 'not_found');
  await patchReceipt(receipt.id, { deleted_at: new Date().toISOString(), deleted_by: user.name });
  await logAudit(user, 'delete', { id: receipt.id, owner: receipt.user, summary: describe(receipt) });
  return { ok: true };
}

export async function listAudit(): Promise<{ entries: AuditEntry[] }> {
  return { entries: await rows<AuditEntry>('/rest/v1/receipt_audit?select=*&order=at.desc&limit=300') };
}
