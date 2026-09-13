import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { CYCLE_STATUS_LABELS, type CycleStatus } from "@/lib/types";

interface JobRow {
  id: string;
  pr_reference: string;
  description: string;
  location: string;
  priority: "normal" | "urgent";
  status: string;
  created_at: string;
  engineer: { name: string } | null;
  cycles: { cycle_no: number; status: CycleStatus; selected_time: string | null }[];
}

export default async function JobsPage({
  searchParams,
}: {
  searchParams: { status?: string; q?: string; created?: string };
}) {
  const supabase = createClient();
  let query = supabase
    .from("jobs")
    .select(
      "id, pr_reference, description, location, priority, status, created_at, engineer:profiles!jobs_engineer_id_fkey(name), cycles:job_cycles(cycle_no, status, selected_time)",
    )
    .order("created_at", { ascending: false });
  if (searchParams.q) {
    query = query.or(`pr_reference.ilike.%${searchParams.q}%,description.ilike.%${searchParams.q}%`);
  }
  const { data } = await query;
  let jobs = (data ?? []) as unknown as JobRow[];

  // Filter by current-cycle status when requested from a dashboard tile
  if (searchParams.status) {
    jobs = jobs.filter((j) => currentCycle(j)?.status === searchParams.status);
  }

  function currentCycle(j: JobRow) {
    return [...j.cycles].sort((a, b) => b.cycle_no - a.cycle_no)[0] ?? null;
  }

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-bold text-slate-900">Jobs</h1>
        <Link
          href="/jobs/new"
          className="rounded-md bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700"
        >
          + Create Job
        </Link>
      </div>

      {searchParams.created && (
        <div className="mb-4 rounded-md bg-green-50 px-4 py-3 text-sm text-green-700">
          Job created. The assigned engineer has been notified by SMS to select a visit time.
        </div>
      )}

      <form className="mb-4 flex gap-2">
        <input
          name="q"
          defaultValue={searchParams.q ?? ""}
          placeholder="Search PR number or description…"
          className="w-72 rounded-md border border-slate-300 px-3 py-2 text-sm"
        />
        {searchParams.status && (
          <span className="flex items-center gap-2 rounded-md bg-slate-200 px-3 py-2 text-xs text-slate-700">
            {CYCLE_STATUS_LABELS[searchParams.status as CycleStatus] ?? searchParams.status}
            <Link href="/jobs" className="text-slate-500 hover:text-slate-800">✕</Link>
          </span>
        )}
      </form>

      <div className="overflow-x-auto rounded-xl bg-white shadow-sm">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-slate-200 text-xs uppercase text-slate-500">
            <tr>
              <th className="px-4 py-3">PR</th>
              <th className="px-4 py-3">Description</th>
              <th className="px-4 py-3">Engineer</th>
              <th className="px-4 py-3">Location</th>
              <th className="px-4 py-3">Priority</th>
              <th className="px-4 py-3">Cycle</th>
              <th className="px-4 py-3">Status</th>
            </tr>
          </thead>
          <tbody>
            {jobs.map((j) => {
              const cycle = currentCycle(j);
              return (
                <tr key={j.id} className="border-b border-slate-100 hover:bg-slate-50">
                  <td className="px-4 py-3 font-medium text-slate-900">
                    <Link href={`/jobs/${j.id}`} className="text-blue-700 hover:underline">
                      {j.pr_reference}
                    </Link>
                  </td>
                  <td className="max-w-xs truncate px-4 py-3 text-slate-600">{j.description}</td>
                  <td className="px-4 py-3 text-slate-600">{j.engineer?.name ?? "—"}</td>
                  <td className="px-4 py-3 text-slate-600">{j.location}</td>
                  <td className="px-4 py-3">
                    <span
                      className={`rounded-full px-2 py-1 text-xs font-medium ${
                        j.priority === "urgent" ? "bg-red-100 text-red-700" : "bg-slate-100 text-slate-600"
                      }`}
                    >
                      {j.priority}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-slate-600">R{cycle?.cycle_no ?? 0}</td>
                  <td className="px-4 py-3">
                    <span className="rounded-full bg-sky-100 px-2 py-1 text-xs font-medium text-sky-700">
                      {cycle ? CYCLE_STATUS_LABELS[cycle.status] : "—"}
                    </span>
                  </td>
                </tr>
              );
            })}
            {jobs.length === 0 && (
              <tr>
                <td colSpan={7} className="px-4 py-10 text-center text-slate-400">
                  No jobs found.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
