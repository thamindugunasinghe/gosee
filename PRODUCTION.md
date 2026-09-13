# GoSee — Production migration runbook

Move the whole system to your new **production** Supabase project (in the other
account). The backend is 100% in migrations + edge functions, so this is mostly
running the same commands against the new project.

Replace `NEWREF` below with your new project's ref (the `xxxx` in
`https://xxxx.supabase.co`, seen in the new project's URL).

---

## 0. Gather from the NEW project (in the other account)

In the new project's dashboard:

- **Project ref** — from the URL, e.g. `abcdefgh12345678`.
- **API keys** — Settings → API → copy **anon/public** key and **service_role** key.
- **Database password** — the one you set when creating the project (or reset it at
  Settings → Database → Reset database password).
- **Personal Access Token** — click your avatar → Account → **Access Tokens** →
  Generate new token. This lets the CLI act on the *new* account without disturbing
  your old login.

---

## 1. Point the CLI at the new account + project

```bash
cd "/Users/thamindu/Desktop/WIWIS /Nestle/Gosee/GoSee Project"
export SUPABASE_ACCESS_TOKEN="PASTE_NEW_ACCOUNT_PERSONAL_ACCESS_TOKEN"
npx supabase link --project-ref NEWREF
```

`link` asks for the new project's **database password**. (Using the env var keeps
your old-account login untouched — it lasts only for this terminal window.)

---

## 2. Push the schema (all 12 migrations)

```bash
npx supabase db push
```

Expected: it applies `20260717000001` … `20260717000012`, ending "Finished".

**If it hangs at "Initialising login role"** (blocked DB port / keychain on your
network): use the SQL Editor fallback instead —
open the new project's SQL Editor, paste all of
`supabase/manual/production-full-schema.sql`, and Run. That creates every object
*and* records the migration history so `db push` stays in sync later.

---

## 3. Deploy the edge functions

```bash
npx supabase functions deploy send-sms --use-api
npx supabase functions deploy send-sms-hook --use-api
```

---

## 4. Set the function secrets on the new project

```bash
npx supabase secrets set 'TEXTLK_API_TOKEN=YOUR_TEXTLK_TOKEN' TEXTLK_SENDER_ID=YOUR_SENDER_ID
```

Wrap any value containing `|` in single quotes. (The `SEND_SMS_HOOK_SECRET` is set
in step 5, after the hook gives you one.)

---

## 5. Configure Auth in the new project dashboard

1. **Authentication → Sign In / Providers → Phone** → enable **Phone provider**,
   set **SMS OTP Expiry** to `300`. Leave the Twilio boxes empty.
2. **Authentication → Hooks → Send SMS hook** → Add hook → **HTTPS**:
   - URL: `https://NEWREF.supabase.co/functions/v1/send-sms-hook`
   - Generate secret → copy the `v1,whsec_…` value → Create hook.
3. Store that secret:
   ```bash
   npx supabase secrets set 'SEND_SMS_HOOK_SECRET=v1,whsec_PASTE_HERE'
   ```

---

## 6. Point the apps at the new project

**Dashboard** — edit `dashboard/.env.local`:

```
NEXT_PUBLIC_SUPABASE_URL=https://NEWREF.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=NEW_ANON_KEY
SUPABASE_SERVICE_ROLE_KEY=NEW_SERVICE_ROLE_KEY
```

**Mobile** — edit `mobile/.env`:

```
EXPO_PUBLIC_SUPABASE_URL=https://NEWREF.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=NEW_ANON_KEY
```

If the dashboard is hosted on Vercel, also update the same three variables in
Vercel → Project → Settings → Environment Variables, then redeploy.

---

## 7. Create real production data (clean start — no test rows)

```bash
# First admin/procurement login (reads dashboard/.env.local → now points to prod)
node scripts/create-admin.mjs you@company.com "AStrongPassword" "Your Name"
```

Then sign in to the dashboard and set up the real data:

1. **Settings** → set **Procurement alerts mobile** + confirm thresholds/times.
2. **Categories** → real main categories + tiers.
3. **Users** → real engineers (with real mobiles).
4. **Suppliers** → real suppliers with categories + tier.
5. (Optional) Auth → Phone → **Test OTPs** for app-store review accounts.

---

## 8. Verify end-to-end on production

- Sign in to the dashboard.
- Create a real job → engineer gets the SMS.
- Engineer picks a time → suppliers get invited → confirm flow works.

---

## Notes

- **Test data does not migrate** — production starts clean; you re-enter real
  categories/suppliers/users. (Only schema + config defaults come across, via
  migrations.)
- **Keep secrets out of git.** `.env.local` and `mobile/.env` are git-ignored.
- The old dev project stays intact for testing; switch back by re-linking to its
  ref (and unset `SUPABASE_ACCESS_TOKEN` to use your original login).
