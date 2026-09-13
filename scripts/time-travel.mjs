// DEV ONLY - move a confirmed visit into the past so the post-visit flow can be
// tested immediately instead of waiting for the real visit time.
//
//   node scripts/time-travel.mjs <PR-number>
//
// Finds the latest cycle of that PR; if it is CONFIRMED / VISIT_PENDING, shifts
// selected_time two hours into the past and marks it AWAITING_ENGINEER_CLOSE.
// Never use against production data you care about.
import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const pr = process.argv[2];
if (!pr) {
  console.error("Usage: node scripts/time-travel.mjs <PR-number>");
  process.exit(1);
}

const env = readFileSync(join(dirname(fileURLToPath(import.meta.url)), "../dashboard/.env.local"), "utf8");
const url = env.match(/NEXT_PUBLIC_SUPABASE_URL=(.*)/)[1].trim();
const key = env.match(/SUPABASE_SERVICE_ROLE_KEY=(.*)/)[1].trim();
const db = createClient(url, key);

const { data: job } = await db.from("jobs").select("id, pr_reference").eq("pr_reference", pr).single();
if (!job) {
  console.error(`No job found with PR ${pr}`);
  process.exit(1);
}

const { data: cycle } = await db
  .from("job_cycles")
  .select("id, cycle_no, status, selected_time")
  .eq("job_id", job.id)
  .order("cycle_no", { ascending: false })
  .limit(1)
  .single();

if (!["CONFIRMED", "VISIT_PENDING", "AWAITING_ENGINEER_CLOSE"].includes(cycle.status)) {
  console.error(`Cycle R${cycle.cycle_no} is ${cycle.status} - only confirmed visits can be time-travelled.`);
  process.exit(1);
}

const past = new Date(Date.now() - 2 * 3600_000).toISOString();
const { error } = await db
  .from("job_cycles")
  .update({ selected_time: past, response_cutoff: past, status: "AWAITING_ENGINEER_CLOSE" })
  .eq("id", cycle.id);
if (error) {
  console.error("Update failed:", error.message);
  process.exit(1);
}
console.log(`PR ${pr} cycle R${cycle.cycle_no}: visit time moved to ${past}, status AWAITING_ENGINEER_CLOSE.`);
console.log("Open the engineer app - the job now appears under 'Close visit'.");
