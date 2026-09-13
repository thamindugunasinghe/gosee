// Text.lk SMS gateway client (https://text.lk — API v3)

const TEXTLK_API_URL = Deno.env.get("TEXTLK_API_URL") ?? "https://app.text.lk/api/v3/sms/send";
const TEXTLK_API_TOKEN = Deno.env.get("TEXTLK_API_TOKEN") ?? "";
const TEXTLK_SENDER_ID = Deno.env.get("TEXTLK_SENDER_ID") ?? "TextLKDemo";

/** Normalize a Sri Lankan mobile number to 94XXXXXXXXX form. */
export function normalizeMobile(raw: string): string {
  let n = raw.replace(/[^\d]/g, "");
  if (n.startsWith("0")) n = "94" + n.slice(1);
  if (!n.startsWith("94")) n = "94" + n;
  return n;
}

export interface SmsResult {
  ok: boolean;
  providerMessageId?: string;
  error?: string;
}

export async function sendSms(recipient: string, message: string): Promise<SmsResult> {
  if (!TEXTLK_API_TOKEN) {
    return { ok: false, error: "TEXTLK_API_TOKEN is not configured" };
  }
  try {
    const res = await fetch(TEXTLK_API_URL, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${TEXTLK_API_TOKEN}`,
        "Content-Type": "application/json",
        "Accept": "application/json",
      },
      body: JSON.stringify({
        recipient: normalizeMobile(recipient),
        sender_id: TEXTLK_SENDER_ID,
        type: "plain",
        message,
      }),
    });
    const body = await res.json().catch(() => ({}));
    if (!res.ok || body?.status === "error") {
      return { ok: false, error: body?.message ?? `HTTP ${res.status}` };
    }
    return { ok: true, providerMessageId: body?.data?.uid ?? undefined };
  } catch (e) {
    return { ok: false, error: String(e) };
  }
}
