// Shared helpers for the demo seed + reset scripts.
import { createClient } from "@supabase/supabase-js";
import { readFileSync, existsSync, writeFileSync, unlinkSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
export const STATE_FILE = join(HERE, ".demo-state.json");

export function db() {
  const env = readFileSync(join(HERE, "../dashboard/.env.local"), "utf8");
  const url = env.match(/NEXT_PUBLIC_SUPABASE_URL=(.*)/)[1].trim();
  const key = env.match(/SUPABASE_SERVICE_ROLE_KEY=(.*)/)[1].trim();
  return createClient(url, key, { auth: { persistSession: false } });
}

export function toE164(raw) {
  let n = String(raw).replace(/[^\d]/g, "");
  if (n.startsWith("0")) n = "94" + n.slice(1);
  if (!n.startsWith("94")) n = "94" + n;
  return "+" + n;
}

export function loadState() {
  if (!existsSync(STATE_FILE)) return null;
  try {
    return JSON.parse(readFileSync(STATE_FILE, "utf8"));
  } catch {
    return null;
  }
}

export function saveState(state) {
  writeFileSync(STATE_FILE, JSON.stringify(state, null, 2));
}

export function clearState() {
  if (existsSync(STATE_FILE)) unlinkSync(STATE_FILE);
}

// Deterministic markers so cleanup works even if a previous seed failed partway
// (before its state file was written) and left orphaned accounts behind.
export const DEMO_COMPANY_NAMES = [
  "BrightSpark Electricals", "PowerGrid Solutions", "Metro Electricals",
  "Voltcare Services", "BuildRight Civil", "StoneWorks Ltd",
];
export const DEMO_MOBILES = [
  "+94771000001", "+94771000002",
  "+94772000001", "+94772000002", "+94772000003", "+94772000004", "+94772000005", "+94772000006",
  "+94702111487",
];
// Demo dashboard (Procurement) logins created for client testing.
export const DEMO_EMAILS = ["client.demo@gosee.lk"];

/** Remove every demo entity — by tracked state AND by markers. FK-safe order. */
export async function cleanup(s, state) {
  const jobIds = new Set(state?.jobs ?? []);
  const supIds = new Set(state?.suppliers ?? []);
  const userIds = new Set(state?.users ?? []);

  // Markers: DEMO-* jobs, demo-named suppliers (+ their contacts), demo-numbered users
  const { data: mJobs } = await s.from("jobs").select("id").like("pr_reference", "DEMO-%");
  (mJobs ?? []).forEach((j) => jobIds.add(j.id));
  const { data: mSup } = await s.from("supplier_companies").select("id, contact_user_id").in("company_name", DEMO_COMPANY_NAMES);
  (mSup ?? []).forEach((x) => { supIds.add(x.id); if (x.contact_user_id) userIds.add(x.contact_user_id); });
  const { data: mUsers } = await s.from("profiles").select("id").in("mobile", DEMO_MOBILES);
  (mUsers ?? []).forEach((u) => userIds.add(u.id));
  const { data: mEmails } = await s.from("profiles").select("id").in("email", DEMO_EMAILS);
  (mEmails ?? []).forEach((u) => userIds.add(u.id));

  const jobs = [...jobIds], suppliers = [...supIds], users = [...userIds];

  // 1. Dependent activity that would block deletes
  if (jobs.length) {
    const { data: cyc } = await s.from("job_cycles").select("id").in("job_id", jobs);
    const cycleIds = (cyc ?? []).map((c) => c.id);
    if (cycleIds.length) await s.from("reminder_schedule").delete().in("cycle_id", cycleIds);
    await s.from("notification_log").delete().in("job_id", jobs);
  }
  if (users.length) await s.from("audit_log").delete().in("actor_id", users);

  // 2. Jobs (cascade cycles, cycle_suppliers, closures)
  for (const id of jobs) await s.from("jobs").delete().eq("id", id);
  // 3. Suppliers (cascade supplier_categories) — before their contact users
  for (const id of suppliers) await s.from("supplier_companies").delete().eq("id", id);
  // 4. Auth users (cascade profiles)
  for (const id of users) await s.auth.admin.deleteUser(id).catch(() => {});
  // 5. Only categories/tiers the seed itself created (never shared ones)
  for (const t of state?.tiers ?? []) await s.from("sub_categories").delete().eq("id", t.id);
  for (const c of state?.categories ?? []) await s.from("categories").delete().eq("id", c.id);
}
