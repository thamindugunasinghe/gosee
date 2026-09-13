import { createClient } from "@/lib/supabase/server";
import type { Category, SubCategory } from "@/lib/types";
import { createSupplier, toggleSupplierStatus } from "./actions";

const inputCls =
  "w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none";

interface SupplierRow {
  id: string;
  company_name: string;
  address: string | null;
  status: "active" | "inactive";
  contact: { name: string; mobile: string | null } | null;
  tier: { name: string } | null;
  supplier_categories: { category: { name: string } | null }[];
}

export default async function SuppliersPage({
  searchParams,
}: {
  searchParams: { error?: string; ok?: string; q?: string };
}) {
  const supabase = createClient();
  const [{ data: categories }, { data: tiers }, suppliersRes] = await Promise.all([
    supabase.from("categories").select("*").eq("status", "active").order("name").returns<Category[]>(),
    supabase.from("sub_categories").select("*").eq("status", "active").order("rank").returns<SubCategory[]>(),
    supabase
      .from("supplier_companies")
      .select(
        "id, company_name, address, status, contact:profiles!supplier_companies_contact_user_id_fkey(name, mobile), tier:sub_categories(name), supplier_categories(category:categories(name))",
      )
      .order("company_name"),
  ]);
  let suppliers = (suppliersRes.data ?? []) as unknown as SupplierRow[];
  if (searchParams.q) {
    const q = searchParams.q.toLowerCase();
    suppliers = suppliers.filter((s) => s.company_name.toLowerCase().includes(q));
  }

  return (
    <div>
      <h1 className="mb-6 text-2xl font-bold text-slate-900">Suppliers</h1>

      {searchParams.error && (
        <div className="mb-4 rounded-md bg-red-50 px-4 py-3 text-sm text-red-700">{searchParams.error}</div>
      )}
      {searchParams.ok && (
        <div className="mb-4 rounded-md bg-green-50 px-4 py-3 text-sm text-green-700">
          Supplier created — the contact person can now log into the mobile app with OTP.
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="rounded-xl bg-white p-6 shadow-sm">
          <h2 className="mb-4 text-lg font-semibold">Register supplier</h2>
          <form action={createSupplier} className="space-y-3">
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-600">Company name *</label>
              <input name="company_name" required className={inputCls} />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-600">Contact person *</label>
              <input name="contact_name" required className={inputCls} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="mb-1 block text-xs font-medium text-slate-600">Mobile *</label>
                <input name="mobile" required placeholder="07XXXXXXXX" className={inputCls} />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-slate-600">Email</label>
                <input name="email" type="email" className={inputCls} />
              </div>
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-600">Categories *</label>
              <div className="max-h-36 space-y-1 overflow-y-auto rounded-md border border-slate-200 p-2">
                {(categories ?? []).map((c) => (
                  <label key={c.id} className="flex items-center gap-2 text-sm text-slate-700">
                    <input type="checkbox" name="category_ids" value={c.id} />
                    {c.name}
                  </label>
                ))}
                {(categories ?? []).length === 0 && (
                  <p className="text-xs text-slate-400">Create categories first.</p>
                )}
              </div>
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-600">Sub-category / tier *</label>
              <select name="tier_id" required className={inputCls}>
                <option value="">Select tier…</option>
                {(tiers ?? []).map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-600">Address</label>
              <textarea name="address" rows={2} className={inputCls} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="mb-1 block text-xs font-medium text-slate-600">Availability contact</label>
                <input name="availability_contact" className={inputCls} />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-slate-600">Language</label>
                <select name="preferred_language" className={inputCls} defaultValue="en">
                  <option value="en">English</option>
                  <option value="si">Sinhala</option>
                  <option value="ta">Tamil</option>
                </select>
              </div>
            </div>
            <button className="w-full rounded-md bg-blue-600 py-2 text-sm font-semibold text-white hover:bg-blue-700">
              Register supplier
            </button>
          </form>
        </div>

        <div className="lg:col-span-2">
          <form className="mb-3">
            <input
              name="q"
              defaultValue={searchParams.q ?? ""}
              placeholder="Search suppliers…"
              className="w-64 rounded-md border border-slate-300 px-3 py-2 text-sm"
            />
          </form>
          <div className="overflow-x-auto rounded-xl bg-white shadow-sm">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-slate-200 text-xs uppercase text-slate-500">
                <tr>
                  <th className="px-4 py-3">Company</th>
                  <th className="px-4 py-3">Contact</th>
                  <th className="px-4 py-3">Categories</th>
                  <th className="px-4 py-3">Tier</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3"></th>
                </tr>
              </thead>
              <tbody>
                {suppliers.map((s) => (
                  <tr key={s.id} className="border-b border-slate-100">
                    <td className="px-4 py-3 font-medium text-slate-900">{s.company_name}</td>
                    <td className="px-4 py-3 text-slate-600">
                      {s.contact?.name}
                      <span className="block text-xs text-slate-400">{s.contact?.mobile}</span>
                    </td>
                    <td className="px-4 py-3 text-slate-600">
                      {s.supplier_categories.map((sc) => sc.category?.name).filter(Boolean).join(", ") || "—"}
                    </td>
                    <td className="px-4 py-3 text-slate-600">{s.tier?.name ?? "—"}</td>
                    <td className="px-4 py-3">
                      <span
                        className={`rounded-full px-2 py-1 text-xs font-medium ${
                          s.status === "active" ? "bg-green-100 text-green-700" : "bg-slate-200 text-slate-600"
                        }`}
                      >
                        {s.status}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <form action={toggleSupplierStatus}>
                        <input type="hidden" name="id" value={s.id} />
                        <input type="hidden" name="next" value={s.status === "active" ? "inactive" : "active"} />
                        <button className="text-xs text-blue-600 hover:underline">
                          {s.status === "active" ? "Deactivate" : "Activate"}
                        </button>
                      </form>
                    </td>
                  </tr>
                ))}
                {suppliers.length === 0 && (
                  <tr>
                    <td colSpan={6} className="px-4 py-8 text-center text-slate-400">
                      No suppliers yet.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
