# BandMate

Merch inventory and payment-QR app for bands. One copy of the app = one band.

- **Fan page** (`/`): no login. Products, prices and payment QR codes. Stock counts are never shown, only "Sold out". Optional top bar with social-media QR codes and an email address.
- **Band desk** (`/band`): for approved BandMates. Sell with a basket and bundles, see stock, add pieces, upload QR pictures, track sales per gig, and set the band's colours, logo and top bar.
- **People** (`/band/users`): Admin only. Approve sign-ups as BandMate, change roles, disable accounts.

Built with React + Vite, Firebase Auth / Firestore / Storage, and hosted on Vercel.

## Roles

| Role | Who | Can do |
|---|---|---|
| Fan | Anyone, not signed in | See visible products, prices, QR codes, top bar |
| Pending | Signed up, not approved yet | Sees a "waiting for approval" screen only |
| BandMate | Approved by the admin | Everything on the band desk: stock, adding pieces, QR uploads, bundles, sales, undo, colours, logo, top bar |
| Admin | Created with the script below | Everything a BandMate can do, plus approving people, changing roles and deleting sales |
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
```

### 3. Install and deploy the security rules

```bash
npm install
npx firebase login
npx firebase use --add          # choose your project
npx firebase deploy --only firestore:rules,storage
```

The Storage rules read each person's role from Firestore. The first deploy asks you to allow that, so answer **Yes**.

### 4. Create the admin account

The admin password is set from your computer, never written into the app, so nobody can read it from the website's code.

1. **Project settings → Service accounts → Generate new private key.** Save it in this folder as `service-account.json`. It's already in `.gitignore`, so it never goes to GitHub.
2. Run:

```bash
GOOGLE_APPLICATION_CREDENTIALS=./service-account.json \
  node scripts/create-admin.mjs admin@admin.com 'YOUR-PASSWORD' --sample
```

`--sample` adds the starter stock (White hat 50, T-shirt S 12 / L 48 / XXL 0, Cup 3) and a "Shirt + Hat" bundle. Leave it out to start empty.

3. Delete `service-account.json` afterwards, or keep it somewhere safe outside the project.
4. Sign in at `/login`. Then go to **Settings → Your account** and change the password.

`admin@admin.com` isn't a real mailbox, so "Forgot password" can't reach it. If you lose the password, run the script again with a new one.

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
2. **Settings → Environment Variables**: add the same six `VITE_FIREBASE_*` values from `.env.local`.
3. Deploy. Then in Firebase, go to **Authentication → Settings → Authorized domains** and add your Vercel domain, for example `bandmate.vercel.app`, or the band's own domain.

From then on, every push to `main` redeploys automatically.

## How band members join

1. They open `/register`, enter a name, email and password, and land on a "Waiting for approval" screen.
2. The admin opens **People**, which shows a red badge when someone is waiting, and taps **Approve as BandMate**.
3. Their screen switches to the band desk by itself.

## Testing the security rules

You need Java 11 or newer installed. The emulators run on your computer:

```bash
npm run test:rules
```

The tests check that fans can't see stock, sales or hidden items, that sign-ups can only create pending accounts, that BandMates can't approve people, that the admin can't lock themselves out, and that only band staff can upload images.

## Notes

- **Offline:** sales are saved on the phone straight away and sync when the signal comes back, so the desk works in basement clubs. Because of this, two phones selling the very last piece at the same moment can push stock below zero. The Stock tab then shows "−1 over" in red, so you can see it happened.
- **Payments** are confirmed by hand ("Payment received · mark sold"). Stripe can be added later as another payment method in the checkout.
- **Selling to other bands:** each band gets its own Firebase project and Vercel deployment from this same repo. That keeps every band's data fully separate.
