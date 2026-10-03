# GoSee — App Store & Google Play Publishing Guide

Everything to take GoSee live on the **Apple App Store** and **Google Play**, plus
the exact text/answers to paste into each form.

> Before you start, verify two things in the legal pages and update if needed:
> company legal name (`WIWIS (Pvt) Ltd`) and contact email
> (`transfleet.primecare@gmail.com`) in `dashboard/src/app/privacy/page.tsx`,
> `terms/page.tsx`, `support/page.tsx`.

---

## 0. Shared assets (used by both stores)

**Live URLs** (public pages are now on your Vercel site — push + redeploy to activate):
- Privacy Policy: `https://gosee-phi.vercel.app/privacy`
- Terms of Use: `https://gosee-phi.vercel.app/terms`
- Support: `https://gosee-phi.vercel.app/support`
- Marketing/home: `https://gosee-phi.vercel.app/`

**Graphics** (in `store-assets/`):
- `play-icon-512.png` — Google Play app icon (512×512)
- `play-feature-1024x500.png` — Google Play feature graphic (required)
- Apple uses the 1024×1024 icon already inside the app build (no separate upload).

**Screenshots you must capture** (phone, portrait). Easiest: run the app on your
phone (TestFlight) with the demo data and take screenshots of:
1. Login screen  2. Engineer job inbox  3. The visit-time scheduler
4. Supplier invitation (Available/Not available)  5. A confirmed visit / dashboard
- **Apple:** 3–10 images at **1290×2796** (iPhone 6.7") — required size.
- **Google:** 2–8 images, portrait (e.g. 1080×2340). Also needs the feature graphic above.
- (Ask us and we can generate polished screenshots for you from the simulator.)

**Demo login for the reviewers** (both stores' reviewers must be able to log in):
- Mobile: `0771000001`  ·  Code: `000000`  (Engineer "Nuwan")
- This works because that number is in Supabase **Auth → Phone → Test OTP**.
  Keep at least this one number in the Test OTP list, and keep the demo accounts
  seeded (`node scripts/demo-seed.mjs`) while your app is in review.

---

## 1. STORE LISTING CONTENT (copy-paste)

**App name:** `GoSee`

**Subtitle** (Apple, ≤30 chars): `Site-visit scheduling`

**Short description** (Google, ≤80 chars):
`Schedule supplier site visits and keep engineers and suppliers in sync.`

**Promotional text** (Apple, ≤170 chars):
`Arrange supplier site visits in seconds. GoSee keeps procurement, engineers and suppliers in sync with automatic SMS updates at every step.`

**Keywords** (Apple, ≤100 chars, comma-separated):
`procurement,site visit,supplier,scheduling,inspection,engineer,field,visits,b2b`

**Full description** (both stores):

```
GoSee makes supplier site visits simple.

GoSee is a scheduling and coordination tool for procurement teams that arrange
visits between field engineers and suppliers. Instead of long email and phone
chains, GoSee automates the process and keeps everyone updated by SMS.

How it works:
- Procurement creates a job and assigns an engineer.
- The engineer picks a visit time from a simple 3-day scheduler.
- The selected suppliers are invited and confirm availability in one tap.
- When enough suppliers accept, the visit locks automatically and everyone is notified.
- After the visit, the engineer records attendance and procurement closes the job.

Key features:
- One-tap SMS login - no passwords to remember.
- Clear, role-based views for Engineers and Suppliers.
- Automatic SMS notifications at every step.
- A fast, Teams-style time picker that respects working hours.
- Live status so you always know where each visit stands.

GoSee is a business tool. Accounts are provided by your organisation's procurement team.
```

**Category:** Primary **Business** · Secondary **Productivity**
**Price:** Free
**Support URL:** `https://gosee-phi.vercel.app/support`
**Marketing URL** (optional): `https://gosee-phi.vercel.app/`
**Privacy Policy URL:** `https://gosee-phi.vercel.app/privacy`

**Age rating:** No objectionable content → **Apple 4+ / Google Everyone**.

**Privacy / Data Safety answers** (same facts for both):
- Data collected: **Name**, **Phone number** (account & login), **App activity**
  (jobs/visits you create or respond to).
- Purpose: **App functionality** and **Account management** only.
- Not used for advertising or tracking. Not sold.
- Shared only with service providers that run the app (Supabase hosting, Text.lk SMS).
- Data is encrypted in transit; users can request deletion (via support email).

---

## 2. Apple App Store (you already have a TestFlight build)

1. Go to **appstoreconnect.apple.com → My Apps → GoSee**.
2. Top-left, click **(＋) → iOS App** version `1.0` if there isn't a draft version.
3. Fill the **App Store** tab using Section 1 above:
   - Screenshots (6.7"), Promotional text, Description, Keywords, Support URL,
     Marketing URL.
4. **Build:** scroll to *Build* → **＋** → select your uploaded build (the one from
   `eas build`). If it's not there yet, run a build + `eas submit` first.
5. **General → App Privacy:** click *Get Started* and enter the data-safety facts above.
6. **Age Rating:** answer *No* to everything → 4+.
7. **App Review Information:**
   - Sign-in required: **Yes**. Username/phone: `0771000001`, Password/code: `000000`.
   - Notes: *"GoSee is a B2B role-based tool. Log in with the demo number above and
     code 000000 to see the Engineer experience. SMS login codes are normally sent
     to registered users; this test number uses a fixed code for review."*
   - Contact first/last name, phone, email.
8. **Pricing and Availability:** Free, choose countries (e.g. Sri Lanka + others).
9. Click **Add for Review → Submit**. Review usually takes 24–48 hours.

> Tip: if Apple asks why access is limited to invited users, reply that GoSee is a
> business/enterprise tool and the demo account demonstrates full functionality.
> (If you ever want it NOT public, you can distribute privately via Apple Business
> Manager "Custom Apps" instead — ask us.)

---

## 3. Google Play

### 3a. Build the Android app (.aab)
```bash
cd "/Users/thamindu/Desktop/WIWIS /Nestle/Gosee/GoSee Project/mobile"
npx eas-cli build --platform android --profile production
```
- When asked **"Generate a new Android Keystore?"** → **Yes** (EAS keeps it safely).
- When it finishes, **download the `.aab`** from the link it prints.

### 3b. Create the app in Play Console
1. Go to **play.google.com/console → Create app**.
2. Name `GoSee`, default language English, type **App**, **Free**, accept declarations.

### 3c. Fill "App content" (left menu → Policy → App content)
- **Privacy policy:** `https://gosee-phi.vercel.app/privacy`
- **App access:** *All functionality is restricted* → add instructions:
  "Log in on the mobile app with phone 0771000001 and code 000000."
- **Ads:** No.
- **Content rating:** fill the questionnaire → Everyone.
- **Target audience:** 18+ (business tool) — or 13+; no children.
- **Data safety:** enter the facts from Section 1 (Name, Phone, App activity;
  functionality/account; encrypted in transit; deletion available).
- **Government app:** No.

### 3d. Main store listing (left menu → Grow → Store presence → Main store listing)
- Short description + Full description (Section 1).
- **App icon:** `store-assets/play-icon-512.png`
- **Feature graphic:** `store-assets/play-feature-1024x500.png`
- **Phone screenshots:** your 2–8 captures.

### 3e. Release to Production
1. Left menu → **Production → Create new release**.
2. Upload the `.aab` from step 3a.
3. Release name `1.0`, release notes e.g. "First release of GoSee."
4. **Review release → Start rollout to Production.**

> Important: brand-new **individual** Google developer accounts must run **Closed
> testing with 20 testers for 14 days** before Production is unlocked. **Organisation
> / company** accounts are usually exempt. If Production is locked, do a Closed
> testing release first (same AAB), add 20 testers, wait 14 days, then promote.

---

## 4. After you submit
- Apple: watch the status in App Store Connect; they email if anything's needed.
- Google: first review can take a few days; status shows in the Publishing overview.
- Common reasons for rejection and how we've pre-handled them:
  - *Login wall* → demo account provided (Section 0/1).
  - *Privacy policy* → live page provided.
  - *Icon transparency* (Apple) → icon is already opaque navy.
  - *Encryption question* (Apple) → already set `ITSAppUsesNonExemptEncryption: false`.

When you're ready, tell us and we can: capture polished screenshots, set up
`eas submit` for one-command uploads, or walk through any form field together.
```
