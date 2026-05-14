"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { useEffect, useState } from "react";
import clsx from "clsx";

const navItems = [
  {
    href: "/dashboard",
    label: "Dashboard",
    adminOnly: false,
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/>
        <rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/>
      </svg>
    ),
  },
  {
    href: "/dashboard/fleet",
    label: "Vozni park",
    adminOnly: false,
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M5 17H3a2 2 0 01-2-2V9a2 2 0 012-2h16a2 2 0 012 2v6a2 2 0 01-2 2h-2"/>
        <rect x="7" y="14" width="10" height="5" rx="2"/>
        <circle cx="7" cy="19" r="2"/><circle cx="17" cy="19" r="2"/>
      </svg>
    ),
  },
  {
    href: "/dashboard/rentals",
    label: "Kratkoročni najam",
    adminOnly: false,
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/>
        <line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>
      </svg>
    ),
  },
  {
    href: "/dashboard/analytics",
    label: "Analitika",
    adminOnly: true,
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/>
      </svg>
    ),
  },
  {
    href: "/dashboard/leasing",
    label: "Leasing Kalkulator",
    adminOnly: true,
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 000 7h5a3.5 3.5 0 010 7H6"/>
      </svg>
    ),
  },
  {
    href: "/dashboard/clients",
    label: "Klijenti",
    adminOnly: false,
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/>
        <circle cx="9" cy="7" r="4"/>
        <path d="M23 21v-2a4 4 0 00-3-3.87"/><path d="M16 3.13a4 4 0 010 7.75"/>
      </svg>
    ),
  },
];

export default function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const supabase = createClient();

  const [role, setRole] = useState<"admin" | "agent">("agent");
  const [userName, setUserName] = useState("");
  const [loading, setLoading] = useState(true);
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    const fetchProfile = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data: profile } = await supabase
        .from("profiles")
        .select("full_name, role")
        .eq("id", user.id)
        .single();
      if (profile) {
        setRole(profile.role as "admin" | "agent");
        setUserName(profile.full_name || user.email || "");
      }
      setLoading(false);
    };
    fetchProfile();
  }, []);

  // Close drawer on route change
  useEffect(() => { setMobileOpen(false); }, [pathname]);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.push("/login");
  };

  const visibleItems = navItems.filter((item) => !item.adminOnly || role === "admin");

  const sidebarContent = (
    <aside className="w-60 bg-ink-100 flex flex-col h-full">
      {/* Logo + mobile close button */}
      <div className="px-5 pt-5 pb-4 flex items-start justify-between">
        <Link href="/dashboard" className="block hover:opacity-75 transition-opacity">
          <h1 className="text-lg font-black text-brand-500 leading-tight tracking-tight">VTZ Rent-a-Car</h1>
          <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-widest mt-0.5">
            Fleet Management System
          </p>
        </Link>
        <button
          className="lg:hidden ml-2 mt-0.5 p-1.5 rounded-md text-slate-400 hover:text-slate-700 hover:bg-slate-200 transition-colors"
          onClick={() => setMobileOpen(false)}
          aria-label="Zatvori meni"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
          </svg>
        </button>
      </div>

      {/* Create Reservation CTA */}
      <div className="px-3 mb-4">
        <Link
          href="/dashboard/rentals"
          className="flex items-center justify-center gap-2 w-full bg-brand-500 hover:bg-brand-600 text-white py-2.5 rounded-lg text-[13px] font-semibold transition-colors shadow-sm active:scale-95"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="16"/><line x1="8" y1="12" x2="16" y2="12"/>
          </svg>
          Kreiraj rezervaciju
        </Link>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-2 space-y-0.5 overflow-y-auto">
        {loading ? (
          <div className="px-4 py-2 text-xs text-slate-400">Učitavanje...</div>
        ) : (
          visibleItems.map((item) => {
            const active =
              item.href === "/dashboard"
                ? pathname === "/dashboard"
                : pathname.startsWith(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={clsx(
                  "flex items-center gap-3 px-4 py-2.5 rounded-lg text-[13px] font-semibold transition-all duration-150",
                  active
                    ? "bg-white text-brand-500 border-l-4 border-[#003580] shadow-sm pl-3"
                    : "text-slate-500 hover:bg-slate-100 hover:text-slate-900"
                )}
              >
                <span className={active ? "text-brand-500" : "text-slate-500"}>
                  {item.icon}
                </span>
                <span>{item.label}</span>
                {item.adminOnly && (
                  <span className="ml-auto text-[10px] font-bold bg-brand-500/10 text-brand-500 px-1.5 py-0.5 rounded uppercase tracking-wide">
                    Admin
                  </span>
                )}
              </Link>
            );
          })
        )}
      </nav>

      {/* Bottom section */}
      <div className="px-2 pt-3 pb-4 border-t border-ink-150 space-y-0.5 mt-auto">
        <button
          onClick={handleLogout}
          className="flex items-center gap-3 w-full px-4 py-2.5 rounded-lg text-[13px] font-semibold text-red-500 hover:bg-red-50 transition-all duration-150"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4"/><polyline points="16 17 21 12 16 7"/>
            <line x1="21" y1="12" x2="9" y2="12"/>
          </svg>
          Odjava
        </button>

        {!loading && (
          <div className="flex items-center gap-3 px-3 py-2.5 mt-1 rounded-lg bg-white border border-ink-150 shadow-sm">
            <div className="w-7 h-7 rounded-full bg-brand-500 flex items-center justify-center flex-shrink-0">
              <span className="text-white text-xs font-bold">
                {userName?.charAt(0)?.toUpperCase() || "U"}
              </span>
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-xs font-semibold text-slate-800 truncate leading-tight">
                {userName || "Korisnik"}
              </div>
              <div className={clsx(
                "text-[10px] font-bold uppercase tracking-wide",
                role === "admin" ? "text-brand-500" : "text-sky-600"
              )}>
                {role}
              </div>
            </div>
          </div>
        )}
      </div>
    </aside>
  );

  return (
    <>
      {/* Desktop sidebar — always visible, in-flow */}
      <div className="hidden lg:flex w-60 flex-shrink-0 border-r border-ink-150 sticky top-0 h-screen overflow-y-auto">
        {sidebarContent}
      </div>

      {/* Mobile backdrop */}
      {mobileOpen && (
        <div
          className="lg:hidden fixed inset-0 bg-black/40 z-40"
          onClick={() => setMobileOpen(false)}
        />
      )}

      {/* Mobile slide-in drawer */}
      <div
        className={clsx(
          "lg:hidden fixed top-0 left-0 h-full z-50 shadow-2xl border-r border-ink-150 transition-transform duration-300 ease-in-out",
          mobileOpen ? "translate-x-0" : "-translate-x-full"
        )}
      >
        {sidebarContent}
      </div>

      {/* Mobile hamburger button */}
      <button
        className="lg:hidden fixed top-3.5 left-4 z-30 w-9 h-9 bg-brand-500 text-white rounded-lg flex items-center justify-center shadow-md active:scale-95 transition-transform"
        onClick={() => setMobileOpen(true)}
        aria-label="Otvori meni"
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="18" x2="21" y2="18"/>
        </svg>
      </button>
    </>
  );
}
