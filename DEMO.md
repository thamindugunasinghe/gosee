# GoSee — Client Demo Guide

Everything you need to show the whole system in a meeting. Test accounts all log
in with the master code **`000000`** (no real SMS needed for login).

---

## A. One-time setup before the meeting

**1. Seed the demo data** (test engineers, suppliers, categories, and 5 jobs across
every state). Already done, but re-run any time to get a clean slate:

```bash
cd "/Users/thamindu/Desktop/WIWIS /Nestle/Gosee/GoSee Project" && node scripts/demo-seed.mjs
```

**2. Turn on the master OTP.** In the Supabase dashboard →
**Authentication → Sign In / Providers → Phone → "Test phone numbers and OTPs"**,
paste this and Save:

```
94771000001=000000,94771000002=000000,94772000001=000000,94772000002=000000,94772000003=000000,94772000004=000000,94772000005=000000,94772000006=000000
```

**3. Deploy the branded-SMS + demo-redirect update.** Run in the terminal logged
into the production Supabase account (set the token first if you get a 403):

```bash
export SUPABASE_ACCESS_TOKEN="PASTE_PROD_ACCOUNT_TOKEN"
npx supabase functions deploy send-sms --use-api
```

**3b. Send every SMS to YOUR phone for the demo.** With this on, *all* messages
(job assigned, invitation, confirmed, alerts — from every account) arrive on one
phone, each labelled with who it was really for. Already set to +94702111487 —
change it to your number:

```bash
node scripts/demo-sms-to.mjs 07XXXXXXXX
```

Turn it off after the demo: `node scripts/demo-sms-to.mjs off`

**4. Start the dashboard and the app:**

```bash
cd "/Users/thamindu/Desktop/WIWIS /Nestle/Gosee/GoSee Project/dashboard" && npm run dev
```
```bash
cd "/Users/thamindu/Desktop/WIWIS /Nestle/Gosee/GoSee Project/mobile" && npx expo start
```

---

## Demo logins

| Role | Name | Mobile | Code |
|------|------|--------|------|
| Procurement (dashboard) | your admin | your email + password | — |
| Engineer | Nuwan Perera | 0771000001 | 000000 |
| Engineer | Kasun Silva | 0771000002 | 000000 |
| Supplier | Ajith (BrightSpark) | 0772000001 | 000000 |
| Supplier | Dilani (PowerGrid) | 0772000002 | 000000 |
| Supplier | Ruwan (Metro) | 0772000003 | 000000 |
| Supplier | Saman (BuildRight) | 0772000005 | 000000 |

Pre-loaded jobs: **DEMO-1001** … **DEMO-1005**, one in each stage.

---

## B. The demo flow (suggested story, ~10 min)

### 1. Dashboard overview
- Sign in to the dashboard. Point out the **status tiles** — one job sits in every
  stage (awaiting time, responses, confirmed, awaiting close, closed). The numbers
  count up on load.

### 2. Create a job (live)
- **Create Job** → PR e.g. `PR-2050`, description, pick engineer **Nuwan Perera**,
  category **Electrical / High**, select the 3 Electrical suppliers → **Create**.
- Say: *"The engineer is instantly notified by SMS."* (Nuwan's phone gets it.)

### 3. Engineer picks a visit time (live, on the app)
- Open the app → log in as **Nuwan / 0771000001 / 000000**.
- Open **DEMO-1001** (or the job you just made) → **Select visit time** → show the
  Teams-style day + time picker → pick a slot → **Confirm**.
- Say: *"All selected suppliers are now invited by SMS to accept this time."*

### 4. Supplier confirms — auto-locks (the wow moment)
- On the app, log in as **Ruwan / 0772000003 / 000000**.
- Open **DEMO-1002** (two suppliers already accepted) → tap **Available**.
- The visit **instantly confirms** — everyone gets the confirmation SMS. Show the
  dashboard: DEMO-1002 flips to **Confirmed**.

### 5. Engineer closes the visit
- The visit for **DEMO-1004** already happened. Log in as **Kasun / 0771000002**,
  open it → **Close visit** → mark who attended → submit.
- Say: *"Procurement is alerted to finalise."*

### 6. Procurement closes or recirculates (dashboard)
- Dashboard → **Jobs** → click **DEMO-1004** → the **Final closure** panel.
- Show **Close job**, or **Recirculate** (pick category/tier → choose fresh
  suppliers — the ones who already attended are hidden automatically).

### 7. Everything is configurable — Settings
- Open **Settings**: the 3-supplier threshold, the 72-hour window, working hours,
  reminder timings, and the Procurement alert number — all editable, no code.

### 8. Management screens
- **Users**, **Suppliers**, **Categories** — show how Procurement manages the
  master data.

---

## C. After the demo — return to normal

Run these **three** steps to fully undo the demo. Your real data and settings are
never touched.

**1. Stop redirecting SMS** — messages go back to their real recipients:
```bash
cd "/Users/thamindu/Desktop/WIWIS /Nestle/Gosee/GoSee Project"
node scripts/demo-sms-to.mjs off
```

**2. Remove all demo data** — deletes the demo accounts, suppliers, categories and
DEMO-* jobs only (real data untouched):
```bash
node scripts/demo-reset.mjs
```

**3. Turn off the master OTP** — in Supabase → **Authentication → Sign In /
Providers → Phone → "Test phone numbers and OTPs"**, clear the box and **Save**.
(Otherwise `000000` keeps working as a login code.)

That's it — the system is back to normal production behaviour: real SMS to real
people, real OTP login for real registered numbers.

### To run the demo again later
```bash
node scripts/demo-sms-to.mjs 07XXXXXXXX   # your phone
node scripts/demo-seed.mjs                # re-create demo data
```
…then re-paste the Test OTP list (step A2) and Save.

---

### Does the demo affect normal operation?
**No.** Everything it adds is reversible and isolated:
- **SMS redirect** and **master OTP** are just two switches — turned off = fully normal.
- Demo accounts/jobs are tagged and removed by the reset; your real data stays.
- The branded SMS wording is a permanent *improvement* — keep it, it helps real users too.

### Tips
- If a login says "not registered", re-run the seed and make sure the Test OTP
  list (step A2) is saved.
- During the "supplier confirms" moment, expect several SMS at once (each supplier
  + the engineer + Procurement are all notified) — that shows everyone stays in the loop.
- If the **dashboard ever looks unstyled** (plain text, no colours), it's only the
  local dev cache — never the hosted version. Fix it with:
  ```bash
  cd "/Users/thamindu/Desktop/WIWIS /Nestle/Gosee/GoSee Project/dashboard" && rm -rf .next && npm run dev
  ```
