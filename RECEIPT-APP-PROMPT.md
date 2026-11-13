# Build prompt: LionRock Receipt Management (Expo mobile app, iOS and Android, + web workspace + API)

> **How to use:** Fill in the `[FILL IN]` parts in section 0. Then paste this whole file into your AI coding tool (Claude Code, Cursor, etc.), or put it in the new project folder and say: "Read RECEIPT-APP-PROMPT.md and start with Phase 0." Build one phase at a time (section 10) and test it before moving on.

---

## 0. Project details

Already filled in from the current system. Change only what is wrong.

- Company / app name: Lion Rock Property Management, app **Receipts** (full name **LionRock Receipts**)
- What exists today: a React + Vite web screen inside the internal dashboard at `/receipt-management`, used from phones as a PWA through personal links. The new product is a **native mobile app** for field staff and vendors, a **web workspace** for the office, and an **API** they both use.
- Backend today: Netlify Functions (Node) plus n8n workflows (AI extraction, AppFolio email, SMS).
- Database: Supabase (Postgres). Tables `receipt`, `receipt_access_links`, `card_transaction` (section 5).
- Files today: PDF bytes in the `receipt.image` column, in a mix of formats (hex bytea, raw base64, data URL, http URL). New files go to Supabase Storage.
- Logins today: internal staff through the Supabase RPC `login_user(p_email, p_password)` which returns the user row with `role`; field staff and vendors through personal links `/receipt-management?access=NAME`, no login.
- Phones used by field staff: **iPhone and Android**. iPhone first.
- Receipts per user per day: `[FILL IN]`. A photo is 2 to 5 MB raw, compressed to under 1 MB before upload.
- Max accepted upload size: `[FILL IN, default 8 MB]`
- "Stale device" threshold for the Sync tab: `[FILL IN, default 2 hours]`
- Apple Developer Program account and Team ID: `[FILL IN: yes/no, Team ID]`
- Google Play Console account: `[FILL IN: yes/no]`
- Expo account (for EAS Build, Submit and Update): `[FILL IN]`
- Bundle identifier / Android package: `com.lionrock.receipts` `[confirm]`
- iOS distribution: `[FILL IN: App Store public / App Store unlisted link / TestFlight only]`. Vendors are outside the company, so TestFlight-only is a stopgap (90-day builds, 10k testers).
- Web domain that will host the landing page, universal links and the API: `[FILL IN, the current app domain]`

---

## 1. Your role and how to work

You are a senior React Native and backend engineer. Build the mobile app, the web workspace, the serverless API and the database migration described below.

1. **Ask questions first** if anything in section 0 is missing or unclear. Do not guess.
2. Work **one phase at a time** (section 10). At the end of each phase stop, summarise what you built, list how to test it, and wait for an OK.
3. **Reuse** the existing Supabase project, tables, login RPC and n8n workflows. Do not rebuild them.
4. **Never delete, rename or overwrite** existing tables, columns or rows. Migrations only add columns, tables, indexes and policies. The old screen keeps reading the same tables during the transition.
5. **n8n never writes to the database or to file storage.** Every insert, update, delete and file write goes through our own API (section 6). n8n is called only by our server, only for AI extraction, AppFolio email and SMS, and it returns a result; it does not touch Supabase. The old `/webhook/save` is not used by the new app at all.
6. **iOS is a first-class target, not a port.** Every phase is tested on a real iPhone through a development build or TestFlight, not only on Android or a simulator.
7. Where this document says MUST, do exactly that. Where it says MAY, pick a sensible default and record it in `CHANGES.md`.
8. Clean, commented code. A README that explains setup, the identities, the sync engine, EAS builds and how to deploy the web and the API to Netlify.

---

## 2. The problem we are solving

Today a receipt goes: take photo in the browser → send to n8n for AI extraction → confirm fields in a wizard → send file and fields to n8n `/webhook/save` → n8n inserts the `receipt` row some seconds later → the page reloads the list at 3 s and 7 s and hopes the row appears. "Success" is any 2xx whose body does not contain the word "error".

Ways a receipt is lost or duplicated today:
- The signal drops, or Safari or the home-screen app is closed, during the upload. Nothing is kept on the phone, so the receipt is gone.
- n8n accepts the request but the Supabase insert fails, and the page still shows success.
- A retry after a timeout creates a second row.
- Nobody can see that a receipt is missing: the phone keeps no record and the office sees only rows that made it.
- A browser cannot upload in the background on iPhone. A native app can.

**Goal:** no receipt is ever lost. Every receipt exists on the phone and on the server, the file reaches the server even before the details are confirmed, uploads keep going when the phone is locked or the app is in the background, and both the field user and the office can see the status of every receipt. The rest of the workflow (review, archive, AppFolio email, access links, card-transaction matching) keeps working exactly as staff know it.

**Decision already made:** the database and the file storage are written only by our own API. n8n is no longer in the save path. It is kept as a helper that our server calls for AI extraction, AppFolio email and SMS, and nothing else.

---

## 3. Tech stack (decided; change only if Phase 0 finds a blocker)

### Monorepo

```
apps/mobile        Expo app (iOS + Android), TypeScript, Expo Router
apps/web           React + Vite + Tailwind: office workspace + the landing page for access links
packages/shared    types, API client, pure logic (receipt fields parser, matching, formats, backoff), Vitest
netlify/functions  the API (Node), one file per endpoint, _lib/ shared
sql/               additive migrations, run by hand
```

npm workspaces. Netlify deploys `apps/web` and `netlify/functions`. The mobile app ships with EAS.

### Mobile app (apps/mobile)
- **Expo SDK, latest stable**, Expo Router, TypeScript, `expo-dev-client` for development builds (the sync engine needs native modules that Expo Go does not have).
- `expo-image-picker` (camera and photo library, native UI), `expo-document-picker` (PDF receipts), `expo-image-manipulator` (resize, compress, rotate, HEIC to JPEG).
- `expo-file-system`: private storage for the receipt files, and **upload tasks with `sessionType: BACKGROUND`** on iOS so an upload survives backgrounding and locking.
- `expo-sqlite`: local receipt store and upload queue.
- `expo-crypto`: UUIDs and SHA-256.
- `@react-native-community/netinfo`: online/offline and connection type.
- `expo-background-task` + `expo-task-manager`: periodic wake-ups to drain the queue (iOS decides the schedule; this is a supplement, not the main path).
- `expo-secure-store`: the staff session token and the access NAME.
- `expo-updates` with EAS Update: JavaScript fixes ship without a store review.
- `expo-linking` with universal links (iOS) and App Links (Android) so the existing `/receipt-management?access=NAME` URLs open the app.
- Builds and submission with **EAS Build** and **EAS Submit**; TestFlight for testing.
- No PDF generation on the phone. The phone uploads the compressed JPEG (or a picked PDF); the server converts images to PDF (section 4.4).

### Web workspace (apps/web)
React 18 + TypeScript + Vite, Tailwind, react-router-dom, `pdfjs-dist` for the viewer, `@supabase/supabase-js` with the **anon key only** for the list reads, as today.

### API (netlify/functions)
Node, Supabase **service-role key** (server env var, never `VITE_`), `pdf-lib` for image to PDF, private Storage bucket `receipts`.

### n8n
**n8n stays** for three things only, and only as something our server calls: AI field extraction (`/webhook/upload`), AppFolio email (`/webhook/send-email-reciept-toappfolio`) and SMS (`/webhook/SMS`). n8n does not insert, update or store anything. `/webhook/save` is retired: nothing in the new code calls it. If Phase 0 finds that the old save workflow also did something else (for example a copy to a shared drive), that step is rebuilt inside our API or dropped with the owner's OK, never kept as an n8n database write.

### Env vars

```
# apps/web (browser)
VITE_SUPABASE_URL=
VITE_SUPABASE_ANON_KEY=
VITE_API_BASE_URL=            # same origin in production
VITE_APP_VERSION=
# apps/mobile (public, baked into the build through app.config.ts)
EXPO_PUBLIC_API_BASE_URL=
EXPO_PUBLIC_APP_VERSION=
# netlify/functions (server only)
SUPABASE_URL=
SUPABASE_SERVICE_ROLE_KEY=
N8N_BASE_URL=https://primary-production-10cb1.up.railway.app
N8N_FALLBACK_URL=https://primary-production-320b8.up.railway.app
SESSION_SECRET=
```

The mobile app holds no Supabase key at all. It talks only to our API. No file over 500 lines anywhere in the repo.

---

## 4. How the sync must work (core logic, do not change)

### 4.1 Capture and save locally first
1. The user takes a photo, picks one from the library, or picks a PDF.
2. **Before any network call** the app: processes the file (section 9: resize, compress, HEIC to JPEG), copies it into the app's private documents folder (excluded from iCloud backup, `receipts/<client_uuid>.<ext>`), creates `client_uuid`, computes the SHA-256 of the bytes, and inserts a row in SQLite `local_receipts` with `sync_status = pending`.
3. The receipt appears in the **Uploads** list immediately, even in airplane mode.

### 4.2 Register a small metadata record first
- When online, `POST /api/receipts/register` with `client_uuid`, the identity (access NAME or staff user), `device_id`, `taken_at`, `file_name`, `content_type`, `file_size`, `checksum_sha256`, and whatever details are already confirmed.
- The server creates the `receipt` row with `sync_status = pending_on_device`. The office sees receipts that exist on a phone **before the file arrives**.
- Idempotent by `client_uuid`: a second register returns the existing row and never creates a duplicate.

### 4.3 Upload the file from the queue
- One worker, one receipt at a time, oldest first. Status becomes `uploading`.
- `PUT /api/receipts/{client_uuid}/file` with the raw file body (`Content-Type: image/jpeg` or `application/pdf`, header `X-Checksum-SHA256`), sent with an `expo-file-system` upload task using `uploadType: BINARY_CONTENT` and, on iOS, `sessionType: BACKGROUND`. The task keeps running when the user leaves the app or locks the phone.
- Files over the section 0 limit are rejected on the phone before queuing (compress harder, then tell the user).

### 4.4 Server confirms only after everything is saved
In this order:
1. Hash the received bytes and compare with the checksum from register and the header. Mismatch = 400, nothing stored.
2. If the body is an image, convert it to a single-page PDF with `pdf-lib` (page sized to the image). Write the original image to `receipts/<yyyy>/<mm>/<client_uuid>.jpg` and the PDF to `receipts/<yyyy>/<mm>/<client_uuid>.pdf` (upsert). A PDF body is stored as is.
3. Update the `receipt` row: `storage_path` (the PDF), `original_path` (the image, if any), `file_size`, `sync_status = synced`, `synced_at`.
4. Only if 1 to 3 succeeded, return `200 { client_uuid, receipt_id, checksum, status: "synced" }`.
5. If step 3 fails, delete the objects written in step 2 and return 5xx. If the row is already `synced` with the same checksum, return 200 with the same body (idempotent).

### 4.5 Phone marks synced only after confirmation
- Local `sync_status` becomes `synced` only after the 200 arrives and the returned checksum matches the local one.
- Timeout, error, or the app being killed: the status stays `pending` (or returns to `pending` from `uploading`) and the receipt is retried.
- **Reconciliation on launch and on foreground:** for every local row in `uploading`, and for `pending` rows that were registered, call `GET /api/receipts/{client_uuid}/status`. If the server says `synced` with the same checksum, mark it synced locally. This covers the iOS case where a background upload finished but the app never saw the response.

### 4.6 Automatic retry
- Exponential backoff: 30 s, 1 min, 2 min, 5 min, 10 min, then every 30 min.
- After 10 failed attempts the status becomes `failed`, the app calls `POST /api/receipts/{client_uuid}/failed` with the last error, and the user sees a **Retry** button. Manual retry resets the counter. Retries are safe because of `client_uuid`.

### 4.7 When syncing runs
- On app launch and when the app returns to the foreground.
- When NetInfo reports the connection is back.
- On **Sync now**.
- Background: iOS and Android background upload sessions finish the in-flight file by themselves; `expo-background-task` wakes the app periodically (iOS allows roughly every 15 minutes or more, not guaranteed) to start the next file and send a heartbeat.
- A local notification "2 receipts are still waiting to upload" when the app goes to the background with pending receipts and no connection (asks for notification permission once, at that moment, with a plain explanation).
- Setting **Upload on Wi-Fi only** (NetInfo connection type).

### 4.8 Heartbeat
- Whenever the app is online (launch, foreground, after each sync run, from the background task; at most once a minute): `POST /api/devices/heartbeat` with `device_id`, identity, `app_version`, platform and OS version, and counts of pending, uploading and failed receipts. The office uses this for "Last seen" and to spot phones still holding receipts.

### 4.9 Details and AI extraction (two independent states)
A receipt has a **file state** (`pending`, `uploading`, `synced`, `failed`) and a **details state** (`details_confirmed` true or false). The file never waits for the details.

- **Online:** capture → local save → register → file upload (a compressed JPEG takes one to three seconds) → `POST /api/receipts/{client_uuid}/extract` (the server fetches the stored PDF, calls n8n `/webhook/upload`, stores `extracted_fields` on the row, returns them) → the Receipt Data wizard opens pre-filled → **Done** sends `PATCH /api/receipts/{client_uuid}/details` with `details_confirmed = true`. If extraction fails or takes over 20 s, the wizard opens empty; the user can still type.
- **Offline:** capture → local save → the wizard opens empty; the user may fill it now or tap **Later**. Details are stored locally and sent with register or with a later PATCH. When the file syncs without confirmed details, the server runs extraction and stores `extracted_fields`; the Uploads list shows **Needs details** with an **Add details** button that opens the wizard pre-filled.
- Extraction is best effort and never blocks the file sync. In the office Receipts table a row with `details_confirmed = false` shows a **Needs details** badge and staff can fill it in with **Edit**.

### 4.10 Local copy retention
- Keep the local file after sync. Setting **Delete synced receipts from this phone after N days** (default 14; 0 = keep forever). Only `synced` receipts are ever deleted locally, never `pending` or `failed`. Show storage used in Settings.

---

## 5. Data model

### 5.1 Phone: SQLite table `local_receipts` (key `client_uuid`)

| column | notes |
|---|---|
| client_uuid | TEXT primary key, created on the phone |
| identity | the access NAME, or the staff user name |
| local_path, file_name, content_type, file_size, checksum_sha256 | the processed file |
| taken_at | ISO |
| details_json | `{ type, type_other, receipt_date, total, work_order, tenant_address }` |
| details_confirmed | 0/1 |
| extracted_json | from the server, when available |
| sync_status | `pending`, `uploading`, `synced`, `failed` |
| registered | 0/1 |
| attempts, next_retry_at, last_error | retry state |
| upload_task_id | the native upload task, for resuming after relaunch |
| server_receipt_id, synced_at | after confirmation |

Tables `settings` (wifi_only, cleanup_days, device_id, identity, identity_kind) and `events` (client_uuid, at, message) for the status history shown on the detail screen.

### 5.2 Server: existing table `receipt` (keep every column) plus new columns

Existing: `id` uuid, `receipt_date` text `YYYY-MM-DD`, `total` text (may start with `$`), `work_order` text, `tenant_address` text, `type` text (`renovation`, `turn_over`, `work_order`, or free text when Other), `type_other` text, `link` text (full access URL), `user` text (access NAME), `image` (legacy PDF: hex bytea, base64, data URL or http URL), `done_status` boolean, `created_at` timestamptz.

New (additive migration, all nullable):

| column | notes |
|---|---|
| `client_uuid` uuid | **unique index**, null on legacy rows |
| `device_id` text, `app_version` text, `platform` text | |
| `file_name` text, `content_type` text, `file_size` int, `checksum_sha256` text | from register and verified on upload |
| `storage_path` text | the PDF in Storage |
| `original_path` text | the original image in Storage, when the source was a photo |
| `sync_status` text | `pending_on_device`, `uploading`, `synced`, `failed`; null on legacy rows means synced |
| `details_confirmed` boolean | migration sets true on legacy rows; false on new rows until the wizard is done |
| `extracted_fields` jsonb | AI output |
| `registered_at`, `synced_at` timestamptz | |
| `attempts` int, `last_error` text | reported by the phone |
| `emailed_to_appfolio_at` timestamptz | makes Send idempotent |

Never select `image` in list queries. Load it only for the viewer of one legacy row.

### 5.3 Server: new table `receipt_devices`
`device_id` text primary key, `identity` text, `platform` text, `os_version` text, `app_version` text, `last_seen_at` timestamptz, `pending_count` int, `uploading_count` int, `failed_count` int.

### 5.4 `receipt_access_links` (existing) plus `disabled_at` timestamptz
Columns today: `id`, `link_name` (unique case-insensitively), `access_token` (same value), `url`, `created_by`, `created_at`. A link with `disabled_at` set is rejected by the API and the app shows "This access name is no longer active".

### 5.5 `card_transaction` (existing, unchanged)
`id`, `cardholder_name`, `account_ending`, `transaction_amount` (text, may start with `$`), `transaction_date`, `merchant_name`, `alert_type`, `alert_message`, `notification_threshold`, `receipt_id` (uuid, null until matched), `created_at`. Rows are inserted by an external email parser. The workspace reads, sets `receipt_id`, and deletes.

### 5.6 Storage
Private bucket `receipts`. Objects at `receipts/<yyyy>/<mm>/<client_uuid>.pdf` and `.jpg`. Clients never get a permanent URL; they ask the API for a signed URL valid 10 minutes.

### 5.7 Migration rules
One file `sql/receipt_sync_v1.sql`, idempotent (`add column if not exists`, `create table if not exists`, `create unique index if not exists`). It is run by hand in the Supabase SQL editor; never from the app or CI. Rollback statements as comments.

---

## 6. API (Netlify Functions under `/api`, HTTPS only)

**Identities and auth**
- **Field identity:** header `X-Access-Name: NAME`. The function checks the NAME exists in `receipt_access_links` and is not disabled, and only allows rows whose `user` equals that NAME. `POST /api/access/verify` lets the app validate a NAME on first launch and returns the display name.
- **Staff identity:** `Authorization: Bearer <session token>`. `POST /api/auth/login` calls the existing RPC `login_user` and returns a signed token (HMAC with `SESSION_SECRET`, 30 days for the mobile app, 12 h for the web) with user id, name and role. Admin-only endpoints check `role = admin`.
- Rate-limit register, file and heartbeat per identity (for example 120 calls per 10 minutes) and log rejects.

| Method and path | Who | Purpose |
|---|---|---|
| `POST /api/auth/login` | staff | Existing login, returns session token |
| `POST /api/access/verify` | field | Check an access NAME; returns `{ ok, display_name }` or 404 / 410 (disabled) |
| `POST /api/receipts/register` | field, staff | Metadata record. Idempotent by `client_uuid`. Returns the row |
| `PUT /api/receipts/{client_uuid}/file` | field, staff | Upload the JPEG or PDF. Verify checksum, convert, store, update row, then confirm (4.4) |
| `POST /api/receipts/{client_uuid}/extract` | field, staff | Run AI extraction on the stored PDF through n8n; store and return `extracted_fields` |
| `PATCH /api/receipts/{client_uuid}/details` | field, staff | Save the wizard fields, set `details_confirmed`. Idempotent |
| `GET /api/receipts/{client_uuid}/status` | field, staff | Server state for reconciliation |
| `POST /api/receipts/{client_uuid}/failed` | field, staff | Report a receipt that failed after max retries |
| `GET /api/receipts/mine?limit=&before=` | field | This identity's receipts (for the Uploads history, including rows made before this app) |
| `GET /api/receipts/{id}/file-url` | field (own rows), staff | Signed URL for the PDF; legacy rows return `{ legacy: true }` and the web viewer reads `image` |
| `DELETE /api/receipts/{id}` | field (own rows), staff | Delete row and objects |
| `POST /api/receipts/{id}/email-appfolio` | staff | Calls n8n, sets `emailed_to_appfolio_at` and `done_status = true`. A second call returns `already_sent` unless `force: true` |
| `POST /api/devices/heartbeat` | field, staff | Last seen and counts |
| `POST /api/links/sms` | admin | Calls n8n `/webhook/SMS` |
| `GET /api/admin/sync-summary` | staff | Totals: synced, still on phones, failed, needs details |
| `GET /api/admin/devices` | staff | Per device and identity: counts, last seen, platform, app version |
| `GET /api/admin/receipts?sync_status=&user=&date=` | staff | Filtered list for the Sync tab |

Validation: the file endpoint accepts `image/jpeg`, `image/png` and `application/pdf` only (the phone converts HEIC to JPEG); max size from section 0; reject checksum mismatches; every endpoint returns JSON errors `{ error, code }`. Netlify functions have a request body limit of about 6 MB; if the section 0 limit is higher, switch the file endpoint to a signed direct-to-Storage upload issued by `POST /api/receipts/{client_uuid}/upload-url`, followed by `POST /api/receipts/{client_uuid}/confirm` that performs steps 1 to 5 of 4.4 against the stored object.

Web workspace list reads (Receipts, Archive, Links, Card Transactions, Match) MAY keep using the Supabase anon client directly as today. Writes that must be atomic (file confirm, email, delete) go through the API.

---

## 7. n8n contract (kept, called from the server only)

Try `N8N_BASE_URL + path`, then once `N8N_FALLBACK_URL + path` on a network error or non-2xx.

- `POST /webhook/upload` — body `{ fileName, contentType: "application/pdf", base64, mimeType, base64_no_prefix, originalImageBase64, originalMimeType, originalBase64_no_prefix }` (original image fields empty when the source was a PDF). The response can be an object, an array of items, an item with the object under `output`, `text_sample`, `receipt data` or `receipt_data`, a stringified JSON, or JSON inside markdown fences. `parseReceiptFields(raw)` in `packages/shared` unwraps all of these into `{ receipt_date, total, work_order, tenant_address }` or returns null.
- `POST /webhook/send-email-reciept-toappfolio` — `{ uuid: receipt.id }`. Keep the misspelling in the path.
- `POST /webhook/SMS` — `{ name, url, access, phone, creator, createdAt }`.
- `POST /webhook/save` is **retired**. Nothing in the new code calls it. All receipt rows and files are written by our API (sections 4 and 6). Neither the mobile app nor the browser calls n8n directly; only the functions do, and only for the three webhooks above.

---

## 8. Screens

Keep these labels; staff are trained on them.

### 8.1 Who sees what

| Surface | Who | What they see |
|---|---|---|
| Mobile app, access NAME | Field staff and vendors | **Scan**, **Uploads**, **Settings** |
| Mobile app, staff sign-in | Internal staff in the field | Same three screens, receipts saved under their user name |
| Web workspace, signed in | Office staff | Tabs **Scan**, **Receipts**, **Archive**, **Links**, **Card Transactions**, **Match**, **Sync** |
| Web workspace, role `admin` | Admin | Plus **SMS**, **Disable link**, **Show QR** on each link |
| Web landing page `/receipt-management?access=NAME` | Anyone with a link | Opens the app if installed (universal link); otherwise App Store and Play Store buttons, a QR code, and the NAME shown so they can type it on first launch |

### 8.2 Mobile: first launch
- Two choices: **I have an access name** (text field; validated with `/api/access/verify`; saved in SecureStore) and **Staff sign in** (email and password through `/api/auth/login`).
- Opening a universal link `…/receipt-management?access=NAME` skips the typing and verifies that NAME.
- Ask for camera and photo-library permission only when the user first taps **Take a picture** or **Choose from library**, with the reasons in `app.json` (`NSCameraUsageDescription`, `NSPhotoLibraryUsageDescription`): "Receipts uses the camera to photograph receipts for upload."

### 8.3 Mobile: Scan
- Big **Take a picture**, **Choose from library**, **Pick a PDF**.
- Preview with **Rotate** (90 degrees per tap), crop through the native picker's editing, **Retake**.
- **Save receipt**: runs 4.1 then 4.9. A full-width status card: "Saved on this phone", then "Uploading 64%", then "On server". Then the wizard opens (or the **Later** choice when offline).
- An **Offline** banner: "No connection. Receipts are saved on this phone and will upload automatically."

### 8.4 Mobile: Receipt Data wizard (one field per step, Back / Next / Done, plus Later)
1. **Type**: Renovation, Turn Over, Work Order, Other (text box for the label, required). Default Work Order.
2. **Receipt Date** (native date picker). 3. **Total** (numeric keypad). 4. **Work order** (shown and required only for Turn Over and Work Order). 5. **Tenant Address**. 6. **Review**, then **Done**.
Validation on Done: date, total, address required; work order for the two types; Other label. Pre-filled fields show "Suggested by AI".

### 8.5 Mobile: Uploads
- Summary line: "12 synced, 1 uploading, 2 pending, 1 failed". Filter chips **All / Pending / Synced / Failed / Needs details**. **Sync now**. Pull to refresh.
- Card per receipt, newest first: thumbnail, date, total, work order, address, type colour, and a status badge: **Pending** (yellow), **Uploading** (blue, percent), **Synced** (green), **Failed** (red, **Retry**), plus **Needs details** (**Add details**).
- Older server rows for this identity (from `/api/receipts/mine`) appear below the local ones so history from before this app stays visible.
- Detail screen: large preview (local file, or signed URL after cleanup), status history, last error, **Retry**, **Delete** (confirm; deleting a pending receipt warns twice because the server has no copy).

### 8.6 Mobile: Settings
Identity ("Scanning as NAME" or the staff name) with **Change**, **Sync now**, **Upload on Wi-Fi only**, **Delete synced receipts from this phone after N days**, storage used, **Check for updates** (EAS Update), device id (short), app version and build number, **Send diagnostics** (exports the events log as text).

### 8.7 Web: Scan
Drag and drop, **Choose file** (PDF, PNG, JPG), **Take a picture** (webcam). Same API flow (register → file → extract → wizard → details) with `client_uuid`, without an offline queue. Used by the office for emailed or scanned receipts.

### 8.8 Web: Receipts (`done_status` not true)
- Toolbar: search, **All Users** dropdown, Type chips **All / Renovation / Turn Over / Work Order / Other**, rows per page 10 / 50 / 100, **Previous** / **Next**.
- Columns: row number, Receipt Date, Upload Date (`MM/DD/YYYY hh:mm AM`), Total, Work order, Tenant Address, User, Status, Email, Actions. Sortable: Receipt Date, Upload Date, Total, Work order, Tenant Address. Default Receipt Date descending.
- Row colours by Type: Renovation emerald, Turn Over amber, Work Order indigo, Other slate. Status shows **On phone**, **Uploading**, **Needs details**, or nothing. A row whose file is still on a phone cannot be emailed.
- Duplicate badge: amber `!` beside the row number when another receipt has the same `receipt_date`, `total`, `work_order` and `tenant_address`.
- Row click opens the viewer (8.14). **Send** calls the email endpoint, shows "Sent", moves the row to Archive; an already-sent row shows "Sent on <date>" and **Resend**. **Edit** (date, total, work order, address, type; sets `details_confirmed = true`), **Done**, **Delete** (confirm).

### 8.9 Web: Archive (`done_status = true`)
Same table without the Email column; **Restore** instead of Done.

### 8.10 Web: Links
- **Name** + **Generate link**: at least one letter or digit; unique case-insensitively against `receipt_access_links` ("A link named “X” already exists." modal); insert and show the URL with **Copy link** and **Show QR** (the QR encodes the universal link).
- List of links, newest first, search and paging. Per link: **Copy**, **Open**, **Delete**, admin **SMS** (modal with phone number, calls `/api/links/sms`), admin **Disable** / **Enable** (`disabled_at`). Shows creator; links made from this browser show "You". A column **Devices** shows how many phones last reported with that NAME.

### 8.11 Web: Card Transactions (`receipt_id` is null)
Columns Cardholder, Account (last 4), Amount, Date, Merchant, Alert (popup with `alert_message`), Delete (confirm). Green rows have a candidate receipt (section 9). Search, rows per page, **Refresh**, paging. Row click opens **Matching Receipts**: candidates with date, work order, address, **Preview**, **Match** checkbox that sets `receipt_id` and moves the pair to Match.

### 8.12 Web: Match (`receipt_id` set)
Transaction (cardholder, account, amount, merchant) beside the receipt (date, work order, address). Search, paging, red **x** to unmatch (`receipt_id = null`). Missing receipts show blank columns.

### 8.13 Web: Sync (the admin dashboard, inside the workspace)
1. Summary cards: **On server**, **Still on phones**, **Failed**, **Needs details**.
2. Devices table: identity, platform and OS, app version, synced / pending / failed counts, **Last seen**. Red when last seen is older than the section 0 threshold and pending or failed is above zero.
3. Receipts list filtered by status, user and date, with thumbnails and the viewer.
4. Failed list with the error text and the identity so the office can call the person.
5. Auto-refresh every 60 s while the tab is open.

### 8.14 Web: viewer modal
- New rows: `/api/receipts/{id}/file-url`, rendered with pdfjs (**Prev** / **Next**, page counter, **Download**).
- Legacy rows: load the `image` column for that one row and detect the format: `\x` prefix = hex bytea; `data:image/` = image; `data:application/pdf` or base64 starting `JVBERi0` = PDF; other base64 = sniff JPEG `/9j/`, PNG `iVBORw0`, WEBP, GIF; `http(s)` = fetch and detect.
- Resizable on desktop, errors shown inside the modal.

### 8.15 Getting the app (replaces the old "install to home screen" flow)
- The web landing page at `/receipt-management?access=NAME` (8.1) with store buttons and the QR. Serve `/.well-known/apple-app-site-association` and `/.well-known/assetlinks.json` from `apps/web` so the link opens the app directly when installed.
- The SMS sent from the Links tab carries the same universal link.
- The old PWA stays reachable at `/receipt-management/legacy` during the cutover week, then is removed.

---

## 9. Client-side rules (pure functions in `packages/shared` unless platform-bound, unit tested)

- **Image processing (mobile, `expo-image-manipulator`).** Resize so the longest side is 1600 px (1200 px for camera captures), JPEG quality starting 0.85 (0.75 for captures), lowering by 0.1 until the file is under 900 KB (400 KB for captures) or quality reaches 0.5. HEIC and PNG photos are re-encoded as JPEG. Apply the user's rotation before saving. PDFs pass through untouched.
- **Checksum.** SHA-256 hex of the exact bytes that will be uploaded, computed once and stored with the local row.
- **PDF conversion (server, `pdf-lib`).** One page sized to the image in points at 72 dpi, image embedded as JPEG, no re-encoding.
- **Amount normalisation (`matching.ts`).** `normAmount(s) = s.replace(/^\$/, '').trim()`; amounts match only when the normalised strings are identical.
- **Match candidates.** Same normalised amount, receipt not already referenced by any `card_transaction.receipt_id`, and `receipt_date` null or within the last two days (local midnight).
- **Green highlight.** Set of normalised totals of all candidate receipts.
- **Duplicate key.** `receipt_date|total|work_order|tenant_address`, nulls as empty.
- **Dates.** `receipt_date` as `MM/DD/YYYY` from the leading `YYYY-MM-DD`; `created_at` as `en-US` date plus 12-hour time.
- **Access NAME.** From a bare name or a URL with `?access=`.
- **Backoff schedule.** `nextRetryAt(attempts)` returning the section 4.6 delays.
- **Queue ordering and crash recovery.** Oldest `taken_at` first; on launch, `uploading` rows are reconciled with `/status` (4.5) and otherwise treated as `pending`.

---

## 10. Build phases (stop after each one for review)

- **Phase 0, investigate:** read the current `ReceiptManagement.tsx` and the n8n `save` workflow export; list every side effect of `/webhook/save` so each one is either rebuilt in our API or dropped (the n8n write path itself is not kept); check Netlify function body and timeout limits on this plan; confirm how staff sessions exist today; list the `image` formats present in `receipt` (give me a SQL query to run, do not query production yourself); confirm the Apple and Google accounts, bundle id and distribution choice from section 0. Report why receipts go missing today and any quick fixes.
- **Phase 1, server:** `sql/receipt_sync_v1.sql`, the bucket, `packages/shared`, the functions in section 6 with checksum, PDF conversion and confirm logic, session tokens, access verify, and automated tests for idempotent register, checksum mismatch, row-update failure cleanup, image to PDF, and double email.
- **Phase 2, mobile core:** Expo project with a development build, first launch and identities, Scan, image processing, SQLite store, Uploads list with statuses, wizard with Later, Settings. Works fully offline. Runs on a real iPhone and a real Android phone.
- **Phase 3, sync engine:** register → file → confirm → extract → details, background upload sessions on iOS and Android, reconciliation on launch, backoff, NetInfo listener, background task, heartbeat, local notification, local cleanup.
- **Phase 4, web workspace:** login, Scan, Receipts, Archive, Links (with QR and devices column), Card Transactions, Match, Sync tab, viewer with legacy formats, landing page with universal-link files.
- **Phase 5, release and cutover:** app icon, splash, permission strings, privacy policy page on the web domain, App Store and Play Store listings, EAS Build production profiles, TestFlight to the office first, App Store review notes with a demo access NAME, EAS Update channel, `USER-GUIDE.md`, and the cutover: the old screen (still saving through n8n) and the new app (saving through our API) may both write to `receipt` for one week; the old screen and the n8n `save` workflow are switched off after the Sync tab shows zero pending for seven days.

---

## 11. Acceptance tests (all must pass, on a real iPhone and a real Android phone)

1. Save 5 receipts in **airplane mode** → all show **Pending** → turn the network on → all become **Synced** with no tapping; the office sees them in the Sync tab as "Still on phones" first, then "On server".
2. Start an upload, **press the home button and lock the phone** → the upload finishes while the app is in the background → reopening shows **Synced**.
3. **Force-quit the app mid-upload** → reopen → reconciliation or a retry finishes it; exactly one row and one set of objects exist on the server.
4. **Simulate a row-update failure** on the server → no objects remain in Storage, the phone stays **Pending** and retries later.
5. **Send the same receipt twice** (same `client_uuid`) → one row, one PDF.
6. A **corrupted file** (checksum mismatch) is rejected with 400 and retried.
7. Register plus heartbeat make a phone's pending receipts visible in the Sync tab **before** the files arrive.
8. After sync the file exists on the phone and in Storage; after the cleanup days only the server copy remains and the detail screen still opens it through the signed URL.
9. 10 failed attempts → **Failed** on the phone and in the Sync tab failed list; manual **Retry** works.
10. Phone restart → the queue and files are intact.
11. Offline save with **Later** → after sync the card shows **Needs details** pre-filled from extraction → **Done** confirms it and the office row loses its badge.
12. Online save opens the wizard pre-filled within 20 s; with n8n down the wizard still opens empty and the file is already synced.
13. **Send** to AppFolio twice → one email, the second call returns `already_sent`; the row is in Archive.
14. A disabled access NAME gets "This access name is no longer active" on launch and the API rejects its register.
15. Identity A cannot read receipts of identity B (API and Uploads list).
16. Legacy rows with hex bytea, base64 and data-URL images all open in the web viewer; a HEIC photo from an iPhone uploads as JPEG and opens as a PDF.
17. Tapping a `…/receipt-management?access=NAME` link on a phone with the app installed opens the app on that NAME; without the app it shows the store buttons.
18. Matching: a receipt with the same amount three days old is not a candidate; a matched receipt is hidden from other transactions and from the green highlight.
19. A TestFlight build installs and passes tests 1 to 3 on an iPhone; an internal-testing build does the same on Android; an EAS Update changes a label without a new store build.
20. `npm run build`, `npm run lint`, `npm test` green across the workspace; no file over 500 lines; no `VITE_` or `EXPO_PUBLIC_` variable holds a server secret; the mobile app bundle contains no Supabase key.
21. A code search shows no call to `/webhook/save` anywhere, and neither the mobile bundle nor the web bundle contains an n8n URL: only the functions talk to n8n, and only for extraction, email and SMS.

---

## 12. Deliverables

1. The monorepo with the layout in section 3, `README.md`, `.env.example` for each package, `netlify.toml`, `apps/mobile/app.config.ts`, `apps/mobile/eas.json` (development, preview, production profiles), `sql/receipt_sync_v1.sql`.
2. `CHANGES.md`: every decision this document did not specify.
3. `USER-GUIDE.md`: one page for field staff (install from the link, first launch, scan, what the colours mean, Wi-Fi only).
4. `RELEASE.md`: how to cut a build, send to TestFlight and the Play internal track, submit to the stores, and push an EAS Update.

## 13. Optional later (only if asked, separate PRs)

- Push notifications to the office when a device has had failed receipts for longer than the stale threshold.
- Manual CSV import for `card_transaction` (the automatic email feed stopped in May 2026).
- CSV export of Receipts and Archive.
- Server-side search and paging once `receipt` passes about 10k rows.
- A staff-only Receipts review screen inside the mobile app.
