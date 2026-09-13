"use client";

import { useMemo, useState } from "react";
import type { Category, Profile, SubCategory } from "@/lib/types";
import { createJob } from "./actions";

export interface SupplierOption {
  id: string;
  company_name: string;
  tier_id: string;
  category_ids: string[];
}

const inputCls =
  "w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none";
const labelCls = "mb-1 block text-xs font-medium text-slate-600";

export default function CreateJobForm({
  engineers,
  categories,
  tiers,
  suppliers,
  minSuppliers,
}: {
  engineers: Profile[];
  categories: Category[];
  tiers: SubCategory[];
  suppliers: SupplierOption[];
  minSuppliers: number;
}) {
  const [prReference, setPrReference] = useState("");
  const [description, setDescription] = useState("");
  const [title, setTitle] = useState("");
  const [location, setLocation] = useState("");
  const [priority, setPriority] = useState<"normal" | "urgent">("normal");
  const [expectedRequirement, setExpectedRequirement] = useState("");

  // FR-08: searchable engineer selection
  const [engineerQuery, setEngineerQuery] = useState("");
  const [engineerId, setEngineerId] = useState<string | null>(null);
  const matchedEngineers = useMemo(() => {
    if (!engineerQuery) return engineers;
    const q = engineerQuery.toLowerCase();
    return engineers.filter((e) => e.name.toLowerCase().includes(q));
  }, [engineers, engineerQuery]);
  const selectedEngineer = engineers.find((e) => e.id === engineerId) ?? null;

  // FR-09/FR-10: category + sub-category filter, search within filtered result
  const [categoryId, setCategoryId] = useState("");
  const [tierId, setTierId] = useState("");
  const [supplierQuery, setSupplierQuery] = useState("");
  const [selectedSupplierIds, setSelectedSupplierIds] = useState<Set<string>>(new Set());

  const filteredSuppliers = useMemo(() => {
    if (!categoryId || !tierId) return [];
    let list = suppliers.filter((s) => s.tier_id === tierId && s.category_ids.includes(categoryId));
    if (supplierQuery) {
      const q = supplierQuery.toLowerCase();
      list = list.filter((s) => s.company_name.toLowerCase().includes(q));
    }
    return list;
  }, [suppliers, categoryId, tierId, supplierQuery]);

  const selectedSuppliers = suppliers.filter((s) => selectedSupplierIds.has(s.id));

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function toggleSupplier(id: string) {
    setSelectedSupplierIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }

  // FR-11: Select All applies to the currently displayed (filtered + searched) result
  function selectAllFiltered() {
    setSelectedSupplierIds((prev) => {
      const next = new Set(prev);
      filteredSuppliers.forEach((s) => next.add(s.id));
      return next;
    });
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!engineerId) {
      setError("Select the assigned engineer.");
      return;
    }
    if (selectedSupplierIds.size === 0) {
      setError("Select at least one supplier.");
      return;
    }
    if (
      selectedSupplierIds.size < minSuppliers &&
      !confirm(
        `Only ${selectedSupplierIds.size} supplier(s) selected. The automatic confirmation threshold needs ${minSuppliers} Available responses, so confirmation may be impossible. Create the job anyway?`,
      )
    ) {
      return;
    }
    setSubmitting(true);
    const result = await createJob({
      pr_reference: prReference,
      description,
      title: title || null,
      engineer_id: engineerId,
      location,
      priority,
      main_category_id: categoryId || null,
      sub_category_id: tierId || null,
      supplier_ids: Array.from(selectedSupplierIds),
      expected_requirement: expectedRequirement || null,
      notes: null,
    });
    if (result?.error) {
      setError(result.error);
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="grid max-w-5xl gap-6 lg:grid-cols-2">
      <div className="space-y-4 rounded-xl bg-white p-6 shadow-sm">
        <h2 className="text-lg font-semibold text-slate-900">PR details</h2>
        <div>
          <label className={labelCls}>PR number *</label>
          <input value={prReference} onChange={(e) => setPrReference(e.target.value)} required className={inputCls} />
        </div>
        <div>
          <label className={labelCls}>PR / job description *</label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            required
            rows={3}
            className={inputCls}
          />
        </div>
        <div>
          <label className={labelCls}>Job title (optional)</label>
          <input value={title} onChange={(e) => setTitle(e.target.value)} className={inputCls} />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className={labelCls}>Site / location *</label>
            <input value={location} onChange={(e) => setLocation(e.target.value)} required className={inputCls} />
          </div>
          <div>
            <label className={labelCls}>Priority *</label>
            <select value={priority} onChange={(e) => setPriority(e.target.value as "normal" | "urgent")} className={inputCls}>
              <option value="normal">Normal</option>
              <option value="urgent">Urgent</option>
            </select>
          </div>
        </div>
        <div>
          <label className={labelCls}>Expected visit requirement</label>
          <input
            value={expectedRequirement}
            onChange={(e) => setExpectedRequirement(e.target.value)}
            placeholder="e.g. inspection, site visit, quotation"
            className={inputCls}
          />
        </div>

        <h2 className="pt-2 text-lg font-semibold text-slate-900">Assigned engineer</h2>
        {selectedEngineer ? (
          <div className="flex items-center justify-between rounded-md border border-blue-200 bg-blue-50 px-3 py-2">
            <div>
              <p className="text-sm font-medium text-slate-900">{selectedEngineer.name}</p>
              <p className="text-xs text-slate-500">
                {[selectedEngineer.department, selectedEngineer.designation].filter(Boolean).join(" · ")}
              </p>
            </div>
            <button type="button" onClick={() => setEngineerId(null)} className="text-xs text-blue-600 hover:underline">
              Change
            </button>
          </div>
        ) : (
          <div>
            <input
              value={engineerQuery}
              onChange={(e) => setEngineerQuery(e.target.value)}
              placeholder="Search engineer by name…"
              className={inputCls}
            />
            <ul className="mt-1 max-h-40 divide-y divide-slate-100 overflow-y-auto rounded-md border border-slate-200">
              {matchedEngineers.map((e) => (
                <li key={e.id}>
                  <button
                    type="button"
                    onClick={() => setEngineerId(e.id)}
                    className="w-full px-3 py-2 text-left text-sm hover:bg-slate-50"
                  >
                    <span className="font-medium text-slate-900">{e.name}</span>
                    <span className="block text-xs text-slate-500">
                      {[e.department, e.designation].filter(Boolean).join(" · ")}
                    </span>
                  </button>
                </li>
              ))}
              {matchedEngineers.length === 0 && (
                <li className="px-3 py-3 text-center text-xs text-slate-400">No matching active engineers.</li>
              )}
            </ul>
          </div>
        )}
      </div>

      <div className="space-y-4 rounded-xl bg-white p-6 shadow-sm">
        <h2 className="text-lg font-semibold text-slate-900">Suppliers</h2>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className={labelCls}>Main category *</label>
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
            <label className={labelCls}>Sub-category / tier *</label>
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

        {categoryId && tierId ? (
          <>
            <div className="flex items-center gap-2">
              <input
                value={supplierQuery}
                onChange={(e) => setSupplierQuery(e.target.value)}
                placeholder="Search within filtered suppliers…"
                className={inputCls}
              />
              <button
                type="button"
                onClick={selectAllFiltered}
                disabled={filteredSuppliers.length === 0}
                className="shrink-0 rounded-md border border-blue-600 px-3 py-2 text-xs font-semibold text-blue-600 hover:bg-blue-50 disabled:opacity-40"
              >
                Select all ({filteredSuppliers.length})
              </button>
            </div>
            <ul className="max-h-48 divide-y divide-slate-100 overflow-y-auto rounded-md border border-slate-200">
              {filteredSuppliers.map((s) => (
                <li key={s.id}>
                  <label className="flex cursor-pointer items-center gap-2 px-3 py-2 text-sm hover:bg-slate-50">
                    <input
                      type="checkbox"
                      checked={selectedSupplierIds.has(s.id)}
                      onChange={() => toggleSupplier(s.id)}
                    />
                    {s.company_name}
                  </label>
                </li>
              ))}
              {filteredSuppliers.length === 0 && (
                <li className="px-3 py-4 text-center text-xs text-slate-400">
                  No active suppliers match this category and tier.
                </li>
              )}
            </ul>
          </>
        ) : (
          <p className="rounded-md bg-slate-50 px-3 py-4 text-center text-xs text-slate-400">
            Choose a main category and sub-category to load matching suppliers.
          </p>
        )}

        <div>
          <h3 className="mb-2 text-sm font-semibold text-slate-700">
            Selected suppliers ({selectedSuppliers.length})
            {selectedSuppliers.length > 0 && selectedSuppliers.length < minSuppliers && (
              <span className="ml-2 rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-700">
                below minimum of {minSuppliers}
              </span>
            )}
          </h3>
          {selectedSuppliers.length === 0 ? (
            <p className="text-xs text-slate-400">Nothing selected yet.</p>
          ) : (
            <ul className="flex flex-wrap gap-2">
              {selectedSuppliers.map((s) => (
                <li
                  key={s.id}
                  className="flex items-center gap-1 rounded-full bg-blue-50 px-3 py-1 text-xs font-medium text-blue-700"
                >
                  {s.company_name}
                  <button type="button" onClick={() => toggleSupplier(s.id)} className="text-blue-400 hover:text-blue-700">
                    ✕
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        {error && <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}

        <button
          type="submit"
          disabled={submitting}
          className="w-full rounded-md bg-blue-600 py-2.5 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
        >
          {submitting ? "Creating job…" : "Create job & notify engineer"}
        </button>
      </div>
    </form>
  );
}
