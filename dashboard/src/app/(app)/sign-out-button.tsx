"use client";

import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export default function SignOutButton() {
  const router = useRouter();
  return (
    <button
      onClick={async () => {
        await createClient().auth.signOut();
        router.push("/login");
        router.refresh();
      }}
      className="mt-3 w-full rounded-md border border-white/20 py-1.5 text-xs font-medium text-blue-100/80 transition-colors hover:bg-white/10 hover:text-white"
    >
      Sign out
    </button>
  );
}
