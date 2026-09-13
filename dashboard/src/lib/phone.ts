// Normalize Sri Lankan mobile numbers to E.164 (+94XXXXXXXXX)
export function toE164(raw: string): string {
  let n = raw.replace(/[^\d]/g, "");
  if (n.startsWith("0")) n = "94" + n.slice(1);
  if (!n.startsWith("94")) n = "94" + n;
  return "+" + n;
}
