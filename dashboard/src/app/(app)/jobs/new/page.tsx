import { createClient } from "@/lib/supabase/server";
import type { Category, Profile, SubCategory } from "@/lib/types";
import CreateJobForm, { type SupplierOption } from "./create-job-form";

export default async function NewJobPage() {
  const supabase = createClient();

  const [{ data: engineers }, { data: categories }, { data: tiers }, suppliersRes, { data: minCfg }] =
    await Promise.all([
      supabase
        .from("profiles")
        .select("*")
        .eq("role", "engineer")
        .eq("status", "active")
        .order("name")
        .returns<Profile[]>(),
      supabase.from("categories").select("*").eq("status", "active").order("name").returns<Category[]>(),
      supabase.from("sub_categories").select("*").eq("status", "active").order("rank").returns<SubCategory[]>(),
      supabase
        .from("supplier_companies")
        .select("id, company_name, tier_id, status, supplier_categories(category_id)")
        .eq("status", "active")
        .order("company_name"),
      supabase.from("system_config").select("value").eq("key", "min_suppliers_invited").single(),
    ]);

  const suppliers: SupplierOption[] = ((suppliersRes.data ?? []) as unknown as {
    id: string;
    company_name: string;
    tier_id: string;
    supplier_categories: { category_id: string }[];
  }[]).map((s) => ({
    id: s.id,
    company_name: s.company_name,
    tier_id: s.tier_id,
    category_ids: s.supplier_categories.map((sc) => sc.category_id),
  }));

  return (
    <div>
      <h1 className="mb-2 text-2xl font-bold text-slate-900">Create Job</h1>
      <p className="mb-6 text-sm text-slate-500">
        Enter the PR reference, assign an engineer, and select suppliers. The engineer receives an SMS to
        pick one visit time inside the three-day window.
      </p>
      <CreateJobForm
        engineers={engineers ?? []}
        categories={categories ?? []}
        tiers={tiers ?? []}
        suppliers={suppliers}
        minSuppliers={Number(minCfg?.value ?? 3)}
      />
    </div>
  );
}
