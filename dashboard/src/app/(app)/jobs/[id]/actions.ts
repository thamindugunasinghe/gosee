"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export async function procurementClose(input: {
  job_id: string;
  cycle_id: string;
  action: "close" | "recirculate" | "cancel";
  reason: string | null;
  supplier_ids: string[];
}): Promise<{ error?: string }> {
  const supabase = createClient();

  const { error } = await supabase.rpc("rpc_procurement_close", {
    p_cycle_id: input.cycle_id,
    p_action: input.action,
    p_reason: input.reason,
    p_supplier_ids: input.supplier_ids,
  });
  if (error) return { error: error.message };

  // Deliver the queued notification SMS now; the sweeper is the fallback.
  try {
    await fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/send-sms`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({}),
    });
  } catch {
    // Non-fatal
  }

  revalidatePath(`/jobs/${input.job_id}`);
  redirect(`/jobs/${input.job_id}?done=${input.action}`);
}
