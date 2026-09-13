// DEV ONLY — simulate the Procurement closure SLA elapsing so the manager
// escalation SMS fires immediately, instead of waiting the real 3 days.
//
//   node scripts/simulate-procurement-sla.mjs <PR-number>
//
// Requires the cycle to already be AWAITING_PROCUREMENT_CLOSE (i.e. the engineer
// has closed the visit). It backdates the engineer's closure past the SLA, runs
// the timer worker, and delivers the queued SMS. The alert goes to the number in
// Settings → Procurement alerts mobile (set it first, or nothing is delivered).
import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const pr = process.argv[2];
if (!pr) {
  console.error("Usage: node scripts/simulate-procurement-sla.mjs <PR-number>");
  process.exit(1);
}

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const env = readFileSync(join(root, "dashboard/.env.local"), "utf8");
const url = env.match(/NEXT_PUBLIC_SUPABASE_URL=(.*)/)[1].trim();
const key = env.match(/SUPABASE_SERVICE_ROLE_KEY=(.*)/)[1].trim();
const db = createClient(url, key);

const { data: job } = await db.from("jobs").select("id, created_by").eq("pr_reference", pr).single();
if (!job) {
  console.error(`No job found with PR ${pr}`);
  process.exit(1);
}

const { data: cycle } = await db
  .from("job_cycles")
  .select("id, cycle_no, status")
  .eq("job_id", job.id)
  .order("cycle_no", { ascending: false })
  .limit(1)
  .single();

if (cycle.status !== "AWAITING_PROCUREMENT_CLOSE") {
  console.error(
    `Cycle R${cycle.cycle_no} is ${cycle.status} — the engineer must Close the visit first ` +
      `(run scripts/time-travel.mjs ${pr}, then close it in the app).`,
  );
  process.exit(1);
}

// Read the SLA and backdate the closure to just past it (SLA + 1 day ago).
const { data: slaCfg } = await db.from("system_config").select("value").eq("key", "procurement_closure_sla_days").single();
const slaDays = Number(slaCfg?.value ?? 3);
const backdated = new Date(Date.now() - (slaDays + 1) * 86400_000).toISOString();

const { error: upErr } = await db.from("engineer_closures").update({ closed_at: backdated }).eq("cycle_id", cycle.id);
if (upErr) {
  console.error("Could not backdate closure:", upErr.message);
  process.exit(1);
}
console.log(`Closure for PR ${pr} backdated to ${backdated} (SLA is ${slaDays} days).`);

// Run the timer worker, then deliver whatever it queued.
const { data: timers, error: tErr } = await db.rpc("rpc_run_timers");
if (tErr) {
  console.error("Timer worker failed:", tErr.message);
  process.exit(1);
}
console.log("Timer worker:", JSON.stringify(timers));

const { error: sErr } = await db.functions.invoke("send-sms", { body: {} });
console.log("SMS delivery:", sErr ? "ERROR " + sErr.message : "triggered");

// Show the result.
const { data: last } = await db
  .from("notification_log")
  .select("message_type, recipient_mobile, status, error")
  .eq("cycle_id", cycle.id)
  .eq("message_type", "N-08")
  .order("created_at", { ascending: false })
  .limit(1);
console.log("Manager escalation:", JSON.stringify(last?.[0] ?? "none queued"));
if (last?.[0]?.status === "failed" && last[0].error === "no recipient mobile") {
  console.log("\n>>> Set Settings → Procurement alerts mobile, then re-run this command.");
}
