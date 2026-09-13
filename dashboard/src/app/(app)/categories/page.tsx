import { createClient } from "@/lib/supabase/server";
import type { Category, SubCategory } from "@/lib/types";
import { createCategory, createSubCategory, toggleCategoryStatus } from "./actions";

const inputCls =
  "w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none";

function StatusToggle({
  id,
  table,
  status,
}: {
  id: string;
  table: "main" | "sub";
  status: "active" | "inactive";
}) {
  return (
    <form action={toggleCategoryStatus}>
      <input type="hidden" name="id" value={id} />
      <input type="hidden" name="table" value={table} />
      <input type="hidden" name="next" value={status === "active" ? "inactive" : "active"} />
      <button className="text-xs text-blue-600 hover:underline">
        {status === "active" ? "Deactivate" : "Activate"}
      </button>
    </form>
  );
}

export default async function CategoriesPage({
  searchParams,
}: {
  searchParams: { error?: string };
}) {
  const supabase = createClient();
  const [{ data: categories }, { data: subCategories }] = await Promise.all([
    supabase.from("categories").select("*").order("name").returns<Category[]>(),
    supabase.from("sub_categories").select("*").order("rank").returns<SubCategory[]>(),
  ]);

  return (
    <div>
      <h1 className="mb-2 text-2xl font-bold text-slate-900">Categories</h1>
      <p className="mb-6 text-sm text-slate-500">
        Main supplier categories and sub-categories / spend tiers used to filter suppliers during job
        creation.
      </p>

      {searchParams.error && (
        <div className="mb-4 rounded-md bg-red-50 px-4 py-3 text-sm text-red-700">
          {searchParams.error}
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="rounded-xl bg-white p-6 shadow-sm">
          <h2 className="mb-4 text-lg font-semibold">Main categories</h2>
          <form action={createCategory} className="mb-4 flex gap-2">
            <input name="name" required placeholder="e.g. Electrical" className={inputCls} />
            <input name="description" placeholder="Description (optional)" className={inputCls} />
            <button className="shrink-0 rounded-md bg-blue-600 px-4 text-sm font-semibold text-white hover:bg-blue-700">
              Add
            </button>
          </form>
          <ul className="divide-y divide-slate-100">
            {(categories ?? []).map((c) => (
              <li key={c.id} className="flex items-center justify-between py-2">
                <div>
                  <p className="text-sm font-medium text-slate-900">{c.name}</p>
                  {c.description && <p className="text-xs text-slate-500">{c.description}</p>}
                </div>
                <div className="flex items-center gap-3">
                  <span
                    className={`rounded-full px-2 py-0.5 text-xs ${
                      c.status === "active" ? "bg-green-100 text-green-700" : "bg-slate-200 text-slate-600"
                    }`}
                  >
                    {c.status}
                  </span>
                  <StatusToggle id={c.id} table="main" status={c.status} />
                </div>
              </li>
            ))}
            {(categories ?? []).length === 0 && (
              <li className="py-6 text-center text-sm text-slate-400">No categories yet.</li>
            )}
          </ul>
        </div>

        <div className="rounded-xl bg-white p-6 shadow-sm">
          <h2 className="mb-4 text-lg font-semibold">Sub-categories / spend tiers</h2>
          <form action={createSubCategory} className="mb-4 flex gap-2">
            <input name="name" required placeholder="e.g. High-Value / Strategic" className={inputCls} />
            <input name="rank" type="number" defaultValue={0} className="w-20 rounded-md border border-slate-300 px-3 py-2 text-sm" />
            <button className="shrink-0 rounded-md bg-blue-600 px-4 text-sm font-semibold text-white hover:bg-blue-700">
              Add
            </button>
          </form>
          <ul className="divide-y divide-slate-100">
            {(subCategories ?? []).map((s) => (
              <li key={s.id} className="flex items-center justify-between py-2">
                <div>
                  <p className="text-sm font-medium text-slate-900">{s.name}</p>
                  <p className="text-xs text-slate-500">Rank {s.rank}</p>
                </div>
                <div className="flex items-center gap-3">
                  <span
                    className={`rounded-full px-2 py-0.5 text-xs ${
                      s.status === "active" ? "bg-green-100 text-green-700" : "bg-slate-200 text-slate-600"
                    }`}
                  >
                    {s.status}
                  </span>
                  <StatusToggle id={s.id} table="sub" status={s.status} />
                </div>
              </li>
            ))}
            {(subCategories ?? []).length === 0 && (
              <li className="py-6 text-center text-sm text-slate-400">No sub-categories yet.</li>
            )}
          </ul>
        </div>
      </div>
    </div>
  );
}
