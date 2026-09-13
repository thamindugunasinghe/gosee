// Toggle the demo SMS redirect: send EVERY outgoing message to one OR MORE phones
// so a full multi-role flow can be watched during a demo.
//
//   node scripts/demo-sms-to.mjs 0770611071 0702111487   # all SMS -> both numbers
//   node scripts/demo-sms-to.mjs 0702111487              # all SMS -> one number
//   node scripts/demo-sms-to.mjs off                     # back to normal delivery
import { db, toE164 } from "./demo-lib.mjs";

const s = db();
const args = process.argv.slice(2).flatMap((a) => a.split(",")).map((a) => a.trim()).filter(Boolean);
if (args.length === 0) {
  console.error("Usage: node scripts/demo-sms-to.mjs <07XXXXXXXX> [07YYYYYYYY ...] | off");
  process.exit(1);
}

const value = args[0].toLowerCase() === "off" ? "" : args.map(toE164).join(",");

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
    ? `Demo redirect ON — every SMS will now go to: ${value} (labelled with the real recipient).`
    : "Demo redirect OFF — messages go to their real recipients again.",
);
