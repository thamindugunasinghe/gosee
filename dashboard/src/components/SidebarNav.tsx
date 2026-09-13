"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const NAV: { href: string; label: string; icon: JSX.Element }[] = [
  { href: "/", label: "Dashboard", icon: <path d="M3 12l9-9 9 9M5 10v10h14V10" /> },
  { href: "/jobs", label: "Jobs", icon: <><rect x="3" y="4" width="18" height="16" rx="2" /><path d="M3 9h18M8 4v5" /></> },
  { href: "/jobs/new", label: "Create Job", icon: <path d="M12 5v14M5 12h14" /> },
  { href: "/users", label: "Users", icon: <><circle cx="9" cy="8" r="3" /><path d="M3 20c0-3 3-5 6-5s6 2 6 5M17 11h4M19 9v4" /></> },
  { href: "/suppliers", label: "Suppliers", icon: <><path d="M3 9l1-4h16l1 4M4 9v11h16V9M9 13h6" /></> },
  { href: "/categories", label: "Categories", icon: <><rect x="3" y="3" width="7" height="7" rx="1.5" /><rect x="14" y="3" width="7" height="7" rx="1.5" /><rect x="3" y="14" width="7" height="7" rx="1.5" /><rect x="14" y="14" width="7" height="7" rx="1.5" /></> },
  { href: "/settings", label: "Settings", icon: <><circle cx="12" cy="12" r="3" /><path d="M12 2v3M12 19v3M2 12h3M19 12h3M5 5l2 2M17 17l2 2M19 5l-2 2M7 17l-2 2" /></> },
];

export default function SidebarNav() {
  const pathname = usePathname();

  function isActive(href: string) {
    if (href === "/") return pathname === "/";
    if (href === "/jobs") return pathname === "/jobs" || (pathname.startsWith("/jobs/") && pathname !== "/jobs/new");
    return pathname.startsWith(href);
  }

  return (
    <nav className="flex-1 space-y-1 p-3">
      {NAV.map((item) => {
        const active = isActive(item.href);
        return (
          <Link
            key={item.href}
            href={item.href}
            className={`group flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors ${
              active
                ? "bg-white/15 text-white"
                : "text-blue-100/70 hover:bg-white/10 hover:text-white"
            }`}
          >
            <svg
              width="19"
              height="19"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.9"
              strokeLinecap="round"
              strokeLinejoin="round"
              className={active ? "text-[#22c55e]" : "text-blue-200/70 group-hover:text-white"}
            >
              {item.icon}
            </svg>
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
