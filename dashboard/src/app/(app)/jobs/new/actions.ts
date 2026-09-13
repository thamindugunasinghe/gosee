"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export interface CreateJobInput {
  pr_reference: string;
  description: string;
  title: string | null;
  engineer_id: string;
  location: string;
  priority: "normal" | "urgent";
  main_category_id: string | null;
  sub_category_id: string | null;
  supplier_ids: string[];
  expected_requirement: string | null;
  notes: string | null;
}

export async function createJob(input: CreateJobInput): Promise<{ error?: string }> {
  const supabase = createClient();

  const { data: jobId, error } = await supabase.rpc("rpc_create_job", {
    p_pr_reference: input.pr_reference,
    p_description: input.description,
    p_title: input.title,
    p_engineer_id: input.engineer_id,
    p_location: input.location,
    p_priority: input.priority,
    p_main_category_id: input.main_category_id,
    p_sub_category_id: input.sub_category_id,
    p_supplier_ids: input.supplier_ids,
    p_expected_requirement: input.expected_requirement,
    p_notes: input.notes,
  });

  if (error) return { error: error.message };

  // Deliver the queued N-01 SMS now; the cron sweeper is the fallback.
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
    // Non-fatal: notification stays queued and will be swept.
  }

  redirect(`/jobs?created=${jobId}`);
}
