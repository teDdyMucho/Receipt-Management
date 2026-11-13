// Card-transaction matching and duplicate detection (spec section 9).

interface ReceiptLike {
  id: string;
  receipt_date: string | null;
  total: string | null;
  work_order?: string | null;
  tenant_address?: string | null;
}

interface TransactionLike {
  transaction_amount: string | null;
  receipt_id: string | null;
}

/** Amounts match only when these normalised strings are identical. */
export function normAmount(s: string | null | undefined): string {
  return (s ?? '').replace(/^\$/, '').trim();
}

/** `YYYY-MM-DD` of the local calendar day `daysAgo` days before `now`. */
function localDateString(now: Date, daysAgo: number): string {
  const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() - daysAgo);
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${mm}-${dd}`;
}

/** True when the receipt date is missing or within the last two days (local midnight). */
export function isRecentReceipt(receiptDate: string | null, now: Date = new Date()): boolean {
  if (!receiptDate) return true;
  const day = receiptDate.slice(0, 10);
  return day >= localDateString(now, 2);
}

/** Ids of receipts already matched to any card transaction. */
export function matchedReceiptIds(transactions: TransactionLike[]): Set<string> {
  const ids = new Set<string>();
  for (const t of transactions) {
    if (t.receipt_id) ids.add(t.receipt_id);
  }
  return ids;
}

/** Receipts that may be matched at all: unmatched and recent. */
export function candidateReceipts<R extends ReceiptLike>(
  receipts: R[],
  transactions: TransactionLike[],
  now: Date = new Date(),
): R[] {
  const taken = matchedReceiptIds(transactions);
  return receipts.filter(
    (r) => !taken.has(r.id) && normAmount(r.total) !== '' && isRecentReceipt(r.receipt_date, now),
  );
}

/** Candidates for one transaction: same normalised amount. */
export function candidatesForTransaction<R extends ReceiptLike>(
  transaction: TransactionLike,
  receipts: R[],
  transactions: TransactionLike[],
  now: Date = new Date(),
): R[] {
  const amount = normAmount(transaction.transaction_amount);
  if (!amount) return [];
  return candidateReceipts(receipts, transactions, now).filter((r) => normAmount(r.total) === amount);
}

/** Normalised totals of all candidate receipts; a transaction with one of these is shown green. */
export function greenAmounts(
  receipts: ReceiptLike[],
  transactions: TransactionLike[],
  now: Date = new Date(),
): Set<string> {
  return new Set(candidateReceipts(receipts, transactions, now).map((r) => normAmount(r.total)));
}

/** `receipt_date|total|work_order|tenant_address`, nulls as empty. */
export function duplicateKey(r: Omit<ReceiptLike, 'id'>): string {
  return [r.receipt_date, r.total, r.work_order, r.tenant_address].map((v) => v ?? '').join('|');
}

/** Ids of receipts that share their duplicate key with at least one other receipt. */
export function duplicateIds(receipts: ReceiptLike[]): Set<string> {
  const byKey = new Map<string, string[]>();
  for (const r of receipts) {
    const key = duplicateKey(r);
    const list = byKey.get(key);
    if (list) list.push(r.id);
    else byKey.set(key, [r.id]);
  }
  const ids = new Set<string>();
  for (const list of byKey.values()) {
    if (list.length > 1) list.forEach((id) => ids.add(id));
  }
  return ids;
}
