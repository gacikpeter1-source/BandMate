# BandMate

Merch inventory and payment-QR app for bands. One app serves many bands: each band has its own isolated store, team and settings, reached at its own address.

- **Fan page** (`/`): no login. Products, prices and payment QR codes. Stock counts are never shown, only "Sold out". Optional top bar with social-media QR codes and an email address.
- **Band desk** (`/band`): for approved BandMates. Sell with a basket and bundles, see stock, add pieces, upload QR pictures, track sales per gig, and set the band's colours, logo and top bar.
- **People** (`/band/users`): Admin only. Approve sign-ups as BandMate, change roles, disable accounts.

Built with React + Vite, Firebase Auth / Firestore / Storage, and hosted on Vercel.

## How bands are separated

Every band has its own space under its own short ID (for example `saw-dust-and-mold`). Its products, stock, sales, team, colours and pictures can only be reached by that band's own team, and the security rules enforce this on Google's servers. The same person can sign in with one email and password and be part of several bands, with a separate role in each.

- **BandMate's own address** (for example `band-mate-zeta.vercel.app`) shows the BandMate home page. Each band is reachable there at `/b/<bandId>`. BandMate admin signs in at `/platform/login`.
- **A band's own address** (`bandname.yourapp.com` or the band's own domain) opens only that band's store at the root.

## Roles (inside one band)

| Role | Who | Can do |
|---|---|---|
| Fan | Anyone, not signed in | See visible products, prices, QR codes, top bar |
| Pending | Signed up, not approved yet | Sees a "waiting for approval" screen only |
| BandMate | Approved by the admin | Everything on the band desk: stock, adding pieces, QR uploads, bundles, sales, undo, colours, logo, top bar |
| Admin | The band's first admin is created with `create-band` (below) | Everything a BandMate can do, plus inviting and removing people, changing roles and deleting sales |
| Disabled | Blocked by the admin | Nothing |

These rules are enforced on Google's servers by `firestore.rules` and `storage.rules`, not only by hiding buttons. A fan who opens the browser console still can't read stock or sales.

## Setup (about 20 minutes)

### 1. Create the Firebase project

1. Go to https://console.firebase.google.com and click **Add project**.
2. **Build → Authentication → Get started → Email/Password → Enable.**
3. **Build → Firestore Database → Create database**, in production mode. Pick a region near you, for example `europe-west3` (Frankfurt).
4. **Build → Storage → Get started.** New projects must be on the **Blaze** (pay-as-you-go) plan to use Storage. A band's QR pictures and logo stay well inside the free usage, but set a budget alert anyway: Google Cloud console → Billing → Budgets & alerts, for example €5.

### 2. Register the web app

**Project settings → Your apps → Web (`</>`)**. Copy the config values into `.env.local`:

```bash
cp .env.example .env.local
# fill in VITE_FIREBASE_API_KEY, AUTH_DOMAIN, PROJECT_ID, STORAGE_BUCKET, MESSAGING_SENDER_ID, APP_ID
# and VITE_PLATFORM_HOST (the address BandMate itself runs on)
```

### 3. Install and deploy the security rules

```bash
npm install
npx firebase login
npx firebase use --add          # choose your project
npx firebase deploy --only firestore:rules,storage
```

The Storage rules read each person's role from Firestore. The first deploy asks you to allow that, so answer **Yes**.

### 4. Create the BandMate admin and the first band

Passwords are never typed into the app or the scripts' output, so nobody can read them from the website's code.

1. **Project settings → Service accounts → Generate new private key.** Save it in this folder as `service-account.json`. It's already in `.gitignore`, so it never goes to GitHub.
2. Create yourself as BandMate admin (can open every band):

```bash
GOOGLE_APPLICATION_CREDENTIALS=./service-account.json \
  node scripts/create-platform-admin.mjs you@example.com
```

3. Create a band with its first admin. `--sample` adds example stock; `--domain` (repeatable) is an address that should open this band:

```bash
GOOGLE_APPLICATION_CREDENTIALS=./service-account.json \
  node scripts/create-band.mjs my-band "My Band" admin@myband.com --sample --domain merch.myband.com
```

A new login gets a random password. Open the band's login page (`/b/my-band/login`) and use **Forgot password?** to set your own.

4. Delete `service-account.json` afterwards, or keep it somewhere safe outside the project.

Each extra address must also be added to the Vercel project (Settings → Domains) and to Firebase **Authentication → Settings → Authorized domains**.

### 5. Run locally

```bash
npm run dev
```

### 6. GitHub + Vercel

```bash
git init && git add . && git commit -m "BandMate"
git remote add origin https://github.com/gacikpeter1-source/BandMate.git
git push -u origin main
```

1. In Vercel, **Add New → Project →** import the GitHub repo. Vercel detects Vite by itself.
2. **Settings → Environment Variables**: add the same `VITE_FIREBASE_*` values from `.env.local`, plus `VITE_PLATFORM_HOST` (the address BandMate itself runs on, for example `band-mate-zeta.vercel.app`).
3. Deploy. Then in Firebase, go to **Authentication → Settings → Authorized domains** and add your Vercel domain, for example `bandmate.vercel.app`, or the band's own domain.

From then on, every push to `main` redeploys automatically.

## How band members join

Nobody joins on their own. On a **Paid** band the admin invites each person by email:

1. The admin opens **People**, types the person's email and taps **Send invitation** (a Paid band has room for 3 people).
2. The person gets an email with a link. The link confirms the address; they choose a name and a password.
3. They land in the band desk. The admin can remove anyone from **People** at any time, in one tap.

A **Free** band is just for one person (the one who registered), so there is nobody to invite.

## Plans

Free: 1 person, 100 items, 50 MB of pictures. Paid (2 € a month): 3 people, 200 items, 150 MB, your own colours and design, your own domain. Extra picture space: +150 MB for 2 € a month, as often as needed. The numbers are in `src/lib/plans.ts`, `firestore.rules` and `storage.rules`. Online payment is not connected yet, so the BandMate operator switches a band to Paid in the console (`/platform`) or with `node scripts/set-plan.mjs <bandId> paid`. For a band created before plans existed, run `node scripts/recount-usage.mjs <bandId> --bucket <your-storage-bucket>` once.

To let people be invited, turn on **Authentication → Sign-in method → Email/Password → Email link (passwordless sign-in)** in Firebase.

## Testing the security rules

You need Java 11 or newer installed. The emulators run on your computer:

```bash
npm run test:rules
```

The tests check that fans can't see stock, sales or hidden items, that nobody can join without an invitation to their own verified email, that plan limits (items, picture space, people) and the Paid-only design settings are enforced, that BandMates can't approve people, that the admin can't lock themselves out, and that only band staff can upload images.

## Notes

- **Offline:** sales are saved on the phone straight away and sync when the signal comes back, so the desk works in basement clubs. Because of this, two phones selling the very last piece at the same moment can push stock below zero. The Stock tab then shows "−1 over" in red, so you can see it happened.
- **Payments** are confirmed by hand ("Payment received · mark sold"). Stripe can be added later as another payment method in the checkout.
- **Selling to other bands:** one deployment serves every band. Create each with `scripts/create-band.mjs`; the data of different bands is separated by the security rules (and tested in `tests/rules.test.mjs`).
