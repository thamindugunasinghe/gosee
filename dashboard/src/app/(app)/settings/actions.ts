"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export interface ConfigUpdate {
  key: string;
  value: unknown; // stored as jsonb
}

export async function saveSettings(updates: ConfigUpdate[]): Promise<{ error?: string; saved?: number }> {
  const supabase = createClient();

  for (const u of updates) {
    const { error } = await supabase.rpc("rpc_update_config", { p_key: u.key, p_value: u.value });
    if (error) return { error: `${u.key}: ${error.message}` };
  }

  revalidatePath("/settings");
  return { saved: updates.length };
}
