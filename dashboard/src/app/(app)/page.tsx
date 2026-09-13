import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { CYCLE_STATUS_LABELS, type CycleStatus } from "@/lib/types";
import CountUp from "@/components/CountUp";

// Main dashboard tiles (Section 10.1). `accent` is the left bar + icon tint;
// `needsAction` tiles are highlighted as the ones Procurement should watch.
const TILES: { status: CycleStatus; accent: string; ring: string; icon: JSX.Element; needsAction?: boolean }[] = [
  { status: "AWAITING_ENGINEER_TIME", accent: "#f59e0b", ring: "bg-amber-50", icon: <path d="M12 7v5l3 2M12 3a9 9 0 100 18 9 9 0 000-18Z" /> },
  { status: "AWAITING_SUPPLIER_RESPONSES", accent: "#0ea5e9", ring: "bg-sky-50", icon: <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2Z" /> },
  { status: "OVERRIDE_REQUIRED", accent: "#ef4444", ring: "bg-red-50", icon: <path d="M12 9v4m0 4h.01M10.3 3.9 1.8 18a2 2 0 001.7 3h17a2 2 0 001.7-3L14.7 3.9a2 2 0 00-3.4 0Z" />, needsAction: true },
  { status: "RESCHEDULE_REQUIRED", accent: "#f97316", ring: "bg-orange-50", icon: <><path d="M21 12a9 9 0 1 1-3-6.7" /><path d="M21 4v4h-4" /></>, needsAction: true },
  { status: "CONFIRMED", accent: "#22c55e", ring: "bg-green-50", icon: <path d="M20 6 9 17l-5-5" /> },
  { status: "AWAITING_ENGINEER_CLOSE", accent: "#8b5cf6", ring: "bg-violet-50", icon: <path d="M12 20h9M16.5 3.5a2.1 2.1 0 013 3L7 19l-4 1 1-4Z" /> },
  { status: "AWAITING_PROCUREMENT_CLOSE", accent: "#d946ef", ring: "bg-fuchsia-50", icon: <path d="M12 8v4l3 2M12 3a9 9 0 100 18 9 9 0 000-18Z" />, needsAction: true },
  { status: "RECIRCULATED", accent: "#64748b", ring: "bg-slate-100", icon: <path d="M17 2l4 4-4 4M3 11V9a4 4 0 014-4h14M7 22l-4-4 4-4M21 13v2a4 4 0 01-4 4H3" /> },
  { status: "CLOSED", accent: "#94a3b8", ring: "bg-slate-100", icon: <path d="M9 11l3 3L22 4M21 12v7a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2h11" /> },
];

export default async function DashboardPage() {
  const supabase = createClient();
  const { data: cycles } = await supabase.from("job_cycles").select("status");

  const counts = new Map<string, number>();
  for (const c of cycles ?? []) counts.set(c.status, (counts.get(c.status) ?? 0) + 1);

  const total = cycles?.length ?? 0;
  const actionable = TILES.filter((t) => t.needsAction).reduce((n, t) => n + (counts.get(t.status) ?? 0), 0);

  return (
    <div>
      <div className="mb-6 flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-[#0b1b3a]">Dashboard</h1>
          <p className="mt-0.5 text-sm text-slate-500">
            {total} active cycle{total === 1 ? "" : "s"}
            {actionable > 0 && (
              <span className="ml-2 rounded-full bg-red-50 px-2 py-0.5 text-xs font-semibold text-red-600">
                {actionable} need attention
              </span>
            )}
          </p>
        </div>
        <Link
          href="/jobs/new"
          className="inline-flex items-center gap-2 rounded-lg bg-[#1e5fd8] px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-[#1a52bd]"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round">
            <path d="M12 5v14M5 12h14" />
          </svg>
          Create Job
        </Link>
      </div>

      <div className="gs-stagger grid grid-cols-2 gap-4 md:grid-cols-3 xl:grid-cols-5">
        {TILES.map(({ status, accent, ring, icon, needsAction }) => (
          <Link
            key={status}
            href={`/jobs?status=${status}`}
            className="gs-card group relative overflow-hidden rounded-xl border border-slate-200/70 bg-white p-4 shadow-sm"
          >
            <span className="absolute inset-y-0 left-0 w-1.5" style={{ backgroundColor: accent }} />
            <div className="flex items-start justify-between">
              <CountUp value={counts.get(status) ?? 0} className="text-4xl font-extrabold text-[#0b1b3a]" />
              <span className={`flex h-9 w-9 items-center justify-center rounded-lg ${ring}`}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={accent} strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
                  {icon}
                </svg>
              </span>
            </div>
            <p className="mt-2 text-xs font-semibold text-slate-500">{CYCLE_STATUS_LABELS[status]}</p>
            {needsAction && (counts.get(status) ?? 0) > 0 && (
              <span className="mt-1 inline-block h-1.5 w-1.5 rounded-full bg-red-500" />
            )}
          </Link>
        ))}
      </div>
    </div>
  );
}
