"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { toE164 } from "@/lib/phone";

export async function createSupplier(formData: FormData): Promise<void> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const companyName = String(formData.get("company_name") ?? "").trim();
  const contactName = String(formData.get("contact_name") ?? "").trim();
  const mobile = String(formData.get("mobile") ?? "").trim();
  const tierId = String(formData.get("tier_id") ?? "");
  const categoryIds = formData.getAll("category_ids").map(String).filter(Boolean);

  if (!companyName || !contactName || !mobile || !tierId || categoryIds.length === 0) {
    redirect(
      "/suppliers?error=" +
        encodeURIComponent("Company name, contact person, mobile, tier and at least one category are required"),
    );
  }

  const admin = createAdminClient();

  // Supplier contact logs into the mobile app with OTP, so an auth user is created up front.
  const { data: created, error: authError } = await admin.auth.admin.createUser({
    phone: toE164(mobile),
    phone_confirm: true,
  });
  if (authError || !created.user) {
    redirect("/suppliers?error=" + encodeURIComponent(authError?.message ?? "Failed to create contact login"));
  }

  const { error: profileError } = await admin.from("profiles").insert({
    id: created.user.id,
    name: contactName,
    mobile: toE164(mobile),
    email: String(formData.get("email") ?? "").trim() || null,
    role: "supplier_contact",
    preferred_language: String(formData.get("preferred_language") ?? "en"),
  });
  if (profileError) {
    await admin.auth.admin.deleteUser(created.user.id);
    redirect("/suppliers?error=" + encodeURIComponent(profileError.message));
  }

  const { data: company, error: companyError } = await admin
    .from("supplier_companies")
    .insert({
      company_name: companyName,
      contact_user_id: created.user.id,
      tier_id: tierId,
      address: String(formData.get("address") ?? "").trim() || null,
      availability_contact: String(formData.get("availability_contact") ?? "").trim() || null,
    })
    .select("id")
    .single();
  if (companyError || !company) {
    await admin.auth.admin.deleteUser(created.user.id);
    const msg =
      companyError?.code === "23505"
        ? `Supplier "${companyName}" already exists`
        : companyError?.message ?? "Failed to create supplier";
    redirect("/suppliers?error=" + encodeURIComponent(msg));
  }

  const { error: mapError } = await admin
    .from("supplier_categories")
    .insert(categoryIds.map((category_id) => ({ supplier_id: company.id, category_id })));
  if (mapError) {
    redirect("/suppliers?error=" + encodeURIComponent(mapError.message));
  }

  revalidatePath("/suppliers");
  redirect("/suppliers?ok=1");
}

export async function toggleSupplierStatus(formData: FormData): Promise<void> {
  const supabase = createClient();
  const { error } = await supabase
    .from("supplier_companies")
    .update({ status: String(formData.get("next")) })
    .eq("id", String(formData.get("id")));
  if (error) redirect("/suppliers?error=" + encodeURIComponent(error.message));
  revalidatePath("/suppliers");
}
