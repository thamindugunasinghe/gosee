"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export async function createCategory(formData: FormData): Promise<void> {
  const supabase = createClient();
  const name = String(formData.get("name") ?? "").trim();
  if (!name) redirect("/categories?error=" + encodeURIComponent("Category name is required"));
  const { error } = await supabase.from("categories").insert({
    name,
    description: String(formData.get("description") ?? "").trim() || null,
    created_by: (await supabase.auth.getUser()).data.user?.id,
  });
  if (error) {
    const msg = error.code === "23505" ? `Category "${name}" already exists` : error.message;
    redirect("/categories?error=" + encodeURIComponent(msg));
  }
  revalidatePath("/categories");
  redirect("/categories");
}

export async function createSubCategory(formData: FormData): Promise<void> {
  const supabase = createClient();
  const name = String(formData.get("name") ?? "").trim();
  if (!name) redirect("/categories?error=" + encodeURIComponent("Sub-category name is required"));
  const { error } = await supabase.from("sub_categories").insert({
    name,
    description: String(formData.get("description") ?? "").trim() || null,
    rank: Number(formData.get("rank") ?? 0),
    created_by: (await supabase.auth.getUser()).data.user?.id,
  });
  if (error) {
    const msg = error.code === "23505" ? `Sub-category "${name}" already exists` : error.message;
    redirect("/categories?error=" + encodeURIComponent(msg));
  }
  revalidatePath("/categories");
  redirect("/categories");
}

export async function toggleCategoryStatus(formData: FormData): Promise<void> {
  const supabase = createClient();
  const table = String(formData.get("table")) === "sub" ? "sub_categories" : "categories";
  const { error } = await supabase
    .from(table)
    .update({ status: String(formData.get("next")) })
    .eq("id", String(formData.get("id")));
  if (error) redirect("/categories?error=" + encodeURIComponent(error.message));
  revalidatePath("/categories");
}
