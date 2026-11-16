# CHANGES

Decisions that `RECEIPT-APP-PROMPT.md` did not specify, or where the build deviates from it.

## Made so far

| # | Decision | Why |
|---|---|---|
| 1 | `receipt.details_confirmed` is added with `default true`. The new API writes `false` explicitly. | Rows the old screen inserts during the cutover week would otherwise be `null` and show a false "Needs details" badge. |
| 2 | New table `receipt_api_rate_limits` and function `receipt_rate_limit_hit`. | Netlify functions keep no memory between calls, so per-identity rate limiting needs a store. |
| 3 | `receipt_devices` and `receipt_api_rate_limits` have row level security on with no policies. | Only the API (service-role key) may read or write them. |
| 4 | Extra indexes on `receipt (sync_status)` and `receipt ("user", created_at desc)`. | The Sync tab and `/api/receipts/mine` filter on these. |
| 5 | `validateDetails`, `typeColour`, `dueQueue` and `reconcileStatus` live in `packages/shared`. | Same rules on the phone, the web and the API. |
| 6 | A match candidate must have a non-empty total. | Two empty amounts would otherwise "match". |
| 7 | `receipt_sync_v1.sql` creates `receipt`, `receipt_access_links` and `card_transaction` when they do not exist. | The owner is using a new Supabase project; on the existing one these statements are skipped. |
| 8 | `sql/new_project_staff_login.sql` creates the `user` table and `login_user` for a new project. `login_user` is callable only with the service-role key. | The new project has no staff login; the API is the only caller. |
| 9 | Mobile: `local_path` stores the file name, not the full path. | The app's folder path changes between installs and updates on iOS. |
| 10 | Mobile: routes live in `apps/mobile/src/app`; Expo SDK 58 with the new `expo-file-system` File API. | Current Expo conventions; upload tasks exist on the new API. |
| 11 | Replaced by 14: an access name is no longer accepted unchecked, and the sample staff account is gone. | It was only for running before the server existed. |
| 14 | **Owner's request, 2026-11-16.** A link name is protected by a PIN (4 to 6 numbers). The first person to type a name sets its PIN and owns it; anyone else sees "This link is not available. Please use another name." The owner signs in again with "This is my link" and the PIN. Five wrong PINs lock the name for 15 minutes. | The owner asked for it. Until now any typed name was accepted. |
| 15 | New table `receipt_link_accounts` (`sql/receipt_link_accounts_v1.sql`), row level security on, no policies. PIN stored as a PBKDF2 hash. Profile picture stored there as a small data URL. | PIN hashes must not sit in `receipt_access_links`, which the old screen reads with the public key. |
| 16 | Anyone with the app can set up a new name (no list from the office first). The office can still switch a name off (`disabled_at` in either table). | The owner described sign-up this way; the office screen that creates links does not exist yet. |
| 17 | After sign in the server gives the app a signed token (HMAC, 365 days). Every call must carry it; the server takes the name from the token, so a link name can only save and read its own receipts. Staff tokens can read everyone's. | Replaces "any name is trusted". The key is derived from the service-role key unless `SESSION_SECRET` is set. |
| 18 | The tab the spec calls "Uploads" is labelled **History**. Link names see Scan, History, Settings (profile only: link name read-only, picture, change PIN, sign out). Staff also see **Everyone** and the full Settings. | The owner asked for these tabs and this Settings. |
| 20 | **Owner's request, 2026-11-17: cloud only.** A receipt is kept on the phone only until the server confirms the upload; then the copy on the phone is removed and History is read from the server. An upload has two results, Success or Failed; a failed one stays on the phone for Try again. This replaces the spec's "keep a local copy for N days" (4.10) and its cleanup setting. | The owner does not want local storage. The phone still holds a receipt that has not uploaded, so a lost connection does not lose it. |
| 21 | **Owner's request: Delete removes the receipt from the app for everyone.** A link name may delete its own; staff may delete any. The row and file are kept with `deleted_at` / `deleted_by` set (`sql/receipt_audit_v1.sql`) and are never listed or opened again. | The owner asked for delete to really remove it. Marking instead of erasing keeps the spec's "never delete rows" and lets a wrongly deleted receipt be restored by hand. |
| 22 | **Owner's request:** staff and admins can edit the details of any receipt. New table `receipt_audit` records every upload, edit (fields before and after) and delete; admins see it in the **Audit** tab. Admins also have a **Staff** tab to create staff accounts (`sql/staff_admin_v1.sql`). | The owner asked for these. |
| 19 | History also lists the person's receipts uploaded from another phone, read from the server. | Otherwise a new phone shows an empty history. |
| 12 | Mobile: the cleanup setting cycles through Never / 7 / 14 / 30 / 90 days. | The spec gives only the default (14) and 0 = keep forever. |
| 13 | Mobile: files are not yet excluded from iCloud backup. | `expo-file-system` has no switch for it; to be handled with the development build in Phase 3. |

## Waiting for the owner's OK (found in Phase 0)

| # | Proposal | Why |
|---|---|---|
| A | New n8n email webhook that receives the PDF and the fields from our API, with no Supabase nodes. | The current workflow reads the `image` column, which new rows do not have, and it sets `done_status` itself. |
| B | Drop the Google Drive copy inside the n8n upload workflow, or keep it knowingly. | It is n8n writing to file storage, which section 1 rule 5 forbids. |
| C | Field identity uses a signed token issued by `/api/access/verify`, not the bare name on every call. | A guessable name would let anyone list and delete that person's receipts. |
| D | All file uploads go direct to Storage through `upload-url` + `confirm`. | Netlify's body limit is about 4.5 MB for binary bodies; one path instead of two. |
| E | **Decided 2026-11-17:** iOS and Android both use `com.lionrock.receipts`. The owner's first submit went to the App Store Connect app with that id (6835492954), and the signing credentials on EAS are for it. Version 2.0.0. | The owner asked to use the app that already exists in App Store Connect. |
