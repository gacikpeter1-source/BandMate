# BandMate — notes for Claude Code

Multi-tenant merch inventory + payment-QR app: many bands share one code base, one Firebase project and
one Vercel project, each band in its own isolated space. React 18 + Vite + TypeScript, Firebase (Auth
email/password, Firestore, Storage), hosted on Vercel, code on GitHub. Setup steps for humans are in README.md.

## Tenancy (how a band is found)
- Every band has an immutable `bandId` (lowercase, digits, dashes; e.g. `saw-dust-and-mold`). Its data lives
  under `bands/{bandId}/...` and its pictures under `bands/{bandId}/{qr|logo|photos}/...`. Never use the band
  *name* in a path; the name is display text only and can change.
- The address decides the band (`src/lib/host.ts`, `src/App.tsx`):
  - BandMate's own address (`VITE_PLATFORM_HOST`, default `bandmate.shop`; also localhost, `*.vercel.app`) = platform:
    home page at `/`, operator console at `/platform`, operator login at `/platform/login`, and every band at
    `/b/<bandId>/...`.
  - `<bandId>.bandmate.shop` = that band, served at the root, with no per-band setup (`subdomainBandId`).
    Reserved names (www, app, admin, ... see `RESERVED_BAND_IDS`) can never be band ids.
  - Any other address (a band's own domain) = the band named in `domains/{host}` (`{ bandId }`), served at the
    root. An exact `domains` match wins over the subdomain rule. Unknown address -> "Address not set up".
- `TenantProvider` (`src/state/tenant.tsx`) sets the band for the page and `src/lib/scope.ts`
  (`bandCol`, `bandDoc`, `bandPath`, `getBandId`, `getBase`) so non-React code builds per-band paths.
  Pages use `src/lib/nav.tsx` (`Link`, `NavLink`, `Navigate`, `useNavigate`), which add the `/b/<bandId>` prefix
  when needed. Always import those from there, never from `react-router-dom`, inside band pages.
- One login (Firebase Auth email) works across bands, but each band has its own membership and role;
  being admin in band A gives nothing in band B. Opening another band's login/desk creates a `pending`
  membership there that band's admin must approve.
- Band `status`: `active` | `paused`. Paused = fans see "Temporarily closed", staff cannot read/write (rules),
  the operator still can.
- Operator ("BandMate admin") = a doc in `platformAdmins/{uid}`, created only by script. Full access to all bands.
  The "BandMate admin" link appears only on a band's login screen, never when signed in.
- Getting a band (self-service): bandmate.shop home -> "Register your band" (`/start`, `src/pages/platform/StartPage.tsx`).
  A verified account files ONE request (`bandRequests/{uid}`: band name, wanted address = future `bandId`, optional own
  domain, `termsVersion` + server-stamped `termsAcceptedAt`). The operator approves it in `/platform`
  (`approveBandRequest` in `src/lib/platform.ts`, one transaction: band, default settings, founder as `admin` member,
  optional `domains` entry) or rejects it. The founder sees the result at `/start` and signs in again at the band's own
  address (sign-in is per address). Terms text is a PLACEHOLDER (`TermsPage.tsx`); bump `TERMS_VERSION` when it changes.
  Payment is not part of this yet: approval is the gate until Stripe exists.
- Operator console (`/platform`): pending requests, all bands, pause/resume, add a band's own domain.
- Create a band by script: `node scripts/create-band.mjs <bandId> "<Name>" <adminEmail> [--domain host] [--sample]`.
  Create the operator: `node scripts/create-platform-admin.mjs <email>`. A band's own custom domain also has to be added
  to the Vercel project and to Firebase Auth -> Authorized domains by hand for now (without that, the
  verification email is still sent, just without its "continue" button). `*.bandmate.shop` needs the wildcard
  domain added in Vercel (Vercel DNS).

## Roles (source of truth: `firestore.rules`, `storage.rules`; tests in `tests/rules.test.mjs`)
Roles live in `bands/{bandId}/members/{uid}.role`:
- Fan (not signed in): reads one active band's `items`/`bundles` where `visible == true`, and `settings/public`. Never stock or sales.
- `pending`: self-registered in that band, waiting. Can only edit own `displayName`.
- `bandmate`: full band desk (items, stock, bundles, sales, settings, QR/logo/photo uploads).
- `admin`: bandmate + manage `members` roles + delete sales. Cannot change own role.
- `disabled`: nothing.
Self sign-up may only create `role: "pending"`. The list of all bands and domains is operator-only;
a single band or domain can be fetched by anyone (needed to show a store).
**Email must be verified.** Rules and storage rules require `request.auth.token.email_verified == true` before a
membership can be created or any role applies. The app sends the Firebase verification email on sign-up, shows
`src/pages/VerifyEmail.tsx` until confirmed, and only then creates the `pending` membership (`src/state/auth.tsx`).
Accounts made by the scripts are marked verified. Unverified Auth accounts stay in Firebase Auth
(no cleanup job yet) but have no data or access.

## Data model (Firestore, everything under `bands/{bandId}/` unless noted)
- Top level: `bands/{bandId}` {name, status, createdAt}, `domains/{host}` {bandId}, `platformAdmins/{uid}`,
  `bandRequests/{uid}` (see Tenancy; only the founder and the operator can read it).
- `members/{uid}`: email, displayName, role, createdAt.
- `items/{id}`: name, variant (size), price, qrUrl, qrPath, images[{url,path}], visible, soldOut, order. Public if visible.
  Sizes of one product share the same `name`; the UI groups by name. Photos belong to the product: the item
  form writes the same `images` to every size of that name (first photo = main). `bundles` also have `images`.
- `stock/{itemId}`: { qty } — staff only. Kept separate so fans can never read counts.
  `items.soldOut` is the only stock signal fans see; every stock write must update it.
- `bundles/{id}`: name, price, parts[{name, qty}] (parts reference item *names*; size chosen at sale), qrUrl, visible, order.
- `sales/{id}`: at, by, byName, method (qr|cash|card|quick), gig, total, lines[{kind, refId, label, detail?, price, qty, picks[{itemId, qty}]}], undone.
  Staff may only change `undone` after creation.
- `settings/public`: bandName, tagline, currency, preset, theme{primary,bg,surface,text}, logoUrl, logoPath, logoOpacity, logoInHeader, topBar{enabled,email,links[{type,url}]}.
- `settings/band`: { gig } — staff only.
- Storage: `bands/{bandId}/qr|logo|photos/*` — public read, that band's staff (or operator) write, images < 5 MB.
  Photos are shrunk to 1400px WebP on the phone before upload (`src/lib/images.ts`); max 6 per product.
  Fan page shows them in a swipeable `PhotoCarousel` with a full-screen `PhotoViewer` (`src/components/ui.tsx`).

## Conventions
- All stock changes go through `src/lib/ops.ts` (batched `increment()`, works offline). Don't await
  commits in UI handlers; attach `.catch(toast)` so the desk keeps working with no signal.
- Live data via `useLiveQuery` / `useLiveDoc` in `src/lib/live.ts`; band data in `src/state/band.tsx`.
  Put the `bandId` in every live-query key.
- Colours come only from the four theme tokens set by `applyTheme` (`src/lib/theme.ts`); derived
  colours use `color-mix` in `src/styles.css`. No hard-coded colours in components except the
  always-white QR surfaces.
- If you change a rule, add or update a case in `tests/rules.test.mjs`. Include a cross-band attempt.

## Layout: mobile first
Design for a phone in one hand first (320-430px), then scale up. Never assume a wide screen.
- Content width is the `--maxw` token in `src/styles.css` (820px, 1120px from 1100px wide, 1360px from 1700px).
  Use it for every page-level container instead of a fixed pixel width.
- Use `.flow` (CSS `column-width: 440px`) to put cards or groups side by side only when each column
  can be 440px wide. Phones and tablets in portrait stay one column; no extra breakpoints needed.
- Tap targets at least 44px, bottom tab bar and sheets respect `env(safe-area-inset-*)`.
- Before shipping UI changes, check 320, 390, 820 (tablet), 1440 and 1920 wide, plus 844x390 landscape,
  and make sure `document.documentElement.scrollWidth <= innerWidth` (no sideways scroll).
  Run against emulators (`npm run emulators`, `VITE_USE_EMULATORS=true VITE_FIREBASE_PROJECT_ID=demo-bandmate`)
  with `node scripts/create-admin.mjs ... --sample` for test data.

## Commands
- `npm run dev` — local dev (needs `.env.local`, see `.env.example`)
- `npm run build` — typecheck + build (run before every commit)
- `npm run test:rules` — security-rules tests on the emulators (needs Java 11+)
- `npx firebase deploy --only firestore:rules,storage` — deploy rules
- `node scripts/create-band.mjs`, `create-platform-admin.mjs`, `migrate-to-multitenant.mjs` with `GOOGLE_APPLICATION_CREDENTIALS` set
  (or the emulator env vars, see `scripts/lib.mjs`)

## Never commit
`.env*` (except `.env.example`), `service-account*.json`, any admin password. Don't put passwords
in code, README, commit messages or Vercel build logs. Vercel needs the six `VITE_FIREBASE_*` vars and
`VITE_PLATFORM_HOST` (BandMate's own address).

## After first deploy
Add the Vercel domain (and every band domain) to Firebase Auth → Settings → Authorized domains, or the
verification email link will fail there.

## Ideas not built yet
Planned in order: automatic Vercel/Firebase setup for a band's own domain (needs Vercel token + Cloud Functions) and
an email to the founder when approved; Slovak/English; Stripe (band subscription replaces manual approval, then
Connect so sales payments go to each band; manual QR payments stay); cleanup of unverified accounts.
Also: CSV export of sales, low-stock alerts, final terms text.
