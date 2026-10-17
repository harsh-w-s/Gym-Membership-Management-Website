"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const NAV = [
  { href: "/", label: "Dashboard", icon: "📊" },
  { href: "/clients", label: "Clients", icon: "👥" },
  { href: "/add-client", label: "Add Client", icon: "➕" },
  { href: "/trainers", label: "Trainers", icon: "🏋️‍♂️" },
];

export function Sidebar({ gymName }: { gymName: string }) {
  const pathname = usePathname();

  return (
    <aside className="border-b border-slate-200 bg-white md:fixed md:inset-y-0 md:left-0 md:w-60 md:border-b-0 md:border-r">
      <div className="flex items-center gap-2 px-5 py-4 md:py-6">
        <span className="grid h-9 w-9 place-items-center rounded-lg bg-emerald-600 text-lg text-white">🏋️</span>
        <span className="truncate font-semibold tracking-tight">{gymName}</span>
      </div>
      <nav className="flex gap-1 overflow-x-auto px-3 pb-3 md:flex-col md:pb-0">
        {NAV.map(({ href, label, icon }) => {
          // "/clients" stays highlighted on /clients/123 and /clients/123/edit too.
          const active = href === "/" ? pathname === "/" : pathname === href || pathname.startsWith(`${href}/`);
          return (
            <Link
              key={href}
              href={href}
              aria-current={active ? "page" : undefined}
              className={`flex items-center gap-3 whitespace-nowrap rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                active ? "bg-emerald-50 text-emerald-700" : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
              }`}
            >
              <span aria-hidden>{icon}</span>
              {label}
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}
