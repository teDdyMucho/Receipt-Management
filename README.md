# LionRock Receipts

Native mobile app (iOS and Android), web workspace and API for receipt capture.
The full specification is in `RECEIPT-APP-PROMPT.md`; decisions it did not cover are in `CHANGES.md`.

## What exists so far

| Folder | Status |
|---|---|
| `packages/shared` | Done: types, receipt fields parser, matching, formats, backoff, with tests |
| `sql/` | Done: `receipt_sync_v1.sql` (works on the existing project and on a new one), `new_project_staff_login.sql` (new projects only) |
| `apps/mobile` | Phase 2: first launch, Scan, wizard, Uploads, Settings. Works fully offline. Uploading is Phase 3 |
| `netlify/functions` | Not started (Phase 1) |
| `apps/web` | Not started (Phase 4) |

## Run the mobile app on your phone

1. Install **Expo Go** from the App Store or Play Store.
2. In a terminal, from this folder:
   ```
   npm install
   npm run mobile
   ```
   (`npx expo start` only works from inside `apps/mobile`, not from this folder.)
3. Scan the QR code with the iPhone camera, or from inside Expo Go on Android. The phone and the computer must be on the same Wi-Fi. If it cannot connect, run `npx expo start --tunnel` from `apps/mobile`.
4. On first launch choose **I have an access name** and type any name. Without a server the name is accepted unchecked.

Expo Go is enough for this phase. Background uploads (Phase 3) need a development build made with EAS.

## Run the app in a browser (preview)

```
npm run web
```

It opens at `http://localhost:8081`, shown at phone width. This is a preview of the screens: receipts are kept in the browser's local storage (room for only a few photos), there is no keychain, and nothing uploads in the background. The phone app is the real thing.

## Database setup

Run in the Supabase SQL editor, by hand:

1. `sql/receipt_sync_v1.sql`
2. On a **new** Supabase project only: `sql/new_project_staff_login.sql`, then add the first admin with the statement at the bottom of that file.

## Checks

```
npm test          # unit tests
npm run lint      # type-check every package
npm run check:lines   # no file over 500 lines
```
