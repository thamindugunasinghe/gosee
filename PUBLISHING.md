# GoSee — App Store & Google Play Publishing Guide

Everything to take GoSee live on the **Apple App Store** and **Google Play**, plus
the exact text/answers to paste into each form.

> Company name `WIWIS AI` and contact email `team@wiwisai.com` are set in the legal
> pages. Make sure the `team@wiwisai.com` inbox is monitored — app reviewers may email it.

---

## 0. Shared assets (used by both stores)

**Live URLs** (public pages are now on your Vercel site — push + redeploy to activate):
- Privacy Policy: `https://gosee.wiwisai.com/privacy`
- Terms of Use: `https://gosee.wiwisai.com/terms`
- Support: `https://gosee.wiwisai.com/support`
- Marketing/home: `https://gosee.wiwisai.com/`

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
**Support URL:** `https://gosee.wiwisai.com/support`
**Marketing URL** (optional): `https://gosee.wiwisai.com/`
**Privacy Policy URL:** `https://gosee.wiwisai.com/privacy`

**Age rating:** No objectionable content → **Apple 4+ / Google Everyone**.

**Privacy / Data Safety answers** (same facts for both):
- Data collected: **Name**, **Phone number** (account & login), **App activity**
  (jobs/visits you create or respond to).
- Purpose: **App functionality** and **Account management** only.
- Not used for advertising or tracking. Not sold.
- Shared only with service providers that run the app (Supabase hosting, Text.lk SMS).
- Data is encrypted in transit; users can request deletion (via support email).

---

## 2. Apple App Store — step by step (you already have a TestFlight build)

**Where everything lives:** a website called **App Store Connect**. Open a web
browser (on a computer is easiest) and go to **appstoreconnect.apple.com**. Sign in
with the Apple ID of your Apple Developer account.

### Step 1 — Open (or create) the GoSee app
- On the home page, click **Apps**.
- If you see **GoSee** in the list, click it and skip to Step 2.
- If it's NOT there: click the **blue + button** (top-left, under "Apps") → **New App**, then fill:
  - Platforms: tick **iOS**
  - Name: `GoSee`
  - Primary Language: **English (U.S.)**
  - Bundle ID: choose **com.wiwis.gosee** from the dropdown
  - SKU: type anything, e.g. `gosee-001`
  - User Access: **Full Access**
  - Click **Create**.

### Step 2 — Open the version page
- On the GoSee page, look at the **left sidebar**. Under "iOS App" click the
  version that says **"1.0 Prepare for Submission"**. This page has all the boxes below.

### Step 3 — Fill each box (copy from Section 1 above)
- **Previews and Screenshots** (near the top): drag your phone screenshots into the
  box. Use the **6.7-inch** tab.
- **Promotional Text** box → paste the Promotional text.
- **Description** box → paste the Full description.
- **Keywords** box → paste the Keywords.
- **Support URL** box → type `https://gosee.wiwisai.com/support`
- **Marketing URL** box → type `https://gosee.wiwisai.com/`

### Step 4 — Attach the app build
- Scroll down on the same page to the **Build** section.
- Click **"Add Build"** (or the **+**). Pick the build you uploaded with `eas` → **Done**.
- *(If no build appears, it hasn't been uploaded yet. In Terminal run:
  `cd mobile && npx eas-cli submit --platform ios --latest`, wait ~10 min, refresh.)*

### Step 5 — Age rating
- Scroll to **General Information** → next to **Age Rating** click **Edit** → answer
  **No / None** to every question → **Done**. It shows **4+**.

### Step 6 — App Privacy (data safety)
- In the **left sidebar** click **App Privacy** → **Get Started** (or **Edit**).
- Add these data types, each marked **"Used for App Functionality"**, **linked to the
  user = Yes**, **Not used for tracking**: **Name**, **Phone Number**, **Product
  Interaction** (app activity). → **Publish**.

### Step 7 — App Review Information (so Apple can log in)
- Back on the version page, scroll to **App Review Information**.
- Tick **"Sign-in required"**. In the two boxes:
  - **User name**: `0771000001`
  - **Password**: `000000`
- In the **Notes** box, paste:
  `GoSee is a business (B2B) app with role-based access. Please sign in on the app with phone 0771000001 and code 000000 to see the Engineer experience. Real users receive SMS login codes; this test number uses a fixed code for review.`
- Fill **Contact Information** (your first/last name, phone, email).

### Step 8 — Price and submit
- **Left sidebar → Pricing and Availability** → set price to **Free** → pick the
  countries you want (e.g. Sri Lanka, or all).
- Go back to the version page. **Top-right**, click **Add for Review**, then
  **Submit for Review**. Done — review usually takes 1–2 days.

> If Apple asks why login is required, reply: "GoSee is a business/enterprise tool;
> the demo account provided shows full functionality." (You can also distribute it
> privately through Apple Business Manager instead of the public store — ask us.)

---

## 3. Google Play — step by step

**Where everything lives:** a website called **Google Play Console** at
**play.google.com/console**. Sign in with your Google Play developer account.

### Step 1 — Build the Android file (on your Mac)
Open **Terminal** and run:
```bash
cd "/Users/thamindu/Desktop/WIWIS /Nestle/Gosee/GoSee Project/mobile"
npx eas-cli build --platform android --profile production
```
- When it asks **"Generate a new Android Keystore?"** type **Yes** (EAS keeps it safe).
- Wait ~15 min. At the end it prints a link — open it and click **Download** to get
  the **`.aab`** file (save it somewhere easy, like your Desktop).

### Step 2 — Create the app
- In Play Console, click **Create app** (top-right).
- App name: `GoSee` · Default language: **English** · App or game: **App** ·
  Free or paid: **Free** · tick the declaration boxes → **Create app**.

### Step 3 — Fill "App content" (left menu → **Policy and programmes → App content**)
Click into each item and complete it:
- **Privacy policy** → paste `https://gosee.wiwisai.com/privacy` → Save.
- **App access** → choose **"All or some functionality is restricted"** → **Add new
  instructions** → Name: `Demo login`, type: enter phone `0771000001` and code
  `000000`, and in the notes write "Log in on the app with this number and code." → Save.
- **Ads** → **No, my app does not contain ads**.
- **Content ratings** → **Start questionnaire** → email `team@wiwisai.com`, category
  **Utility/Productivity/Communication**, answer **No** to all content questions → Submit.
- **Target audience and content** → choose age groups (e.g. **18+**); no children → Save.
- **Data safety** → **Start** → say **Yes, collects data** → select **Name**,
  **Phone number**, **App activity**; mark each **collected, not shared**, purpose
  **App functionality / Account management**, **encrypted in transit**, users **can
  request deletion** → Save and submit.
- **Government apps** → **No**.

### Step 4 — Store listing (left menu → **Grow → Store presence → Main store listing**)
- **App name:** `GoSee`
- **Short description** box → paste the Google short description (Section 1).
- **Full description** box → paste the Full description (Section 1).
- **App icon** → upload `store-assets/play-icon-512.png`
- **Feature graphic** → upload `store-assets/play-feature-1024x500.png`
- **Phone screenshots** → upload your 2–8 phone screenshots → **Save**.

### Step 5 — Upload the app and release (left menu → **Production**)
- Click **Production** → **Create new release** (top-right).
- Under **App bundles**, click **Upload** and choose the **`.aab`** file from Step 1.
- **Release name:** `1.0` · **Release notes:** `First release of GoSee.`
- Click **Next / Save**, then **Review release**, then **Start roll-out to Production**.

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
