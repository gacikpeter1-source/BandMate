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
  being admin in band A gives nothing in band B. Nobody joins a band on their own: an admin invites them by
  email (Paid plans, see "Plans and limits"); someone signed in with no membership sees "not a member"
  (`BandApp.tsx` Waiting).
- Band `status`: `active` | `paused`. Paused = fans see "Temporarily closed", staff cannot read/write (rules),
  the operator still can.
- Operator ("BandMate admin") = a doc in `platformAdmins/{uid}`, created only by script. Full access to all bands.
  The "BandMate admin" link appears only on a band's login screen, never when signed in.
- bandmate.shop home (`PlatformHome.tsx`) is deliberately simple: email + password + "Login", and "Start Your BandMate"
  right below it. After login (same origin, so the session carries): exactly one band -> straight to `/b/<id>/band`;
  several -> a list; none -> "not part of a band yet" + Start button; the operator also gets the admin console button.
  "Which bands am I in" = `fetchMyBands` collection-group query on `members.email` (`lib/memberships.ts`; rule
  `/{path=**}/members/{id}` returns only docs with the signed-in verified email; needs the `members.email` collection-group
  index in `firestore.indexes.json`). The operator login at `/platform/login` still exists.
- Getting a band (self-service): bandmate.shop home "Start Your BandMate" button (`/start`,
  `src/pages/platform/StartPage.tsx`) is ONE form: your name, band name, address (= future `bandId`, checked live), plan
  (Free, or Paid shown as "coming soon"; "Compare plans" opens `PlanTable`), band email (this is the master login, the only
  email asked for), password, terms checkbox. Submitting creates the Firebase account, sends the verification email and
  keeps the typed values in localStorage (`bandmate-start-draft`); once the email is confirmed the request is filed by
  itself (`bandRequests/{uid}`: band name, address, `plan: "free"`, `termsVersion` + server-stamped `termsAcceptedAt`).
  A confirmed account with no request and no draft (other device) gets the short `RequestForm`. **Free bands wait for the
  operator**, who approves in `/platform` (`approveBandRequest` in `src/lib/platform.ts`, one transaction: band with
  `plan`/`extraPacks`, default settings, `settings/usage`, founder as `admin` member) or rejects. **Paid is built but off**:
  `PAID_CHECKOUT_ENABLED` in `src/lib/plans.ts` is false (no Stripe yet), firestore.rules only accepts `plan: "free"` in a request.
  When Stripe exists, a paid sign-up should create the band at once after payment. The founder sees the result at `/start` and
  signs in again at the band's own address (sign-in is per address). Terms text is a PLACEHOLDER (`TermsPage.tsx`);
  bump `TERMS_VERSION` when it changes.
  **One email, one band**: Firebase Auth allows one account per email (case-insensitive); doc id = uid allows one request per
  account (an approved one can't be deleted/refiled); `/start` shows "You already have a band" to anyone who is admin or
  bandmate in a band (`activeBands`); the console flags such a request and disables Approve, and `approveBandRequest`
  re-checks (a transaction can't run the lookup, so it is checked first). The operator may query anyone's memberships
  (collection-group rule). Cannot stop someone using a second email address; the operator approval is the real gate.
- Operator console (`/platform`): pending requests, all bands, pause/resume, add a band's own domain, set a band's plan
  (Free/Paid) and extra space packs (`setBandPlan`; script: `node scripts/set-plan.mjs <bandId> free|paid [--packs n]`).
  Also **delete a band** (`deleteBand` in `src/lib/platform.ts`; red button, type the band id to confirm): pauses it, then removes
  sales/items/stock/bundles/members/settings, its Storage folder, its `domains` and `bandRequests` entries, then the band doc.
  Operator only (storage.rules allows `list` on `bands/**` for the operator alone). Firebase Auth accounts of its people stay
  (a browser can't delete users). A band's own admin cannot delete the band.
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
A membership can only be created by accepting an invitation (`bands/{id}/invites/{email}`) addressed to the person's own
verified email, or by the operator (founder). `pending` is legacy (old sign-ups). Any admin may remove any other member
at once (no confirmation); the operator may remove anyone. The list of all bands and domains is operator-only;
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
- Band record also has `plan` ("free"|"paid", missing = free) and `extraPacks` (+150 MB each) — operator-written only.
- `settings/usage`: { items, bytes, members } — running totals the limits are checked against (members = people + open invitations).
- `invites/{email}`: email, role ("bandmate"), invitedBy, createdAt. Doc id = lowercase email. Admin-managed; the invitee can read/delete only their own.
- Storage: `bands/{bandId}/qr|logo|photos/*` — public read, that band's staff (or operator) write, images < 5 MB.
  Photos are shrunk to 1400px WebP on the phone before upload (`src/lib/images.ts`); max 6 per product.
  Fan page shows them in a swipeable `PhotoCarousel` with a full-screen `PhotoViewer` (`src/components/ui.tsx`).

## Plans and limits (`src/lib/plans.ts`, `src/lib/planState.ts`, `src/components/plans.tsx`)
| | Free | Paid (2 €/month, Stripe fee included) |
|---|---|---|
| People | 1 | 3 (invited by email) |
| Items | 100 | 200 |
| Picture space | 50 MB | 150 MB (+150 MB per extra pack, 2 €/month each, any number, either plan) |
| QR per item | yes | yes |
| Colours/design/logo backdrop, own domain, invites | no | yes |
- Numbers live in THREE places that must change together: `src/lib/plans.ts`, `firestore.rules` and `storage.rules` ("PLAN LIMITS").
- Enforcement: the app checks first (`assertItemRoom/assertSpaceRoom/assertUserRoom`, friendly message + "Extend?" button) and the rules
  enforce too: item create needs `getAfter(settings/usage).items <= max` (so item writes go in a batch with the counter,
  `createItems`/`deleteItem` in `lib/ops.ts`), invite create needs `members <= max`, a Storage upload needs
  `usage.bytes + size <= max` (storage rules read Firestore), `settings/public` design fields (`theme, preset, logo*`) need Paid.
  The counters are app-maintained, so this stops honest overuse, not a determined band; items and members self-correct
  (`state/band.tsx`, `pages/band/Users.tsx`); bytes need `node scripts/recount-usage.mjs <bandId>|--all --bucket <bucket>` after anything odd.
- Over the limit (e.g. after a downgrade): all data is kept, only adding is blocked, with the "limit reached, Extend?" message.
- "Extend?" opens the plan table; online payment doesn't exist yet, so it says to ask the BandMate admin (operator console).
- Invites (`src/lib/invites.ts`, `pages/band/Accept.tsx`): admin adds an email -> invite doc + counter in one batch, then Firebase's
  email-link sign-in mail (`sendSignInLinkToEmail`, needs "Email link" enabled in Firebase Auth). The link always points at the BandMate
  address (`/b/<id>/accept`), which is on the authorized-domains list. The page confirms the link, asks name + password, and
  `state/auth.tsx` turns the invitation into a membership (batch: create member, delete invite).
- `state/auth.tsx` confirms a remembered (cached) membership with the server before opening the desk (offline it trusts the cache): a
  removed person's browser must not start listeners it can no longer read, which crashed the Firestore client.
- Do not name a CSS class `locked`: `body.locked` is the scroll lock used by sheets (the plan lock class is `plan-locked`).

## Languages (English + Slovak)
- Every visible phrase lives in `src/i18n/en.ts` and `src/i18n/sk.ts` (same keys; `sk` is typed against `en`, so a missing
  key fails `tsc`). Pages use `const t = useT(); t("key", { name })`; code outside React (helpers, thrown errors) uses
  `tr("key", vars)`. Never put English text straight into JSX, placeholders, aria-labels, toasts or thrown errors.
- `{name}` = filled-in blank (must match in both languages). Plurals: `"one|other"` in English, `"one|few|many"` in Slovak
  (1 | 2-4 | 5+), chosen by the `n` variable: `t("stock.items", { n })`.
- Slovak uses the informal "ty" form. Brand and network names (BandMate, Instagram, QR) stay untranslated.
- Language = the visitor's choice (saved in localStorage `bandmate-lang`), else Slovak if the browser prefers Slovak, else
  English (`src/i18n/index.tsx`). `LangSwitch` (EN | SK) sits top-right on the front page, login/registration cards, fan page,
  band desk header, Settings > account. It also sets Firebase's email language (`auth.languageCode`).
- Add a language: new `xx.ts` typed like `sk.ts`, add it to `DICT`/`LANGS`/`Lang` in `src/i18n/index.tsx`, adjust `pick()` for
  its plural rule. Dates/numbers use `currentLocale()`.
- `npm run test:i18n` checks both files have the same keys, same blanks, complete plural forms, and that every `t("key")`
  in the code exists. The terms text (`terms.*`) is a PLACEHOLDER in both languages.

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
- `npm run test:i18n` — translation completeness (no emulators needed)
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
Planned in order: Stripe (the 2 €/month subscription and 2 €/month extra-space packs, needs a small server function for Checkout +
webhook; then paid sign-ups create the band at once and `PAID_CHECKOUT_ENABLED` goes true; later Connect so sales payments go to each band;
manual QR payments stay); more languages (the system is ready); automatic Vercel/Firebase setup for a band's own domain (needs Vercel token +
Cloud Functions) and an email to the founder when approved; cleanup of unverified accounts; yearly price.
Also: CSV export of sales, low-stock alerts, final terms text.
