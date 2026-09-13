import { createClient } from "@/lib/supabase/server";
import type { Profile } from "@/lib/types";
import { createUser, toggleUserStatus } from "./actions";

const inputCls =
  "w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none";

export default async function UsersPage({
  searchParams,
}: {
  searchParams: { error?: string; ok?: string; q?: string };
}) {
  const supabase = createClient();
  let query = supabase
    .from("profiles")
    .select("*")
    .neq("role", "supplier_contact")
    .order("created_at", { ascending: false });
  if (searchParams.q) query = query.ilike("name", `%${searchParams.q}%`);
  const { data: users } = await query.returns<Profile[]>();

  return (
    <div>
      <h1 className="mb-6 text-2xl font-bold text-slate-900">Users</h1>

      {searchParams.error && (
        <div className="mb-4 rounded-md bg-red-50 px-4 py-3 text-sm text-red-700">
          {searchParams.error}
        </div>
      )}
      {searchParams.ok && (
        <div className="mb-4 rounded-md bg-green-50 px-4 py-3 text-sm text-green-700">
          User created.
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="rounded-xl bg-white p-6 shadow-sm">
          <h2 className="mb-4 text-lg font-semibold text-slate-900">Add user</h2>
          <form action={createUser} className="space-y-3">
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-600">Role</label>
              <select name="role" className={inputCls} defaultValue="engineer">
                <option value="engineer">Engineer (mobile OTP login)</option>
                <option value="procurement">Procurement (dashboard)</option>
                <option value="procurement_manager">Procurement Manager</option>
                <option value="system_admin">System Admin</option>
              </select>
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-600">Full name *</label>
              <input name="name" required className={inputCls} />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-600">
                Mobile (required for engineers)
              </label>
              <input name="mobile" placeholder="07XXXXXXXX" className={inputCls} />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-600">
                Email (dashboard users)
              </label>
              <input name="email" type="email" className={inputCls} />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-600">
                Password (dashboard users)
              </label>
              <input name="password" type="password" className={inputCls} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="mb-1 block text-xs font-medium text-slate-600">Department</label>
                <input name="department" placeholder="Utilities" className={inputCls} />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-slate-600">Designation</label>
                <input name="designation" placeholder="Engineer" className={inputCls} />
              </div>
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-600">Language</label>
              <select name="preferred_language" className={inputCls} defaultValue="en">
                <option value="en">English</option>
                <option value="si">Sinhala</option>
                <option value="ta">Tamil</option>
              </select>
            </div>
            <button className="w-full rounded-md bg-blue-600 py-2 text-sm font-semibold text-white hover:bg-blue-700">
              Create user
            </button>
          </form>
        </div>

        <div className="lg:col-span-2">
          <form className="mb-3">
            <input
              name="q"
              defaultValue={searchParams.q ?? ""}
              placeholder="Search by name…"
              className="w-64 rounded-md border border-slate-300 px-3 py-2 text-sm"
            />
          </form>
          <div className="overflow-x-auto rounded-xl bg-white shadow-sm">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-slate-200 text-xs uppercase text-slate-500">
                <tr>
                  <th className="px-4 py-3">Name</th>
                  <th className="px-4 py-3">Role</th>
                  <th className="px-4 py-3">Mobile</th>
                  <th className="px-4 py-3">Department</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3"></th>
                </tr>
              </thead>
              <tbody>
                {(users ?? []).map((u) => (
                  <tr key={u.id} className="border-b border-slate-100">
                    <td className="px-4 py-3 font-medium text-slate-900">
                      {u.name}
                      {u.designation && (
                        <span className="block text-xs font-normal text-slate-500">{u.designation}</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-slate-600">{u.role.replace("_", " ")}</td>
                    <td className="px-4 py-3 text-slate-600">{u.mobile ?? "—"}</td>
                    <td className="px-4 py-3 text-slate-600">{u.department ?? "—"}</td>
                    <td className="px-4 py-3">
                      <span
                        className={`rounded-full px-2 py-1 text-xs font-medium ${
                          u.status === "active"
                            ? "bg-green-100 text-green-700"
                            : "bg-slate-200 text-slate-600"
                        }`}
                      >
                        {u.status}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <form action={toggleUserStatus}>
                        <input type="hidden" name="id" value={u.id} />
                        <input
                          type="hidden"
                          name="next"
                          value={u.status === "active" ? "inactive" : "active"}
                        />
                        <button className="text-xs text-blue-600 hover:underline">
                          {u.status === "active" ? "Deactivate" : "Activate"}
                        </button>
                      </form>
                    </td>
                  </tr>
                ))}
                {(users ?? []).length === 0 && (
                  <tr>
                    <td colSpan={6} className="px-4 py-8 text-center text-slate-400">
                      No users yet.
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
