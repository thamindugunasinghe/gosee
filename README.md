# Go See

Standalone web + mobile platform coordinating procurement site visits between Procurement, Engineers and Suppliers. Built per `GoSee_Architecture_Requirement_Analysis_v3_0.pdf` — see [PLAN.md](PLAN.md) for the full build plan.

**Stack:** Supabase (Postgres, Auth, Edge Functions, Storage) · Text.lk SMS gateway · Next.js dashboard · Expo mobile app (Phase 4)

## Repository layout

| Path | Contents |
|---|---|
| `supabase/migrations/` | Schema, RLS policies, transactional RPCs |
| `supabase/seed.sql` | Section-12 configuration defaults |
| `supabase/functions/send-sms/` | Delivers queued notifications through Text.lk |
| `supabase/functions/send-sms-hook/` | Supabase Auth hook — login OTPs via Text.lk |
| `dashboard/` | Next.js Procurement dashboard |
| `mobile/` | Expo app for Engineers + Suppliers (Phase 4, not started) |

## Local development

Requirements: Node 22+, Docker Desktop.

```bash
npm install                  # supabase CLI
npm run db:start             # local Supabase stack (applies migrations + seed)
cd dashboard && npm install
cp .env.local.example .env.local   # fill values printed by `npm run db:start`
npm run dev
```

Create the first dashboard login (local):

```bash
# after db:start, open http://127.0.0.1:54323 (Studio) -> Auth -> Add user (email+password),
# then insert a matching row in public.profiles with role 'procurement'.
```

## Production setup

1. Create a Supabase project; `npx supabase link` then `npm run db:push`.
2. Deploy functions: `npx supabase functions deploy send-sms send-sms-hook`.
3. Set function secrets: `TEXTLK_API_TOKEN`, `TEXTLK_SENDER_ID`, `SEND_SMS_HOOK_SECRET`.
4. In Supabase Auth → Hooks, point **Send SMS** at the `send-sms-hook` function (enables OTP login via Text.lk).
5. Fill `dashboard/.env.local` with the project URL, anon key and service-role key.

## SMS pipeline

Business events insert rows into `notification_log` (status `queued`). The `send-sms` function delivers queued rows through Text.lk and records `sent`/`failed` with the provider message id. Dashboard actions invoke it directly after queueing; a pg_cron sweeper (added with the scheduling engine in Phase 5) re-delivers anything missed.
