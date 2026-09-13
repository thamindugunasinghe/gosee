// Supabase Auth "Send SMS" hook — delivers login OTPs through Text.lk.
// Configure in Supabase Auth settings: Hooks -> Send SMS -> this function URL,
// and set SEND_SMS_HOOK_SECRET to the hook's signing secret.
// SEC-05: the OTP value is sent to the user and never written to any log table.

import { Webhook } from "https://esm.sh/standardwebhooks@1.0.0";
import { sendSms } from "../_shared/textlk.ts";

Deno.serve(async (req) => {
  const secret = Deno.env.get("SEND_SMS_HOOK_SECRET") ?? "";
  const payloadText = await req.text();

  let payload: { user?: { phone?: string }; sms?: { otp?: string } };
  try {
    if (secret) {
      const wh = new Webhook(secret.replace("v1,whsec_", ""));
      payload = wh.verify(payloadText, Object.fromEntries(req.headers)) as typeof payload;
    } else {
      payload = JSON.parse(payloadText);
    }
  } catch {
    return new Response(JSON.stringify({ error: "invalid signature" }), { status: 401 });
  }

  const phone = payload.user?.phone;
  const otp = payload.sms?.otp;
  if (!phone || !otp) {
    return new Response(JSON.stringify({ error: "missing phone or otp" }), { status: 400 });
  }

  const result = await sendSms(phone, `${otp} is your Go See login code. It expires in 5 minutes.`);
  if (!result.ok) {
    return new Response(
      JSON.stringify({ error: { http_code: 500, message: result.error } }),
      { status: 500, headers: { "Content-Type": "application/json" } },
    );
  }

  return new Response("{}", { headers: { "Content-Type": "application/json" } });
});
