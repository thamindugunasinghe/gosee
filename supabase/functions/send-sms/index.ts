// Processes queued rows in notification_log and delivers them through Text.lk.
// Invoked by the dashboard after an action queues notifications, and later by
// pg_cron as a sweeper so nothing stays queued if a direct invocation is missed.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { sendSms } from "../_shared/textlk.ts";

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
);

// Branded, structured SMS: a "GoSee - <label>" header line above the body, so
// every message reads like a product notification rather than a raw string.
// Kept to GSM-7 safe characters so messages stay one segment where possible.
const HEADERS: Record<string, string> = {
  "N-01": "New site visit",
  "N-02": "Visit invitation",
  "N-03": "Visit confirmed",
  "N-04": "Reminder",
  "N-05": "Reminder",
  "N-06": "Action needed",
  "N-07": "Job update",
  "N-08": "Reminder",
};

function brandMessage(type: string | null, body: string): string {
  const label = (type && HEADERS[type]) || "Notification";
  const clean = (body ?? "").replace(/Go See/g, "GoSee").trim();
  return `GoSee - ${label}\n${clean}`;
}

Deno.serve(async (req) => {
  // The platform has already verified the JWT signature (verify_jwt). Signed-in
  // users (mobile app after an action) and service-role callers (dashboard, cron)
  // may trigger a sweep; the sweep only delivers already-queued messages and
  // returns counts, never message contents.
  try {
    const token = (req.headers.get("Authorization") ?? "").replace("Bearer ", "");
    const payload = JSON.parse(atob(token.split(".")[1]));
    if (payload.role !== "service_role" && payload.role !== "authenticated") {
      throw new Error("not authorized");
    }
  } catch {
    return new Response(JSON.stringify({ error: "unauthorized" }), { status: 401 });
  }

  // DEMO MODE: when system_config.demo_sms_redirect holds a number, every message
  // is delivered to THAT number (labelled with the real recipient) so a whole
  // multi-role flow can be shown on one phone. Clear it to return to normal.
  let redirect = "";
  const { data: cfgRow } = await supabase
    .from("system_config").select("value").eq("key", "demo_sms_redirect").maybeSingle();
  if (cfgRow?.value) redirect = String(cfgRow.value).trim();

  const { data: queued, error } = await supabase
    .from("notification_log")
    .select("id, recipient_mobile, message, message_type")
    .eq("status", "queued")
    .eq("channel", "sms")
    .order("created_at", { ascending: true })
    .limit(50);

  if (error) {
    return new Response(JSON.stringify({ error: error.message }), { status: 500 });
  }

  let sent = 0;
  let failed = 0;

  for (const n of queued ?? []) {
    const to = redirect || n.recipient_mobile;
    if (!to) {
      await supabase.from("notification_log")
        .update({ status: "failed", error: "no recipient mobile" })
        .eq("id", n.id);
      failed++;
      continue;
    }
    let body = brandMessage(n.message_type, n.message);
    if (redirect) body += `\n(demo: intended for ${n.recipient_mobile ?? "unregistered number"})`;
    const result = await sendSms(to, body);
    await supabase.from("notification_log")
      .update(
        result.ok
          ? { status: "sent", sent_at: new Date().toISOString(), provider_message_id: result.providerMessageId ?? null }
          : { status: "failed", error: result.error ?? "unknown error" },
      )
      .eq("id", n.id);
    result.ok ? sent++ : failed++;
  }

  return new Response(JSON.stringify({ processed: (queued ?? []).length, sent, failed }), {
    headers: { "Content-Type": "application/json" },
  });
});
