"use client";

import { useState } from "react";
import { saveSettings, type ConfigUpdate } from "./actions";

type FieldType = "number" | "time" | "text" | "days";

interface Field {
  key: string;
  label: string;
  type: FieldType;
  hint?: string;
  min?: number;
  placeholder?: string;
}

interface Group {
  title: string;
  blurb: string;
  fields: Field[];
}

const GROUPS: Group[] = [
  {
    title: "Confirmation & suppliers",
    blurb: "How many supplier responses lock a visit, and selection warnings.",
    fields: [
      { key: "confirmation_threshold", label: "Auto-confirm threshold (first cycle)", type: "number", min: 1, hint: "Available responses that lock the selected time on the initial cycle" },
      { key: "recirculation_confirmation_threshold", label: "Auto-confirm threshold (recirculation)", type: "number", min: 1, hint: "Available responses that lock the time on a recirculated cycle (R1+). Usually 1." },
      { key: "override_count", label: "Override count", type: "number", min: 1, hint: "Exactly this many Available at cutoff triggers a Procurement override decision" },
      { key: "min_suppliers_invited", label: "Minimum suppliers to invite", type: "number", min: 1, hint: "Warn when fewer suppliers are selected" },
    ],
  },
  {
    title: "Scheduling window & timing",
    blurb: "The rolling window an engineer can pick from and slot granularity.",
    fields: [
      { key: "scheduling_window_hours", label: "Scheduling window (hours)", type: "number", min: 1, hint: "How far ahead an engineer may select" },
      { key: "min_lead_time_hours", label: "Minimum lead time (hours)", type: "number", min: 0, hint: "Earliest selectable slot from now" },
      { key: "slot_increment_minutes", label: "Slot size (minutes)", type: "number", min: 5, hint: "Timeline granularity / minimum visit duration" },
      { key: "response_cutoff_hours", label: "Response cutoff (hours before visit)", type: "number", min: 0, hint: "When the final supplier-count decision runs" },
      { key: "suggestion_gap_minutes", label: "Suggestion gap (minutes)", type: "number", min: 0, hint: "Recommended gap around an existing supplier visit" },
    ],
  },
  {
    title: "Working hours & days",
    blurb: "Site hours and weekdays available for visits.",
    fields: [
      { key: "working_hours_start", label: "Working hours start", type: "time" },
      { key: "working_hours_end", label: "Working hours end", type: "time" },
      { key: "working_days", label: "Working days", type: "days", hint: "Days selectable for visits" },
    ],
  },
  {
    title: "Reminders & SLAs",
    blurb: "Automatic reminder cadence and closure deadlines.",
    fields: [
      { key: "supplier_reminder_after_invite_hours", label: "First supplier reminder (hours after invite)", type: "number", min: 0 },
      { key: "supplier_reminder_before_cutoff_hours", label: "Second supplier reminder (hours before cutoff)", type: "number", min: 0 },
      { key: "engineer_closure_grace_minutes", label: "Closure grace (minutes after visit)", type: "number", min: 0 },
      { key: "engineer_closure_reminder_minutes", label: "Closure reminder repeat (minutes)", type: "number", min: 0 },
      { key: "manager_escalation_repeat_hours", label: "Manager escalation repeat (hours)", type: "number", min: 0 },
      { key: "procurement_closure_sla_days", label: "Procurement closure SLA (days)", type: "number", min: 1, hint: "Days after engineer close to close / recirculate / cancel" },
    ],
  },
  {
    title: "Notifications",
    blurb: "Where Procurement close/recirculate SMS alerts are sent.",
    fields: [
      { key: "procurement_notify_mobile", label: "Procurement alerts mobile", type: "text", placeholder: "07XXXXXXXX", hint: "Receives N-06 close alerts and closure confirmations. Leave blank to disable." },
    ],
  },
  {
    title: "OTP & security",
    blurb: "Login one-time-code behaviour for the mobile app.",
    fields: [
      { key: "otp_validity_minutes", label: "OTP validity (minutes)", type: "number", min: 1 },
      { key: "otp_resend_seconds", label: "OTP resend cooldown (seconds)", type: "number", min: 0 },
      { key: "otp_max_attempts", label: "OTP max attempts", type: "number", min: 1 },
    ],
  },
];

const DAY_LABELS: { iso: number; label: string }[] = [
  { iso: 1, label: "Mon" },
  { iso: 2, label: "Tue" },
  { iso: 3, label: "Wed" },
  { iso: 4, label: "Thu" },
  { iso: 5, label: "Fri" },
  { iso: 6, label: "Sat" },
  { iso: 7, label: "Sun" },
];

const inputCls =
  "w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none";

function toFormValue(type: FieldType, raw: unknown): string | number[] {
  if (type === "days") return Array.isArray(raw) ? (raw as number[]) : [];
  if (type === "number") return raw == null ? "" : String(raw);
  return raw == null ? "" : String(raw);
}

export default function SettingsForm({ config }: { config: Record<string, unknown> }) {
  const [values, setValues] = useState<Record<string, string | number[]>>(() => {
    const init: Record<string, string | number[]> = {};
    for (const g of GROUPS) for (const f of g.fields) init[f.key] = toFormValue(f.type, config[f.key]);
    return init;
  });
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);

  function setField(key: string, v: string | number[]) {
    setValues((prev) => ({ ...prev, [key]: v }));
    setMessage(null);
  }

  function toggleDay(key: string, iso: number) {
    setValues((prev) => {
      const cur = new Set((prev[key] as number[]) ?? []);
      if (cur.has(iso)) cur.delete(iso);
      else cur.add(iso);
      return { ...prev, [key]: Array.from(cur).sort((a, b) => a - b) };
    });
    setMessage(null);
  }

  async function onSave() {
    setSaving(true);
    setMessage(null);

    const updates: ConfigUpdate[] = [];
    for (const g of GROUPS) {
      for (const f of g.fields) {
        const v = values[f.key];
        if (f.type === "days") {
          updates.push({ key: f.key, value: v as number[] });
        } else if (f.type === "number") {
          const n = Number(v);
          if (v === "" || Number.isNaN(n)) {
            setSaving(false);
            setMessage({ ok: false, text: `${f.label} must be a number.` });
            return;
          }
          updates.push({ key: f.key, value: n });
        } else {
          updates.push({ key: f.key, value: String(v) });
        }
      }
    }

    const res = await saveSettings(updates);
    setSaving(false);
    if (res.error) setMessage({ ok: false, text: res.error });
    else setMessage({ ok: true, text: `Saved ${res.saved} settings.` });
  }

  return (
    <div className="max-w-3xl space-y-6">
      {GROUPS.map((g) => (
        <section key={g.title} className="rounded-xl bg-white p-6 shadow-sm">
          <h2 className="text-lg font-semibold text-slate-900">{g.title}</h2>
          <p className="mb-4 text-sm text-slate-500">{g.blurb}</p>
          <div className="grid gap-4 sm:grid-cols-2">
            {g.fields.map((f) => (
              <div key={f.key} className={f.type === "days" ? "sm:col-span-2" : ""}>
                <label className="mb-1 block text-xs font-medium text-slate-600">{f.label}</label>
                {f.type === "days" ? (
                  <div className="flex flex-wrap gap-2">
                    {DAY_LABELS.map((d) => {
                      const on = ((values[f.key] as number[]) ?? []).includes(d.iso);
                      return (
                        <button
                          key={d.iso}
                          type="button"
                          onClick={() => toggleDay(f.key, d.iso)}
                          className={`rounded-md px-3 py-1.5 text-xs font-semibold ${
                            on ? "bg-blue-600 text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                          }`}
                        >
                          {d.label}
                        </button>
                      );
                    })}
                  </div>
                ) : (
                  <input
                    type={f.type === "number" ? "number" : f.type === "time" ? "time" : "text"}
                    min={f.min}
                    placeholder={f.placeholder}
                    value={values[f.key] as string}
                    onChange={(e) => setField(f.key, e.target.value)}
                    className={inputCls}
                  />
                )}
                {f.hint && <p className="mt-1 text-xs text-slate-400">{f.hint}</p>}
              </div>
            ))}
          </div>
        </section>
      ))}

      <div className="sticky bottom-4 flex items-center gap-3 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <button
          type="button"
          onClick={onSave}
          disabled={saving}
          className="rounded-md bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
        >
          {saving ? "Saving…" : "Save all settings"}
        </button>
        {message && (
          <span className={`text-sm ${message.ok ? "text-green-600" : "text-red-600"}`}>{message.text}</span>
        )}
      </div>
    </div>
  );
}
