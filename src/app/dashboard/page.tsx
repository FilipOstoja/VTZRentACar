import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import AirportArrivalsCard from "@/components/AirportArrivalsCard";
import type { AirportRental } from "@/components/AirportArrivalsCard";

export const dynamic = "force-dynamic";
export const revalidate = 0;

// ── Stat card ──────────────────────────────────────────────
function StatCard({
  label,
  value,
  sub,
  icon,
  iconColor,
  bar,
  barValue,
  barSub,
}: {
  label: string;
  value: string | number;
  sub?: string;
  icon: React.ReactNode;
  iconColor: string;
  bar?: boolean;
  barValue?: number;
  barSub?: string;
}) {
  return (
    <div className="bg-white border border-[#E7E7E7] rounded-xl shadow-sm p-5">
      <div className="flex items-center justify-between mb-3">
        <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">{label}</span>
        <span className={iconColor}>{icon}</span>
      </div>
      <div className="flex items-end gap-2">
        <span className="text-2xl font-bold text-slate-900 leading-none">{value}</span>
        {sub && <span className="text-[11px] font-semibold text-emerald-600 pb-0.5">{sub}</span>}
      </div>
      {bar && (
        <div className="w-full bg-slate-100 h-1.5 rounded-full mt-3 overflow-hidden">
          <div className="bg-[#003580] h-full rounded-full" style={{ width: `${barValue}%` }} />
        </div>
      )}
      {barSub && <p className="text-[11px] text-slate-400 mt-2">{barSub}</p>}
    </div>
  );
}

// ── Alert item ─────────────────────────────────────────────
function AlertItem({
  type,
  title,
  message,
  action,
  actionHref,
}: {
  type: "danger" | "warning" | "info";
  title: string;
  message: string;
  action?: string;
  actionHref?: string;
}) {
  const styles = {
    danger:  { wrap: "bg-red-50 border-l-4 border-red-500",  icon: "text-red-500",  title: "text-red-700",  btn: "text-red-600 hover:text-red-800" },
    warning: { wrap: "bg-amber-50 border-l-4 border-amber-500", icon: "text-amber-600", title: "text-amber-800", btn: "text-amber-700 hover:text-amber-900" },
    info:    { wrap: "bg-blue-50 border-l-4 border-blue-400",  icon: "text-blue-600", title: "text-blue-800",  btn: "text-blue-700 hover:text-blue-900" },
  }[type];

  const Icon = type === "danger" ? (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/>
      <line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>
    </svg>
  ) : type === "warning" ? (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="3"/>
      <path d="M19.07 4.93l-1.41 1.41M4.93 4.93l1.41 1.41M4.93 19.07l1.41-1.41M19.07 19.07l-1.41-1.41M12 2v2M12 20v2M2 12h2M20 12h2"/>
    </svg>
  ) : (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
    </svg>
  );

  return (
    <div className={`flex gap-3 p-3 rounded-r-lg ${styles.wrap}`}>
      <span className={`flex-shrink-0 mt-0.5 ${styles.icon}`}>{Icon}</span>
      <div>
        <p className={`text-sm font-bold leading-tight ${styles.title}`}>{title}</p>
        <p className="text-xs text-slate-600 mt-1 leading-relaxed">{message}</p>
        {action && actionHref && (
          <Link href={actionHref} className={`mt-2 inline-block text-[11px] font-bold uppercase tracking-wide hover:underline ${styles.btn}`}>
            {action}
          </Link>
        )}
        {action && !actionHref && (
          <button className={`mt-2 text-[11px] font-bold uppercase tracking-wide hover:underline ${styles.btn}`}>
            {action}
          </button>
        )}
      </div>
    </div>
  );
}

// ── Page ───────────────────────────────────────────────────
export default async function DashboardPage() {
  const supabase = await createClient();

  const today = new Date().toISOString().split("T")[0];
  const in30Days = new Date(Date.now() + 30 * 86400000).toISOString().split("T")[0];

  const [
    { data: vehicles },
    { data: todayRentals },
    { data: expiringRegs },
    { data: activeRentals },
    { data: airportRentalsRaw },
  ] = await Promise.all([
    supabase.from("vehicles").select("status").neq("status", "inactive"),
    supabase
      .from("rentals")
      .select("*, vehicles(make, model, registration), clients(full_name)")
      .or(`start_date.eq.${today},end_date.eq.${today}`)
      .eq("status", "active"),
    supabase
      .from("vehicles")
      .select("id, make, model, registration, registration_expiry")
      .lte("registration_expiry", in30Days)
      .gte("registration_expiry", today)
      .neq("status", "inactive"),
    supabase
      .from("rentals")
      .select("id, end_date, vehicles(make, model, registration)")
      .eq("status", "active"),
    supabase
      .from("rentals")
      .select("id, flight_number, start_date, vehicles(make, model, registration), clients(full_name)")
      .eq("status", "active")
      .eq("pickup_type", "airport"),
  ]);

  const freeCount    = vehicles?.filter((v) => v.status === "free").length    ?? 0;
  const rentedCount  = vehicles?.filter((v) => v.status === "rented").length  ?? 0;
  const serviceCount = vehicles?.filter((v) => v.status === "service").length ?? 0;
  const washCount    = vehicles?.filter((v) => v.status === "washing").length  ?? 0;
  const totalCount   = vehicles?.length ?? 0;
  const utilRate     = totalCount > 0 ? Math.round((rentedCount / totalCount) * 100) : 0;

  const checkouts     = todayRentals?.filter((r) => r.start_date === today) ?? [];
  const checkins      = todayRentals?.filter((r) => r.end_date   === today) ?? [];
  const overdueRentals = activeRentals?.filter((r) => r.end_date < today)   ?? [];

  const airportRentals: AirportRental[] = (airportRentalsRaw ?? []).map((r: any) => ({
    id: r.id,
    flight_number: r.flight_number ?? null,
    start_date: r.start_date,
    client_name: r.clients?.full_name ?? "—",
    vehicle_make: r.vehicles?.make ?? "",
    vehicle_model: r.vehicles?.model ?? "",
    vehicle_registration: r.vehicles?.registration ?? "",
  }));

  const dateLabel = new Date().toLocaleDateString("hr-HR", {
    weekday: "long", day: "numeric", month: "long", year: "numeric",
  });

  return (
    <div className="min-h-screen bg-[#F7F9FC]">
      <div className="p-4 sm:p-6 max-w-[1440px] mx-auto space-y-4 sm:space-y-6">

        {/* Header */}
        <div>
          <h1 className="text-2xl font-bold text-[#003580] tracking-tight">Operativni pregled</h1>
          <p className="text-sm text-slate-500 mt-0.5 capitalize">{dateLabel}</p>
        </div>

        {/* ── Stat cards ── */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard
            label="Iskorištenost flote"
            value={`${utilRate}%`}
            sub={rentedCount > 0 ? `${rentedCount} u najmu` : undefined}
            iconColor="text-[#003580]"
            bar
            barValue={utilRate}
            barSub="Trenutna popunjenost"
            icon={
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="23 6 13.5 15.5 8.5 10.5 1 18"/><polyline points="17 6 23 6 23 12"/>
              </svg>
            }
          />
          <StatCard
            label="Slobodna vozila"
            value={freeCount}
            sub="vozila"
            iconColor="text-emerald-600"
            barSub="Odmah dostupna za najam"
            icon={
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="20 6 9 17 4 12"/>
              </svg>
            }
          />
          <StatCard
            label="Aktivni najam"
            value={rentedCount}
            sub="vozila"
            iconColor="text-blue-600"
            barSub="Trenutno na cesti"
            icon={
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 10H3M16 2l4 8-4 8M8 2L4 10l4 8"/>
              </svg>
            }
          />
          <StatCard
            label="Na servisu / pranju"
            value={serviceCount + washCount}
            sub="vozila"
            iconColor="text-amber-500"
            barSub={`Ukupno vozila: ${totalCount}`}
            icon={
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="3"/>
                <path d="M19.07 4.93l-1.41 1.41M4.93 4.93l1.41 1.41M4.93 19.07l1.41-1.41M19.07 19.07l-1.41-1.41M12 2v2M12 20v2M2 12h2M20 12h2"/>
              </svg>
            }
          />
        </div>

        {/* ── Main grid ── */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

          {/* Arrivals & Departures table (2/3) */}
          <div className="lg:col-span-2 bg-white border border-[#E7E7E7] rounded-xl shadow-sm overflow-hidden">
            <div className="px-5 py-4 border-b border-[#E7E7E7] flex items-center justify-between">
              <h2 className="text-base font-semibold text-[#003580]">Odlasci &amp; Dolasci danas</h2>
              <span className="text-xs text-slate-500 font-medium">
                {checkouts.length + checkins.length} transakcija
              </span>
            </div>

            {checkouts.length === 0 && checkins.length === 0 ? (
              <div className="py-14 text-center text-slate-400 text-sm">
                Nema odlazaka ni dolazaka danas
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead className="bg-slate-50 border-b border-[#E7E7E7]">
                    <tr>
                      {["Tip", "Vozilo", "Klijent", "Status"].map((h) => (
                        <th key={h} className="px-4 py-3 text-[11px] font-semibold text-slate-500 uppercase tracking-wider">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {checkouts.map((r: any) => (
                      <tr key={r.id + "-out"} className="hover:bg-slate-50 transition-colors">
                        <td className="px-4 py-3">
                          <span className="flex items-center gap-1 text-[11px] font-bold text-[#003580]">
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><line x1="7" y1="17" x2="17" y2="7"/><polyline points="7 7 17 7 17 17"/></svg>
                            ODLAZAK
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <p className="text-sm font-semibold text-slate-800">{r.vehicles?.make} {r.vehicles?.model}</p>
                          <p className="text-xs font-mono text-[#003580] font-semibold">{r.vehicles?.registration}</p>
                        </td>
                        <td className="px-4 py-3 text-sm text-slate-600">{r.clients?.full_name}</td>
                        <td className="px-4 py-3">
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase bg-blue-100 text-blue-700">Aktivan</span>
                        </td>
                      </tr>
                    ))}
                    {checkins.map((r: any) => (
                      <tr key={r.id + "-in"} className="hover:bg-slate-50 transition-colors">
                        <td className="px-4 py-3">
                          <span className="flex items-center gap-1 text-[11px] font-bold text-emerald-600">
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><line x1="17" y1="7" x2="7" y2="17"/><polyline points="17 17 7 17 7 7"/></svg>
                            DOLAZAK
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <p className="text-sm font-semibold text-slate-800">{r.vehicles?.make} {r.vehicles?.model}</p>
                          <p className="text-xs font-mono text-[#003580] font-semibold">{r.vehicles?.registration}</p>
                        </td>
                        <td className="px-4 py-3 text-sm text-slate-600">{r.clients?.full_name}</td>
                        <td className="px-4 py-3">
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase bg-emerald-100 text-emerald-700">Povratak</span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Right column — alerts + fleet distribution */}
          <div className="space-y-5">

            {/* Priority alerts */}
            {(overdueRentals.length > 0 || (expiringRegs?.length ?? 0) > 0) && (
              <div className="bg-white border border-[#E7E7E7] rounded-xl shadow-sm overflow-hidden">
                <div className="px-5 py-4 border-b border-[#E7E7E7] flex items-center justify-between">
                  <h2 className="text-base font-semibold text-[#003580]">Prioritetna upozorenja</h2>
                  <span className="w-5 h-5 bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center">
                    {overdueRentals.length + (expiringRegs?.length ?? 0)}
                  </span>
                </div>
                <div className="p-4 space-y-3">
                  {overdueRentals.map((r: any) => (
                    <AlertItem
                      key={r.id}
                      type="danger"
                      title="Prekoračen rok najma"
                      message={`${r.vehicles?.make} ${r.vehicles?.model} (${r.vehicles?.registration}) — trebao biti vraćen ${r.end_date}`}
                      action="Kontaktiraj klijenta"
                    />
                  ))}
                  {expiringRegs?.slice(0, 3).map((v: any) => (
                    <AlertItem
                      key={v.id}
                      type="warning"
                      title="Registracija ističe uskoro"
                      message={`${v.make} ${v.model} (${v.registration}) — ističe ${v.registration_expiry}`}
                      action="Obnovi registraciju"
                      actionHref={`/dashboard/fleet/${v.id}?expense=registration`}
                    />
                  ))}
                </div>
              </div>
            )}

            {/* Airport arrivals */}
            <AirportArrivalsCard initialRentals={airportRentals} />

            {/* Fleet distribution */}
            <div className="bg-white border border-[#E7E7E7] rounded-xl shadow-sm p-5">
              <h2 className="text-base font-semibold text-[#003580] mb-4">Distribucija flote</h2>
              <div className="space-y-3">
                {[
                  { label: "U najmu",        count: rentedCount,  dot: "bg-[#003580]" },
                  { label: "Slobodna",       count: freeCount,    dot: "bg-emerald-500" },
                  { label: "Na servisu",     count: serviceCount, dot: "bg-amber-400" },
                  { label: "Pranje/Priprema",count: washCount,    dot: "bg-purple-400" },
                ].map(({ label, count, dot }) => (
                  <div key={label} className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className={`w-2.5 h-2.5 rounded-sm flex-shrink-0 ${dot}`} />
                      <span className="text-sm text-slate-600">{label}</span>
                    </div>
                    <span className="text-sm font-bold text-slate-900">{count}</span>
                  </div>
                ))}
                <div className="pt-2 mt-1 border-t border-slate-100 flex items-center justify-between">
                  <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Ukupno</span>
                  <span className="text-sm font-bold text-slate-900">{totalCount}</span>
                </div>
              </div>
            </div>

          </div>
        </div>
      </div>
    </div>
  );
}
