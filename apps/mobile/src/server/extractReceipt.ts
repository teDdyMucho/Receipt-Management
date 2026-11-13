import { parseReceiptFields, type ExtractedFields } from '@lionrock/shared';

// SERVER ONLY. Reads a receipt with OpenAI and returns the four wizard fields.
// The API key comes from the server environment and never reaches the app.

const PROMPT = `You are an expert at reading receipts for a property management company.
Read ALL visible text on the receipt, printed and handwritten, and extract these fields.
Do not guess. If a field is not clearly visible, return null for it.

- receipt_date: the purchase date printed on the receipt, as YYYY-MM-DD.
- total: the final total actually paid (after tax), digits and decimal point only, for example "41.17".
- work_order: a work order number, usually handwritten on the receipt or written near "WO" or "Work Order". Return it exactly as written.
- tenant_address: a property or tenant address written on the receipt (often handwritten). This is NOT the store's address.

Handwritten notes: staff often write a short note on the receipt instead of a work order number or an address, for example "Gas Enrique" or "Andy fuel". When there is such a note and no work order number, put the note in work_order. When there is such a note and no property address, put the same note in tenant_address. Copy the note exactly as written.
The date is often printed in small text at the very bottom of the receipt, next to the time. First copy the whole printed line that contains the date into date_line, character by character, then take receipt_date from it. Receipts are almost always from the last few weeks before today.

Answer with one JSON object only:
{"date_line": string|null, "receipt_date": string|null, "total": string|null, "work_order": string|null, "tenant_address": string|null}`;

export class ExtractError extends Error {
  constructor(
    message: string,
    public status: number,
    public code: string,
  ) {
    super(message);
  }
}

const ALLOWED = ['image/jpeg', 'image/png', 'application/pdf'];
/** About 8 MB of file, as base64. */
const MAX_BASE64_LENGTH = 11_500_000;

/** Keeps a date only when it is a real YYYY-MM-DD. */
function cleanDate(value: string | null): string | null {
  if (!value) return null;
  const iso = /^(\d{4})-(\d{2})-(\d{2})/.exec(value.trim());
  if (iso) return `${iso[1]}-${iso[2]}-${iso[3]}`;
  const us = /^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/.exec(value.trim());
  if (us) return `${us[3]}-${us[1]!.padStart(2, '0')}-${us[2]!.padStart(2, '0')}`;
  return null;
}

/** "$1,041.17" -> "1041.17" */
function cleanTotal(value: string | null): string | null {
  if (!value) return null;
  const cleaned = value.replace(/[^0-9.]/g, '');
  return /^\d+(\.\d+)?$/.test(cleaned) ? cleaned : null;
}

/**
 * A PDF that is just one photo (what the old screen and our own converter
 * produce) is read much better as the photo itself: small print such as the
 * date survives. Returns the embedded JPEG as base64, or null for other PDFs.
 */
function singleJpegFromPdf(base64: string): string | null {
  const pdf = atob(base64); // one character per byte
  const first = pdf.indexOf('/DCTDecode');
  if (first < 0 || pdf.indexOf('/DCTDecode', first + 1) >= 0) return null;
  const start = pdf.indexOf('\xff\xd8\xff');
  const end = pdf.lastIndexOf('\xff\xd9');
  if (start < 0 || end <= start) return null;
  return btoa(pdf.slice(start, end + 2));
}

/** A date the AI read is kept only when it is plausible: not in the future, not over a year old. */
function plausibleDate(value: string | null, now: Date = new Date()): string | null {
  if (!value) return null;
  const time = new Date(`${value}T00:00:00Z`).getTime();
  if (Number.isNaN(time)) return null;
  const day = 24 * 60 * 60 * 1000;
  return time <= now.getTime() + day && time >= now.getTime() - 366 * day ? value : null;
}

export async function extractReceipt(contentType: string, base64: string): Promise<ExtractedFields | null> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new ExtractError('AI extraction is not configured on the server.', 503, 'not_configured');
  if (!ALLOWED.includes(contentType)) throw new ExtractError('Unsupported file type.', 400, 'bad_content_type');
  if (!base64 || base64.length > MAX_BASE64_LENGTH) throw new ExtractError('File is missing or too large.', 400, 'bad_file');

  if (contentType === 'application/pdf') {
    const photo = singleJpegFromPdf(base64);
    if (photo) {
      contentType = 'image/jpeg';
      base64 = photo;
    }
  }

  const dataUrl = `data:${contentType};base64,${base64}`;
  const filePart =
    contentType === 'application/pdf'
      ? { type: 'file', file: { filename: 'receipt.pdf', file_data: dataUrl } }
      : { type: 'image_url', image_url: { url: dataUrl, detail: 'high' } };

  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({
      model: process.env.OPENAI_MODEL || 'gpt-4o',
      response_format: { type: 'json_object' },
      messages: [
        {
          role: 'user',
          content: [{ type: 'text', text: `${PROMPT}\n\nToday is ${new Date().toISOString().slice(0, 10)}.` }, filePart],
        },
      ],
    }),
  });

  if (!response.ok) {
    const detail = await response.text().catch(() => '');
    console.error('[extract] OpenAI error', response.status, detail.slice(0, 300));
    throw new ExtractError('The AI service could not read this receipt.', 502, 'ai_failed');
  }

  const data = (await response.json()) as { choices?: { message?: { content?: string } }[] };
  const fields = parseReceiptFields(data.choices?.[0]?.message?.content ?? null);
  if (!fields) return null;

  const cleaned: ExtractedFields = {
    receipt_date: plausibleDate(cleanDate(fields.receipt_date)),
    total: cleanTotal(fields.total),
    // "WO 48213-2" or "Work Order: 48213-2" -> "48213-2"
    // Only when a number follows, so a note such as "Wood St" is left alone.
    work_order: fields.work_order?.replace(/^(work\s*order|w\.?o\.?)(?=[\s#:.-]*\d)[\s#:.-]*/i, '').trim() || null,
    tenant_address: fields.tenant_address,
  };
  return Object.values(cleaned).some((v) => v !== null) ? cleaned : null;
}
