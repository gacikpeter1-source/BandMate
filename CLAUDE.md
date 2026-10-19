# BandMate — notes for Claude Code

Merch inventory + payment-QR app for one band per deployment. React 18 + Vite + TypeScript,
Firebase (Auth email/password, Firestore, Storage), hosted on Vercel, code on GitHub.
Setup steps for humans are in README.md.

## Roles (source of truth: `firestore.rules`, `storage.rules`)
- Fan (not signed in): reads `items`/`bundles` where `visible == true`, and `settings/public`. Never stock or sales.
- `pending`: self-registered, waiting. Can only edit own `displayName`.
- `bandmate`: full band desk (items, stock, bundles, sales, settings, QR/logo uploads).
- `admin`: bandmate + manage `users` roles + delete sales. Cannot change own role.
- `disabled`: nothing.
Role lives in `users/{uid}.role`. Self sign-up may only create `role: "pending"`.
The admin is created by `scripts/create-admin.mjs` (Admin SDK), never from the client.

## Data model (Firestore)
- `items/{id}`: name, variant (size), price, qrUrl, qrPath, visible, soldOut, order. Public if visible.
  Sizes of one product share the same `name`; the UI groups by name.
- `stock/{itemId}`: { qty } — staff only. Kept separate so fans can never read counts.
  `items.soldOut` is the only stock signal fans see; every stock write must update it.
- `bundles/{id}`: name, price, parts[{name, qty}] (parts reference item *names*; size chosen at sale), qrUrl, visible, order.
- `sales/{id}`: at, by, byName, method (qr|cash|card|quick), gig, total, lines[{kind, refId, label, detail?, price, qty, picks[{itemId, qty}]}], undone.
  Staff may only change `undone` after creation.
- `settings/public`: bandName, tagline, currency, preset, theme{primary,bg,surface,text}, logoUrl, logoPath, logoOpacity, logoInHeader, topBar{enabled,email,links[{type,url}]}.
- `settings/band`: { gig } — staff only.
- Storage: `public/qr/*`, `public/logo/*` — public read, staff write, images < 5 MB.

## Conventions
- All stock changes go through `src/lib/ops.ts` (batched `increment()`, works offline). Don't await
  commits in UI handlers; attach `.catch(toast)` so the desk keeps working with no signal.
- Live data via `useLiveQuery` / `useLiveDoc` in `src/lib/live.ts`; band data in `src/state/band.tsx`.
- Colours come only from the four theme tokens set by `applyTheme` (`src/lib/theme.ts`); derived
  colours use `color-mix` in `src/styles.css`. No hard-coded colours in components except the
  always-white QR surfaces.
- If you change a rule, add or update a case in `tests/rules.test.mjs`.

## Commands
- `npm run dev` — local dev (needs `.env.local`, see `.env.example`)
- `npm run build` — typecheck + build (run before every commit)
- `npm run test:rules` — security-rules tests on the emulators (needs Java 11+)
- `npx firebase deploy --only firestore:rules,storage` — deploy rules
- `node scripts/create-admin.mjs <email> <password> [--sample]` with `GOOGLE_APPLICATION_CREDENTIALS` set

## Never commit
`.env*` (except `.env.example`), `service-account*.json`, any admin password. Don't put passwords
in code, README, commit messages or Vercel build logs. Vercel needs only the six `VITE_FIREBASE_*` vars.

## After first deploy
Add the Vercel domain to Firebase Auth → Settings → Authorized domains, or login will fail there.

## Ideas not built yet
Stripe checkout, CSV export of sales, low-stock alerts, per-gig stock counts, multi-band (SaaS) mode.
