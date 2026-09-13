"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { DASHBOARD_ROLES, type UserRole } from "@/lib/types";
import { toE164 } from "@/lib/phone";

async function requireDashboardUser() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();
  if (!profile || !DASHBOARD_ROLES.includes(profile.role as UserRole)) {
    throw new Error("Not authorized");
  }
  return user.id;
}

export async function createUser(formData: FormData): Promise<void> {
  await requireDashboardUser();
  const admin = createAdminClient();

  const role = formData.get("role") as UserRole;
  const name = String(formData.get("name") ?? "").trim();
  const mobileRaw = String(formData.get("mobile") ?? "").trim();
  const email = String(formData.get("email") ?? "").trim() || null;
  const password = String(formData.get("password") ?? "");
  const otpRole = role === "engineer" || role === "supplier_contact";

  if (!name) redirect("/users?error=" + encodeURIComponent("Name is required"));

  let authPayload;
  if (otpRole) {
    if (!mobileRaw) redirect("/users?error=" + encodeURIComponent("Mobile number is required for OTP login"));
    authPayload = { phone: toE164(mobileRaw), phone_confirm: true };
  } else {
    if (!email || !password) {
      redirect("/users?error=" + encodeURIComponent("Email and password are required for dashboard users"));
    }
    authPayload = { email: email!, password, email_confirm: true };
  }

  const { data: created, error: authError } = await admin.auth.admin.createUser(authPayload);
  if (authError || !created.user) {
    redirect("/users?error=" + encodeURIComponent(authError?.message ?? "Failed to create auth user"));
  }

  const { error: profileError } = await admin.from("profiles").insert({
    id: created.user.id,
    name,
    mobile: mobileRaw ? toE164(mobileRaw) : null,
    email,
    role,
    department: String(formData.get("department") ?? "").trim() || null,
    designation: String(formData.get("designation") ?? "").trim() || null,
    preferred_language: String(formData.get("preferred_language") ?? "en"),
  });
  if (profileError) {
    await admin.auth.admin.deleteUser(created.user.id);
    redirect("/users?error=" + encodeURIComponent(profileError.message));
  }

  revalidatePath("/users");
  redirect("/users?ok=1");
}

export async function toggleUserStatus(formData: FormData): Promise<void> {
  await requireDashboardUser();
  const supabase = createClient();
  const id = String(formData.get("id"));
  const next = String(formData.get("next")) as "active" | "inactive";
  const { error } = await supabase.from("profiles").update({ status: next }).eq("id", id);
  if (error) redirect("/users?error=" + encodeURIComponent(error.message));
  revalidatePath("/users");
}
