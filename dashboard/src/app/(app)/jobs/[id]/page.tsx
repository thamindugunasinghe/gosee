import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { CYCLE_STATUS_LABELS, type CycleStatus } from "@/lib/types";
import ClosurePanel, { type NamedOption, type SupplierPickOption } from "./closure-panel";

interface CycleSupplierRow {
  supplier_id: string;
  response_status: string;
  attendance_status: string;
  supplier: { company_name: string } | null;
}

interface CycleRow {
  id: string;
  cycle_no: number;
  status: CycleStatus;
  selected_time: string | null;
  response_cutoff: string | null;
  cycle_suppliers: CycleSupplierRow[];
}

interface JobRecord {
  id: string;
  pr_reference: string;
  description: string;
  title: string | null;
  location: string;
  priority: "normal" | "urgent";
  status: string;
  created_at: string;
  main_category_id: string | null;
  sub_category_id: string | null;
  engineer: { name: string; mobile: string } | null;
  cycles: CycleRow[];
}

interface SupplierRecord {
  id: string;
  company_name: string;
  tier_id: string;
  status: string;
  supplier_categories: { category_id: string }[];
}

const RESPONSE_BADGE: Record<string, string> = {
  available: "bg-green-100 text-green-700",
  not_available: "bg-red-100 text-red-700",
  pending: "bg-amber-100 text-amber-700",
  no_response: "bg-slate-100 text-slate-500",
};

const ATTENDANCE_BADGE: Record<string, string> = {
  attended: "bg-green-100 text-green-700",
  did_not_attend: "bg-red-100 text-red-700",
  not_marked: "bg-slate-100 text-slate-500",
};

function fmt(dt: string | null) {
  if (!dt) return "—";
  return new Date(dt).toLocaleString("en-GB", {
    weekday: "short",
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default async function JobDetailPage({
  params,
  searchParams,
}: {
  params: { id: string };
  searchParams: { done?: string };
}) {
  const supabase = createClient();

  const { data } = await supabase
    .from("jobs")
    .select(
      `id, pr_reference, description, title, location, priority, status, created_at,
       main_category_id, sub_category_id,
       engineer:profiles!jobs_engineer_id_fkey(name, mobile),
       cycles:job_cycles(id, cycle_no, status, selected_time, response_cutoff,
         cycle_suppliers(supplier_id, response_status, attendance_status,
           supplier:supplier_companies(company_name)))`,
    )
    .eq("id", params.id)
    .single();

  if (!data) notFound();
  const job = data as unknown as JobRecord;

  const cycles = [...(job.cycles ?? [])].sort((a, b) => b.cycle_no - a.cycle_no);
  const current = cycles[0];
  const engineer = job.engineer;

  // For a possible recirculation: load categories, tiers, and all active suppliers
  // so Procurement can pick across any category/tier (like job creation). Suppliers
  // who attended an earlier cycle of this job are flagged (BR-12) and never selectable.
  let categoryOptions: NamedOption[] = [];
  let tierOptions: NamedOption[] = [];
  let supplierOptions: SupplierPickOption[] = [];
  if (current?.status === "AWAITING_PROCUREMENT_CLOSE") {
    const attended = new Set(
      cycles.flatMap((c) =>
        c.cycle_suppliers.filter((cs) => cs.attendance_status === "attended").map((cs) => cs.supplier_id),
      ),
    );
    const [{ data: cats }, { data: subs }, { data: sups }] = await Promise.all([
      supabase.from("categories").select("id, name").eq("status", "active").order("name"),
      supabase.from("sub_categories").select("id, name").eq("status", "active").order("rank"),
      supabase
        .from("supplier_companies")
        .select("id, company_name, tier_id, status, supplier_categories(category_id)")
        .eq("status", "active")
        .order("company_name"),
    ]);
    categoryOptions = (cats ?? []) as NamedOption[];
    tierOptions = (subs ?? []) as NamedOption[];
    supplierOptions = ((sups ?? []) as unknown as SupplierRecord[]).map((s) => ({
      id: s.id,
      company_name: s.company_name,
      tier_id: s.tier_id,
      category_ids: s.supplier_categories.map((sc) => sc.category_id),
      attended_before: attended.has(s.id),
    }));
  }

  const doneMessages: Record<string, string> = {
    close: "Job closed. The engineer has been notified.",
    cancel: "Job cancelled. The engineer has been notified.",
    recirculate: "New cycle started. The engineer has been asked by SMS to select a visit time.",
  };

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold text-slate-900">PR {job.pr_reference}</h1>
            {job.priority === "urgent" && (
              <span className="rounded-full bg-red-100 px-2 py-1 text-xs font-semibold text-red-700">URGENT</span>
            )}
            <span className="rounded-full bg-slate-100 px-2 py-1 text-xs font-medium text-slate-600">
              {job.status}
            </span>
          </div>
          <p className="text-sm text-slate-500">
            {job.description} · {job.location} · Engineer: {engineer?.name ?? "—"}
          </p>
        </div>
        <Link href="/jobs" className="text-sm text-slate-500 hover:text-slate-800">
          ← Back to jobs
        </Link>
      </div>

      {searchParams.done && doneMessages[searchParams.done] && (
        <div className="mb-4 rounded-md bg-green-50 px-4 py-3 text-sm text-green-700">
          {doneMessages[searchParams.done]}
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-[1fr_380px]">
        <div className="space-y-4">
          {cycles.map((c) => (
            <div key={c.id} className="rounded-xl bg-white p-5 shadow-sm">
              <div className="mb-3 flex items-center justify-between">
                <h2 className="text-lg font-bold text-slate-900">Cycle R{c.cycle_no}</h2>
                <span className="rounded-full bg-sky-100 px-2 py-1 text-xs font-medium text-sky-700">
                  {CYCLE_STATUS_LABELS[c.status] ?? c.status}
                </span>
              </div>
              <div className="mb-3 grid grid-cols-2 gap-2 text-sm">
                <div>
                  <span className="text-xs uppercase text-slate-400">Visit time</span>
                  <p className="font-medium text-slate-800">{fmt(c.selected_time)}</p>
                </div>
                <div>
                  <span className="text-xs uppercase text-slate-400">Response cutoff</span>
                  <p className="font-medium text-slate-800">{fmt(c.response_cutoff)}</p>
                </div>
              </div>
              <table className="w-full text-left text-sm">
                <thead className="text-xs uppercase text-slate-400">
                  <tr>
                    <th className="py-2">Supplier</th>
                    <th className="py-2">Response</th>
                    <th className="py-2">Attendance</th>
                  </tr>
                </thead>
                <tbody>
                  {c.cycle_suppliers.map((cs) => (
                    <tr key={cs.supplier_id} className="border-t border-slate-100">
                      <td className="py-2 font-medium text-slate-800">{cs.supplier?.company_name ?? "—"}</td>
                      <td className="py-2">
                        <span
                          className={`rounded-full px-2 py-0.5 text-xs font-medium ${RESPONSE_BADGE[cs.response_status] ?? RESPONSE_BADGE.no_response}`}
                        >
                          {cs.response_status.replace("_", " ")}
                        </span>
                      </td>
                      <td className="py-2">
                        <span
                          className={`rounded-full px-2 py-0.5 text-xs font-medium ${ATTENDANCE_BADGE[cs.attendance_status] ?? ATTENDANCE_BADGE.not_marked}`}
                        >
                          {cs.attendance_status.replace(/_/g, " ")}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ))}
        </div>

        <div>
          {current?.status === "AWAITING_PROCUREMENT_CLOSE" ? (
            <ClosurePanel
              jobId={job.id}
              cycleId={current.id}
              categories={categoryOptions}
              tiers={tierOptions}
              suppliers={supplierOptions}
            />
          ) : (
            <div className="rounded-xl bg-white p-5 text-sm text-slate-500 shadow-sm">
              {current
                ? `No procurement action needed right now — the cycle is “${CYCLE_STATUS_LABELS[current.status] ?? current.status}”.`
                : "This job has no cycles."}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
