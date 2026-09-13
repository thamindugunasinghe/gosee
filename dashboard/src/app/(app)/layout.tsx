import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { DASHBOARD_ROLES, type Profile } from "@/lib/types";
import SignOutButton from "./sign-out-button";
import { LogoFull } from "@/components/Logo";
import SidebarNav from "@/components/SidebarNav";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .single<Profile>();

  if (!profile || !DASHBOARD_ROLES.includes(profile.role)) {
    return (
      <main className="flex min-h-screen items-center justify-center">
        <div className="text-center">
          <h1 className="text-xl font-semibold">Access denied</h1>
          <p className="mt-2 text-sm text-slate-500">
            This dashboard is for Procurement and System Admin users only.
          </p>
          <SignOutButton />
        </div>
      </main>
    );
  }

  return (
    <div className="flex min-h-screen bg-[#f4f6fb]">
      <aside className="flex w-60 flex-col bg-gradient-to-b from-[#0a2a5e] to-[#071e45]">
        <div className="px-5 py-5">
          <div className="flex items-center justify-center rounded-xl bg-white px-3 py-4 shadow-sm">
            <LogoFull className="w-[190px] h-auto" />
          </div>
        </div>
        <SidebarNav />
        <div className="m-3 rounded-lg bg-white/10 p-3">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-[#1e5fd8] text-sm font-bold text-white">
              {profile.name.charAt(0).toUpperCase()}
            </div>
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-white">{profile.name}</p>
              <p className="truncate text-xs capitalize text-blue-200/70">{profile.role.replace("_", " ")}</p>
            </div>
          </div>
          <SignOutButton />
        </div>
      </aside>
      <main className="flex-1 overflow-y-auto p-8">{children}</main>
    </div>
  );
}
