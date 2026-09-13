#!/usr/bin/env node
// Creates the first Procurement dashboard user.
// Usage: node scripts/create-admin.mjs <email> <password> "<Full Name>"
// Reads SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY from env, or falls back to
// dashboard/.env.local values.

import { readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";

function envFromDotLocal(key) {
  try {
    const text = readFileSync(new URL("../dashboard/.env.local", import.meta.url), "utf8");
    const m = text.match(new RegExp(`^${key.replace("SUPABASE_URL", "NEXT_PUBLIC_SUPABASE_URL")}=(.*)$`, "m"));
    return m?.[1]?.trim();
  } catch {
    return undefined;
  }
}

const url = process.env.SUPABASE_URL ?? envFromDotLocal("SUPABASE_URL");
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? envFromDotLocal("SUPABASE_SERVICE_ROLE_KEY");
const [email, password, name = "Procurement Admin"] = process.argv.slice(2);

if (!url || !serviceKey || !email || !password) {
  console.error("Usage: node scripts/create-admin.mjs <email> <password> \"<Full Name>\"");
  console.error("Requires SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY (env or dashboard/.env.local).");
  process.exit(1);
}

const admin = createClient(url, serviceKey, { auth: { persistSession: false } });

const { data, error } = await admin.auth.admin.createUser({ email, password, email_confirm: true });
if (error) {
  console.error("Auth user creation failed:", error.message);
  process.exit(1);
}

const { error: profileError } = await admin.from("profiles").insert({
  id: data.user.id,
  name,
  email,
  role: "procurement",
});
if (profileError) {
  console.error("Profile insert failed:", profileError.message);
  process.exit(1);
}

console.log(`Created procurement user ${email} (${data.user.id})`);
