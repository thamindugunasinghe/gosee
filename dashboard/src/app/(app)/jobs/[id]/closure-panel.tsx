"use client";

import { useMemo, useState } from "react";
import { procurementClose } from "./actions";

export interface SupplierPickOption {
  id: string;
  company_name: string;
  tier_id: string;
  category_ids: string[];
  attended_before: boolean;
}

export interface NamedOption {
  id: string;
  name: string;
}

const btnBase = "rounded-md px-4 py-2 text-sm font-semibold transition-colors";
const inputCls =
  "w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none";
const labelCls = "mb-1 block text-xs font-medium text-slate-600";

export default function ClosurePanel({
  jobId,
  cycleId,
  categories,
  tiers,
  suppliers,
}: {
  jobId: string;
  cycleId: string;
  categories: NamedOption[];
  tiers: NamedOption[];
  suppliers: SupplierPickOption[];
}) {
  const [action, setAction] = useState<"close" | "recirculate" | "cancel" | null>(null);
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  // Mirror the create-job supplier picker: category + tier filter, search, and a
  // selected set that persists as the filters change (so you can pick across
  // multiple categories/tiers). Suppliers who attended an earlier cycle (BR-12)
  // are never selectable.
  const [categoryId, setCategoryId] = useState("");
  const [tierId, setTierId] = useState("");
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const filtered = useMemo(() => {
    if (!categoryId || !tierId) return [];
    let list = suppliers.filter(
      (s) => !s.attended_before && s.tier_id === tierId && s.category_ids.includes(categoryId),
    );
    if (query) {
      const q = query.toLowerCase();
      list = list.filter((s) => s.company_name.toLowerCase().includes(q));
    }
    return list;
  }, [suppliers, categoryId, tierId, query]);

  const selectedList = suppliers.filter((s) => selected.has(s.id));

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function selectAllFiltered() {
    setSelected((prev) => {
      const next = new Set(prev);
      filtered.forEach((s) => next.add(s.id));
      return next;
    });
  }

  async function submit() {
    setError(null);
    if (!action) return;
    if ((action === "recirculate" || action === "cancel") && reason.trim().length === 0) {
      setError("A reason is required for this action.");
      return;
    }
    if (action === "recirculate") {
      // A recirculated cycle confirms on the first acceptance, so one supplier is
      // enough — no minimum-of-three warning here.
      if (selected.size === 0) {
        setError("Select at least one supplier for the new cycle.");
        return;
      }
    }
    setBusy(true);
    const res = await procurementClose({
      job_id: jobId,
      cycle_id: cycleId,
      action,
      reason: reason.trim() || null,
      supplier_ids: action === "recirculate" ? Array.from(selected) : [],
    });
    if (res?.error) {
      setBusy(false);
      setError(res.error);
    }
  }

  return (
    <div className="rounded-xl bg-white p-5 shadow-sm">
      <h2 className="mb-1 text-lg font-bold text-slate-900">Final closure</h2>
      <p className="mb-4 text-sm text-slate-500">
        The engineer has closed the visit. Choose how to finish this cycle.
      </p>

      <div className="mb-4 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => setAction("close")}
          className={`${btnBase} ${action === "close" ? "bg-green-600 text-white" : "bg-green-50 text-green-700 hover:bg-green-100"}`}
        >
          Close job
        </button>
        <button
          type="button"
          onClick={() => setAction("recirculate")}
          className={`${btnBase} ${action === "recirculate" ? "bg-blue-600 text-white" : "bg-blue-50 text-blue-700 hover:bg-blue-100"}`}
        >
          Recirculate
        </button>
        <button
          type="button"
          onClick={() => setAction("cancel")}
          className={`${btnBase} ${action === "cancel" ? "bg-red-600 text-white" : "bg-red-50 text-red-700 hover:bg-red-100"}`}
        >
          Cancel job
        </button>
      </div>

      {action === "close" && (
        <p className="mb-4 text-sm text-slate-600">
          The job is marked completed. The engineer is notified by SMS.
        </p>
      )}

      {(action === "recirculate" || action === "cancel") && (
        <div className="mb-4">
          <label className={labelCls}>Reason (required)</label>
          <textarea
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            rows={2}
            className={inputCls}
            placeholder={
              action === "cancel"
                ? "Why is this job being cancelled?"
                : "Why does this job need a new supplier cycle?"
            }
          />
        </div>
      )}

      {action === "recirculate" && (
        <div className="mb-4 space-y-3">
          <div>
            <p className="mb-2 text-xs text-slate-500">
              Pick a category and tier to load suppliers, then choose any. You can switch category/tier and
              keep adding — your selection carries over. Suppliers who attended an earlier cycle are excluded
              automatically (BR-12).
            </p>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={labelCls}>Category</label>
                <select value={categoryId} onChange={(e) => setCategoryId(e.target.value)} className={inputCls}>
                  <option value="">Select…</option>
                  {categories.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className={labelCls}>Sub-category / tier</label>
                <select value={tierId} onChange={(e) => setTierId(e.target.value)} className={inputCls}>
                  <option value="">Select…</option>
                  {tiers.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          {categoryId && tierId ? (
            <>
              <div className="flex items-center gap-2">
                <input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Search within filtered suppliers…"
                  className={inputCls}
                />
                <button
                  type="button"
                  onClick={selectAllFiltered}
                  disabled={filtered.length === 0}
                  className="shrink-0 rounded-md border border-blue-600 px-3 py-2 text-xs font-semibold text-blue-600 hover:bg-blue-50 disabled:opacity-40"
                >
                  Select all ({filtered.length})
                </button>
              </div>
              <ul className="max-h-48 divide-y divide-slate-100 overflow-y-auto rounded-md border border-slate-200">
                {filtered.map((s) => (
                  <li key={s.id}>
                    <label className="flex cursor-pointer items-center gap-2 px-3 py-2 text-sm hover:bg-slate-50">
                      <input type="checkbox" checked={selected.has(s.id)} onChange={() => toggle(s.id)} />
                      {s.company_name}
                    </label>
                  </li>
                ))}
                {filtered.length === 0 && (
                  <li className="px-3 py-4 text-center text-xs text-slate-400">
                    No eligible suppliers for this category and tier.
                  </li>
                )}
              </ul>
            </>
          ) : (
            <p className="rounded-md bg-slate-50 px-3 py-4 text-center text-xs text-slate-400">
              Choose a category and tier to load suppliers.
            </p>
          )}

          <div>
            <h3 className="mb-2 text-sm font-semibold text-slate-700">
              Selected suppliers ({selectedList.length})
            </h3>
            {selectedList.length === 0 ? (
              <p className="text-xs text-slate-400">Nothing selected yet.</p>
            ) : (
              <ul className="flex flex-wrap gap-2">
                {selectedList.map((s) => (
                  <li
                    key={s.id}
                    className="flex items-center gap-1 rounded-full bg-blue-50 px-3 py-1 text-xs font-medium text-blue-700"
                  >
                    {s.company_name}
                    <button type="button" onClick={() => toggle(s.id)} className="text-blue-400 hover:text-blue-700">
                      ✕
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )}

      {error && <p className="mb-3 text-sm text-red-600">{error}</p>}

      {action && (
        <button
          type="button"
          onClick={submit}
          disabled={busy}
          className={`${btnBase} w-full py-3 text-white disabled:opacity-50 ${
            action === "close" ? "bg-green-600 hover:bg-green-700"
            : action === "cancel" ? "bg-red-600 hover:bg-red-700"
            : "bg-blue-600 hover:bg-blue-700"
          }`}
        >
          {busy
            ? "Working…"
            : action === "close"
              ? "Confirm: close job"
              : action === "cancel"
                ? "Confirm: cancel job"
                : "Confirm: start new cycle & notify engineer"}
        </button>
      )}
    </div>
  );
}
