import { createClient } from "@/lib/supabase/server";
import SettingsForm from "./settings-form";

export default async function SettingsPage() {
  const supabase = createClient();
  const { data } = await supabase.from("system_config").select("key, value");

  const config: Record<string, unknown> = {};
  for (const row of (data ?? []) as { key: string; value: unknown }[]) {
    config[row.key] = row.value;
  }

  return (
    <div>
      <h1 className="mb-1 text-2xl font-bold text-slate-900">Settings</h1>
      <p className="mb-6 text-sm text-slate-500">
        Configure thresholds, scheduling windows, working hours, reminders, and where Procurement alerts are
        sent. Changes apply to new jobs and actions immediately.
      </p>
      <SettingsForm config={config} />
    </div>
  );
}
