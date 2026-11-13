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
| 11 | Mobile: without `EXPO_PUBLIC_API_BASE_URL` an access name is accepted unchecked and marked "Not checked with the office yet". | Lets the app run before the API exists. |
| 12 | Mobile: the cleanup setting cycles through Never / 7 / 14 / 30 / 90 days. | The spec gives only the default (14) and 0 = keep forever. |
| 13 | Mobile: files are not yet excluded from iCloud backup. | `expo-file-system` has no switch for it; to be handled with the development build in Phase 3. |

## Waiting for the owner's OK (found in Phase 0)

| # | Proposal | Why |
|---|---|---|
| A | New n8n email webhook that receives the PDF and the fields from our API, with no Supabase nodes. | The current workflow reads the `image` column, which new rows do not have, and it sets `done_status` itself. |
| B | Drop the Google Drive copy inside the n8n upload workflow, or keep it knowingly. | It is n8n writing to file storage, which section 1 rule 5 forbids. |
| C | Field identity uses a signed token issued by `/api/access/verify`, not the bare name on every call. | A guessable name would let anyone list and delete that person's receipts. |
| D | All file uploads go direct to Storage through `upload-url` + `confirm`. | Netlify's body limit is about 4.5 MB for binary bodies; one path instead of two. |
| E | Bundle id: reuse `ai.lionrock.receipts` from the existing Capacitor app, or the spec's `com.lionrock.receipts`. | Both exist in writing; only one can be registered for this app. |
