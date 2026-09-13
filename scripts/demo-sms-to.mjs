// Toggle the demo SMS redirect: send EVERY outgoing message to one phone so a
// full multi-role flow can be shown on a single device during a demo.
//
//   node scripts/demo-sms-to.mjs 0702111487   # all SMS -> this number
//   node scripts/demo-sms-to.mjs off           # back to normal delivery
import { db, toE164 } from "./demo-lib.mjs";

const s = db();
const arg = (process.argv[2] ?? "").trim();
if (!arg) {
  console.error("Usage: node scripts/demo-sms-to.mjs <07XXXXXXXX | off>");
  process.exit(1);
}

const value = arg.toLowerCase() === "off" ? "" : toE164(arg);

const { error } = await s
  .from("system_config")
  .upsert(
    { key: "demo_sms_redirect", value, description: "Demo only: redirect all SMS to this number" },
    { onConflict: "key" },
  );

if (error) {
  console.error("Failed:", error.message);
  process.exit(1);
}

console.log(
  value
    ? `Demo redirect ON — every SMS will now go to ${value} (labelled with the real recipient).`
    : "Demo redirect OFF — messages go to their real recipients again.",
);
