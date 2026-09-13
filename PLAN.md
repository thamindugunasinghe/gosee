# GoSee — Build Plan (v1)

Based on: `GoSee_Architecture_Requirement_Analysis_v3_0.pdf` (v3.0, 2026-07-17)
Stack decision: **Supabase** (DB/Auth/Functions/Storage/Cron) + **Text.lk** (SMS gateway)

---

## 1. Tech Stack

| Layer | Choice | Why |
|---|---|---|
| Database | Supabase Postgres + Row Level Security | Relational model (Job → JobCycle → CycleSupplier), audit, RLS gives object-level authorization (SEC-08) |
| Auth | Supabase Auth — phone OTP for Engineer/Supplier (custom **Send-SMS hook → Text.lk**), email+password for Procurement/Admin | FR-01, FR-02; Supabase hashes OTPs, handles expiry/attempts (SEC-02..05) |
| Business logic | Supabase Edge Functions (Deno/TypeScript) | Threshold engine, cutoff decisions, recirculation, SMS sending — all server-side |
| Timers / workers | `pg_cron` (runs every minute) + `reminder_schedule` table + worker Edge Function | Durable "event catalogue" (§5.3): cutoff evaluation, closure reminders, SLA escalation. Survives restarts, idempotent by design |
| SMS | Text.lk HTTP API (`https://app.text.lk/api/v3/sms/send`) via one `send-sms` Edge Function + `notification_log` table | All 10 notification types (N-01..N-10) + OTP through one audited pipeline |
| Procurement Dashboard | Next.js 14 (App Router) + Tailwind + shadcn/ui | §10.1 — full admin web app |
| Engineer + Supplier Mobile | **One Expo (React Native) app** with role-based UI | §10.2/10.3 screens; one codebase, role decided at login (engineer sees scheduler/attendance, supplier sees respond/confirm). Can split later if Nestle requires two store listings |
| PDF Reports | Server-side generation in Next.js API route (`@react-pdf/renderer`), stored in Supabase Storage, short-lived signed URLs | FR-39, SEC-16 |
| File attachments | Supabase Storage (private bucket, type/size validation) | §8.4 attachments |
| Repo layout | Monorepo: `supabase/` (migrations + functions), `dashboard/` (Next.js), `mobile/` (Expo), `shared/` (types, status enums) | Single source of truth for statuses/config keys |

---

## 2. Database Schema (Supabase migrations)

Entities straight from §14, implemented as Postgres tables:

- `profiles` (extends auth.users): name, mobile, role (`procurement | procurement_manager | engineer | supplier_contact | system_admin`), department, designation, preferred_language, status
- `supplier_companies`: company_name (unique), contact_user_id → profiles, address, availability_contact, status
- `categories`, `sub_categories` (spend tiers), `supplier_categories` (M:N)
- `jobs`: pr_reference, description, title, engineer_id, location, priority, status, created_by
- `job_cycles`: job_id, cycle_no (R0, R1…), selected_time, response_cutoff, status, confirmation_source (`auto_threshold | procurement_override`), reschedule_reason
- `cycle_suppliers`: cycle_id, supplier_id, invited_at, response_status (`pending | available | not_available | no_response`), response_at, attendance_status (`attended | did_not_attend | not_marked`)
- `override_decisions`: cycle_id, decision (`proceed | reschedule`), justification (NOT NULL when proceed — DB CHECK), decided_by, decided_at
- `engineer_closures`: cycle_id, visit_happened, closed_by, closed_at
- `procurement_closures`: job_id, cycle_id, action (`close | recirculate | cancel`), reason, closed_by, closed_at
- `system_config`: key, value (jsonb), effective_from, updated_by, reason — seeded with §12 defaults
- `notification_log`: user_id, job_id, cycle_id, channel (`sms | app`), message_type (N-01..N-10, OTP), status, provider_message_id, sent_at
- `reminder_schedule`: cycle_id, reminder_type, due_at, recurrence, status, idempotency_key (unique), last_attempt, next_attempt
- `report_exports`: period, filters (jsonb), file_path, created_by
- `audit_log`: actor_id, action, entity_type, entity_id, old_value, new_value, ip, ts — populated by triggers + explicit writes

**Cycle status enum** (§7.6): `DRAFT, AWAITING_ENGINEER_TIME, AWAITING_SUPPLIER_RESPONSES, OVERRIDE_REQUIRED, RESCHEDULE_REQUIRED, CONFIRMED, VISIT_PENDING, AWAITING_ENGINEER_CLOSE, AWAITING_PROCUREMENT_CLOSE, RECIRCULATED, CLOSED, CANCELLED`

**Integrity enforced in DB (§14.2):**
- Partial unique index: one non-terminal cycle per job
- CHECK: override `proceed` requires non-empty justification
- Trigger: block inserting a `cycle_supplier` whose supplier has `attended` in any earlier cycle of the same job (BR-12)
- All state transitions via `SECURITY DEFINER` Postgres functions with row locking (`SELECT … FOR UPDATE`) — solves the third-response-vs-cutoff race (AC-26, SEC-10)

**RLS policies:** engineers see only assigned jobs; suppliers see only cycles where invited; procurement/admin by role. No client ever writes state tables directly — only RPC functions.

---

## 3. Core Business Logic (Edge Functions + Postgres RPCs)

| Function | Implements |
|---|---|
| `rpc_create_job` | Phase A: job + cycle R0 (AWAITING_ENGINEER_TIME), N-01 SMS to engineer |
| `rpc_select_time` | Phase B: validate lead time ≥ 24h, window ≤ 72h, working hours, slot increment; create response_cutoff (T−24h); schedule cutoff + supplier reminder events; N-02 invitations |
| `get_suggestions` | §7.2: other confirmed/pending visits of the selected suppliers inside the window, ranked, privacy-stripped (no PR/engineer details) |
| `rpc_supplier_respond` | Phase C: record response + timestamp; editable until lock/cutoff; **on 3rd Available inside the same transaction → lock time, status CONFIRMED, cancel pending cutoff decision, N-03 to all** (AC-11, AC-26) |
| `cutoff-worker` (cron) | At cutoff: 3+ → confirm; exactly 2 → OVERRIDE_REQUIRED + N-04; 0–1 → RESCHEDULE_REQUIRED + N-05 (BR-07) |
| `rpc_override_decide` | Proceed (justification mandatory) → CONFIRMED via override; Reschedule → back to engineer. Audited (BR-08) |
| `rpc_mark_attendance` / `rpc_close_cycle` | Phase D: per-supplier attended/did-not-attend, visit_happened, engineer close → starts Procurement SLA, N-07 |
| `closure-reminder-worker` (cron) | Visit time + 1h grace → N-06 SMS every 1h until closed (BR-10); Procurement SLA 3 days → N-08 to manager (BR-11) |
| `rpc_procurement_action` | Close / Cancel / **Recirculate**: new cycle R(n+1), eligible = previous not_available + no_response + did_not_attend + new matching suppliers, attended excluded (BR-12/13), N-09 |
| `send-sms` | Text.lk API call, templates per language (EN/SI/TA), delivery status → notification_log, retry policy |
| `send-sms-hook` | Supabase Auth hook: OTP delivery through Text.lk |

All worker actions carry idempotency keys (`cycle_id + event_type`) and are no-ops if cycle state already moved on.

---

## 4. Build Phases

**Phase 0 — Foundation (setup)**
Monorepo scaffold, Supabase project, Text.lk account + sender ID, secrets in Supabase Vault, CI-less local dev via `supabase start`.

**Phase 1 — Schema + Auth**
All migrations, enums, RLS, seed config (§12 defaults). Auth: email/password (dashboard) + phone OTP with Text.lk hook (mobile). Role-based session handling.

**Phase 2 — Master Data (Dashboard)**
User management (engineers, suppliers, procurement), supplier companies, categories/sub-categories with inline creation + duplicate prevention (FR-03..06), activate/deactivate.

**Phase 3 — Job Creation (Dashboard)**
Create Job screen: PR number/description, searchable engineer select, location, priority, category/sub-category filters, search-within-filtered, Select All, selected supplier summary, min-supplier warning (FR-07..12). N-01 SMS fires.

**Phase 4 — Engineer Scheduling (Mobile)**
OTP login, job inbox grouped by action, 3-day timeline with disabled invalid slots, supplier-visit suggestions, single time selection (FR-13..15). Invitations sent (FR-16).

**Phase 5 — Supplier Response + Threshold (Mobile + workers)**
Supplier inbox, invitation detail, Available/Not-available, third-response auto-lock, cutoff worker, reminders (FR-17..21, FR-25). This is the riskiest logic — race-condition tests here.

**Phase 6 — Override + Reschedule (Dashboard + Mobile)**
Override panel with mandatory justification, reschedule flow back to engineer timeline (FR-22..24).

**Phase 7 — Attendance + Closure (Mobile + Dashboard + workers)**
Attendance screen (Select All / individual), close cycle, closure reminders, Procurement attendance view, SLA countdown, manager escalation (FR-26..33).

**Phase 8 — Recirculation**
Eligibility engine, new-cycle creation, cycle history UI (FR-34..37).

**Phase 9 — Reporting + Config + Audit UI**
Monthly PDF export with filters and summary metrics (§11), configuration screens with change audit + validation (§12), audit log viewer, dashboard KPI tiles and job search/filters (FR-38..41).

**Phase 10 — Hardening + Acceptance**
Run all 26 acceptance criteria (AC-01..AC-26) as scripted tests, rate limiting on OTP endpoints, security header review, trilingual SMS templates (FR-42), backup config.

---

## 5. Configuration Defaults (seeded, all editable — §12)

Window 72h · Lead time 24h · Slot 30min · Threshold 3 · Override at exactly 2 · Cutoff T−24h · Min suppliers 3 (warn) · Grace 1h · Closure reminder every 1h · Procurement SLA 3 days · Supplier reminders: +6h after invite, −2h before cutoff · OTP: 5min validity / 60s resend / 5 attempts · Languages EN/SI/TA

## 6. Open Points Needing Client Sign-off (§18.3 — don't block build, defaults assumed)

1. 72 rolling hours vs today + 2 calendar days → **assume rolling 72h**
2. Site working days/hours → **assume Mon–Sat 08:00–17:00, configurable**
3. Fewer than 3 suppliers allowed? → **warn + require justification, allow**
4. Attendance correction after closure → **Procurement Admin with reason, audited**
5. Procurement Manager recipients for escalation → **config table, multiple numbers**

## 7. Suggested First Milestone

Phases 0–3 end-to-end: a job can be created on the dashboard and the engineer receives a real Text.lk SMS. That proves the whole pipeline (Supabase + Auth + SMS) before the complex scheduling logic.
