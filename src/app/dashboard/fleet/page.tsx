"use client";

import { useState, useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import clsx from "clsx";
import QuickAddRow from "@/components/expenses/QuickAddRow";
import GlobalExpenseModal from "@/components/expenses/GlobalExpenseModal";

const STATUS_LABELS: Record<string, string> = {
  free: "Slobodno",
  rented: "U najmu",
  service: "Na servisu",
  washing: "Pranje",
  inactive: "Neaktivno",
};

const STATUS_BADGE: Record<string, string> = {
  free: "bg-emerald-100 text-emerald-700",
  rented: "bg-blue-500 text-white",
  service: "bg-amber-400 text-amber-900",
  washing: "bg-purple-500 text-white",
  inactive: "bg-slate-400 text-white",
};

const STATUS_DOT: Record<string, string> = {
  free: "bg-emerald-500",
  rented: "bg-[#003580]",
  service: "bg-amber-400",
  washing: "bg-purple-400",
  inactive: "bg-slate-300",
};

interface Vehicle {
  id: string;
  make: string;
  model: string;
  year: number;
  registration: string;
  chassis_number?: string;
  color?: string;
  status: string;
  purchase_price?: number;
  daily_rate: number;
  registration_expiry?: string;
  current_km?: number;
  notes?: string;
}

const emptyVehicle: Partial<Vehicle> = {
  make: "",
  model: "",
  year: new Date().getFullYear(),
  registration: "",
  status: "free",
  daily_rate: 0,
  current_km: 0,
};

const FieldInput = ({
  label, type, placeholder, value, onChange,
}: {
  label: string; type: string; placeholder: string;
  value: string | number; onChange: (val: string | number) => void;
}) => (
  <div>
    <label className="block text-[11px] font-semibold text-slate-500 mb-1.5 uppercase tracking-wide">
      {label}
    </label>
    <input
      type={type}
      className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-slate-800 text-sm placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-[#003580]/20 focus:border-[#003580] transition-all"
      placeholder={placeholder}
      value={value ?? ""}
      onChange={(e) => onChange(type === "number" ? (e.target.value === "" ? 0 : parseFloat(e.target.value) || 0) : e.target.value)}
    />
  </div>
);

interface TimelineRental {
  id: string;
  vehicle_id: string;
  start_date: string;
  end_date: string;
  status: string;
  clients?: { full_name: string } | { full_name: string }[];
}

export default function FleetPage() {
  const router = useRouter();
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [timelineRentals, setTimelineRentals] = useState<TimelineRental[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingVehicle, setEditingVehicle] = useState<Partial<Vehicle>>(emptyVehicle);
  const [isEditing, setIsEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [filter, setFilter] = useState("all");
  const [search, setSearch] = useState("");
  const [updatingStatus, setUpdatingStatus] = useState<string | null>(null);
  const [timelineOffset, setTimelineOffset] = useState(0);
  const [showGlobalExpense, setShowGlobalExpense] = useState(false);
  const supabase = createClient();

  const today = useMemo(() => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d;
  }, []);

  const timelineStart = useMemo(() => {
    const d = new Date(today);
    d.setDate(today.getDate() + timelineOffset);
    return d;
  }, [today, timelineOffset]);

  const timelineDays = useMemo(() => Array.from({ length: 14 }, (_, i) => {
    const d = new Date(timelineStart);
    d.setDate(timelineStart.getDate() + i);
    return d;
  }), [timelineStart]);

  const load = async () => {
    setLoading(true);
    const { data: v } = await supabase.from("vehicles").select("*").order("make");
    setVehicles(v || []);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  useEffect(() => {
    const windowEnd = new Date(timelineStart);
    windowEnd.setDate(timelineStart.getDate() + 13);
    supabase.from("rentals")
      .select("id, vehicle_id, start_date, end_date, status, clients(full_name)")
      .lte("start_date", windowEnd.toISOString().slice(0, 10))
      .gte("end_date", timelineStart.toISOString().slice(0, 10))
      .in("status", ["active", "upcoming"])
      .then(({ data: r }) => setTimelineRentals(r || []));
  }, [timelineStart]);

  const openAdd = () => { setEditingVehicle({ ...emptyVehicle }); setIsEditing(false); setShowModal(true); };

  const save = async () => {
    setSaving(true);
    const clean = {
      ...editingVehicle,
      daily_rate: isFinite(Number(editingVehicle.daily_rate)) ? Number(editingVehicle.daily_rate) : 0,
      current_km: isFinite(Number(editingVehicle.current_km)) ? Number(editingVehicle.current_km) : 0,
      year: isFinite(Number(editingVehicle.year)) ? Number(editingVehicle.year) : new Date().getFullYear(),
      purchase_price: editingVehicle.purchase_price != null
        ? (isFinite(Number(editingVehicle.purchase_price)) ? Number(editingVehicle.purchase_price) : null)
        : null,
    };
    if (isEditing && clean.id) {
      await supabase.from("vehicles").update(clean).eq("id", clean.id);
    } else {
      const { id, ...newV } = clean as any;
      await supabase.from("vehicles").insert(newV);
    }
    setSaving(false);
    setShowModal(false);
    load();
  };

  const counts = useMemo(() => {
    const c: Record<string, number> = { free: 0, rented: 0, service: 0, washing: 0, inactive: 0 };
    vehicles.forEach((v) => { c[v.status] = (c[v.status] || 0) + 1; });
    return c;
  }, [vehicles]);

  const utilizationRate = vehicles.length > 0
    ? Math.round(((counts.rented || 0) / vehicles.length) * 100)
    : 0;

  const expiringSoon = vehicles.filter(
    (v) => v.registration_expiry &&
      new Date(v.registration_expiry) < new Date(Date.now() + 30 * 86400000)
  );

  const filtered = vehicles.filter((v) => {
    const matchFilter = filter === "all" || v.status === filter;
    const matchSearch =
      !search ||
      `${v.make} ${v.model} ${v.registration}`.toLowerCase().includes(search.toLowerCase());
    return matchFilter && matchSearch;
  });

  const setField = (key: string, val: string | number) =>
    setEditingVehicle((prev) => ({ ...prev, [key]: val }));

  const updateStatus = async (vehicleId: string, newStatus: string) => {
    setUpdatingStatus(vehicleId);
    await supabase.from("vehicles").update({ status: newStatus }).eq("id", vehicleId);
    setVehicles((prev) => prev.map((v) => v.id === vehicleId ? { ...v, status: newStatus } : v));
    setUpdatingStatus(null);
  };

  return (
    <div className="min-h-screen bg-[#F7F9FC]">
      <div className="p-6 max-w-[1440px] mx-auto space-y-6">

        {/* ── Page header ── */}
        <div className="flex items-end justify-between">
          <div>
            <h1 className="text-2xl font-bold text-[#003580] tracking-tight">Vozni park</h1>
            <p className="text-sm text-slate-500 mt-0.5">Praćenje inventara i dostupnosti vozila</p>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => setShowGlobalExpense(true)}
              className="flex items-center gap-2 px-4 py-2 border border-amber-400 text-amber-700 rounded-lg text-sm font-semibold bg-amber-50 hover:bg-amber-100 transition-colors shadow-sm"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="10"/>
                <line x1="2" y1="12" x2="22" y2="12"/>
                <path d="M12 2a15.3 15.3 0 014 10 15.3 15.3 0 01-4 10 15.3 15.3 0 01-4-10 15.3 15.3 0 014-10z"/>
              </svg>
              Globalni trošak
            </button>
            <button
              onClick={openAdd}
              className="flex items-center gap-2 px-4 py-2 bg-[#003580] text-white rounded-lg text-sm font-semibold hover:bg-[#002660] transition-colors shadow-sm"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <line x1="12" y1="5" x2="12" y2="19"/>
                <line x1="5" y1="12" x2="19" y2="12"/>
              </svg>
              Dodaj vozilo
            </button>
          </div>
        </div>

        {/* ── Stat cards ── */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          {[
            { label: "Ukupno vozila", value: vehicles.length, dot: "bg-[#003580]", val_color: "text-[#003580]" },
            { label: "Slobodna", value: counts.free || 0, dot: "bg-emerald-500", val_color: "text-emerald-600" },
            { label: "U najmu", value: counts.rented || 0, dot: "bg-blue-600", val_color: "text-blue-700" },
            { label: "Na servisu", value: (counts.service || 0) + (counts.washing || 0), dot: "bg-amber-400", val_color: "text-amber-600" },
          ].map((s) => (
            <div key={s.label} className="bg-white rounded-xl border border-[#E7E7E7] shadow-sm p-5">
              <div className="flex items-center gap-2 mb-3">
                <div className={clsx("w-2 h-2 rounded-full flex-shrink-0", s.dot)} />
                <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">{s.label}</span>
              </div>
              <span className={clsx("text-3xl font-bold leading-none", s.val_color)}>{s.value}</span>
            </div>
          ))}
        </div>

        {/* ── Fleet Timeline ── */}
        <div className="bg-white border border-[#E7E7E7] rounded-xl shadow-sm overflow-hidden">
          <div className="px-5 py-4 border-b border-[#E7E7E7] flex items-center justify-between">
            <div>
              <h2 className="text-base font-semibold text-slate-800">Raspored flote</h2>
              <p className="text-xs text-slate-400 mt-0.5">14-dnevni pregled dostupnosti</p>
            </div>
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-3 text-xs text-slate-500">
                {[
                  { color: "bg-[#003580]", label: "U najmu" },
                  { color: "bg-amber-400", label: "Servis/pranje" },
                ].map((l) => (
                  <div key={l.label} className="flex items-center gap-1.5">
                    <div className={clsx("w-2.5 h-2.5 rounded-sm", l.color)} />
                    {l.label}
                  </div>
                ))}
              </div>
              <div className="flex items-center gap-1">
                {timelineOffset !== 0 && (
                  <button
                    onClick={() => setTimelineOffset(0)}
                    className="px-2 py-1 text-xs font-semibold text-[#003580] hover:bg-blue-50 rounded-md transition-colors"
                  >
                    Danas
                  </button>
                )}
                <button
                  onClick={() => setTimelineOffset((o) => o - 7)}
                  className="p-1.5 hover:bg-slate-100 rounded-md transition-colors text-slate-500 hover:text-slate-800"
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="15 18 9 12 15 6"/>
                  </svg>
                </button>
                <span className="text-xs font-semibold text-slate-600 min-w-[150px] text-center">
                  {timelineStart.toLocaleDateString("hr-HR", { day: "numeric", month: "short" })}
                  {" – "}
                  {timelineDays[13].toLocaleDateString("hr-HR", { day: "numeric", month: "short", year: "numeric" })}
                </span>
                <button
                  onClick={() => setTimelineOffset((o) => o + 7)}
                  className="p-1.5 hover:bg-slate-100 rounded-md transition-colors text-slate-500 hover:text-slate-800"
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="9 18 15 12 9 6"/>
                  </svg>
                </button>
              </div>
            </div>
          </div>
          <div className="overflow-x-auto">
            <div className="min-w-[800px]">
              {/* Header row */}
              <div className="grid border-b border-[#E7E7E7]" style={{ gridTemplateColumns: "180px repeat(14, 1fr)" }}>
                <div className="px-4 py-2 text-[11px] font-semibold text-slate-400 uppercase tracking-wider">Vozilo</div>
                {timelineDays.map((d, i) => {
                  const isToday = d.toDateString() === new Date().toDateString();
                  return (
                    <div key={i} className={clsx(
                      "py-2 text-center text-[11px] font-semibold",
                      isToday ? "bg-[#003580]/5 text-[#003580]" : "text-slate-400"
                    )}>
                      <div>{["Ned", "Pon", "Uto", "Sri", "Čet", "Pet", "Sub"][d.getDay()]}</div>
                      <div className={clsx(
                        "text-[13px] font-bold",
                        isToday ? "text-[#003580]" : "text-slate-600"
                      )}>{d.getDate()}</div>
                    </div>
                  );
                })}
              </div>
              {/* Vehicle rows */}
              {vehicles.map((v) => {
                const vRentals = timelineRentals.filter((r) => r.vehicle_id === v.id);
                return (
                  <div
                    key={v.id}
                    className="grid border-b border-slate-50 hover:bg-slate-50/50 transition-colors"
                    style={{ gridTemplateColumns: "180px repeat(14, 1fr)" }}
                  >
                    <div
                      className="px-4 py-2.5 flex flex-col justify-center cursor-pointer"
                      onClick={() => router.push(`/dashboard/fleet/${v.id}`)}
                    >
                      <span className="text-xs font-semibold text-slate-800 truncate hover:text-[#003580] transition-colors">{v.make} {v.model}</span>
                      <span className="text-[10px] text-slate-400 font-mono">{v.registration}</span>
                    </div>
                    {timelineDays.map((day, i) => {
                      const dayStr = day.toISOString().slice(0, 10);
                      const isToday = day.toDateString() === new Date().toDateString();
                      const rental = vRentals.find((r) => r.start_date <= dayStr && r.end_date >= dayStr);
                      const isService = v.status === "service" || v.status === "washing";

                      let bg = "";
                      let tooltip = "";
                      if (rental) {
                        bg = "bg-[#003580]";
                        const clientName = Array.isArray(rental.clients) ? rental.clients[0]?.full_name : rental.clients?.full_name;
                        tooltip = clientName ?? "U najmu";
                      } else if (v.status === "rented") {
                        bg = "bg-[#003580]";
                        tooltip = "U najmu";
                      } else if (isService) {
                        bg = "bg-amber-400";
                        tooltip = v.status === "service" ? "Servis" : "Pranje";
                      } else if (v.status === "inactive") {
                        bg = "bg-slate-300";
                        tooltip = "Neaktivno";
                      }

                      return (
                        <div
                          key={i}
                          title={tooltip}
                          className={clsx(
                            "h-full min-h-[40px] relative",
                            isToday ? "bg-[#003580]/5" : ""
                          )}
                        >
                          {bg && (
                            <div className={clsx(
                              "absolute inset-y-1.5 inset-x-0.5 rounded-sm opacity-80",
                              bg
                            )} />
                          )}
                        </div>
                      );
                    })}
                  </div>
                );
              })}
              {vehicles.length === 0 && (
                <div className="py-8 text-center text-sm text-slate-400">Nema vozila</div>
              )}
            </div>
          </div>
        </div>

        {/* ── Main grid ── */}
        <div className="grid grid-cols-12 gap-6">

          {/* ── Inventory table (8 cols) ── */}
          <div className="col-span-12 lg:col-span-8 bg-white rounded-xl border border-[#E7E7E7] shadow-sm flex flex-col">
            {/* quick-add expense row */}
            <QuickAddRow vehicles={vehicles} />
            {/* table toolbar */}
            <div className="px-5 py-4 border-b border-[#E7E7E7] flex flex-wrap items-center justify-between gap-3">
              <h2 className="text-base font-semibold text-slate-800">Inventar vozila</h2>
              <div className="flex flex-wrap items-center gap-2">
                {/* search */}
                <div className="relative">
                  <svg className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 w-4 h-4 pointer-events-none" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
                  </svg>
                  <input
                    className="pl-9 pr-4 py-1.5 bg-slate-50 border border-slate-200 focus:border-[#003580] focus:bg-white rounded-lg text-sm outline-none transition-all w-52 placeholder:text-slate-400"
                    placeholder="Pretraži vozila..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                  />
                </div>
                {/* filter pills */}
                <div className="flex items-center gap-0.5 bg-slate-100 border border-slate-200 rounded-lg p-1">
                  {(["all", "free", "rented", "service", "washing", "inactive"] as const).map((s) => (
                    <button
                      key={s}
                      onClick={() => setFilter(s)}
                      className={clsx(
                        "px-2.5 py-1 rounded-md text-xs font-semibold transition-all whitespace-nowrap",
                        filter === s
                          ? "bg-[#003580] text-white shadow-sm"
                          : "text-slate-500 hover:text-slate-800"
                      )}
                    >
                      {s === "all" ? "Sva" : STATUS_LABELS[s]}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* table body */}
            <div className="overflow-x-auto flex-1">
              {loading ? (
                <div className="flex items-center justify-center py-16 text-slate-400 text-sm">Učitavanje...</div>
              ) : filtered.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 text-slate-400 gap-2">
                  <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="opacity-30">
                    <path d="M5 17H3a2 2 0 01-2-2V9a2 2 0 012-2h16a2 2 0 012 2v6a2 2 0 01-2 2h-2"/>
                    <rect x="7" y="14" width="10" height="5" rx="2"/>
                  </svg>
                  <p className="text-sm">Nema vozila</p>
                </div>
              ) : (
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-200">
                      {["Vozilo", "Registracija", "God.", "Km", "€/dan", "Reg. ističe", "Status", ""].map((h) => (
                        <th key={h} className="px-4 py-3 text-[11px] font-semibold text-slate-500 uppercase tracking-wider whitespace-nowrap">
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {filtered.map((v) => (
                      <tr key={v.id} className="hover:bg-slate-50 transition-colors">
                        <td className="px-4 py-3">
                          <div className="font-semibold text-slate-800 text-sm leading-tight">{v.make} {v.model}</div>
                          {v.color && <div className="text-xs text-slate-400 mt-0.5">{v.color}</div>}
                        </td>
                        <td className="px-4 py-3 text-sm font-mono font-semibold text-[#003580] whitespace-nowrap">{v.registration}</td>
                        <td className="px-4 py-3 text-sm text-slate-500">{v.year}</td>
                        <td className="px-4 py-3 text-sm text-slate-500 whitespace-nowrap">{v.current_km?.toLocaleString()} km</td>
                        <td className="px-4 py-3 text-sm font-semibold text-slate-700 whitespace-nowrap">
                          €{v.daily_rate}<span className="font-normal text-slate-400">/d</span>
                        </td>
                        <td className="px-4 py-3 text-xs whitespace-nowrap">
                          {v.registration_expiry ? (
                            <span className={clsx(
                              "font-medium",
                              new Date(v.registration_expiry) < new Date(Date.now() + 30 * 86400000)
                                ? "text-amber-600"
                                : "text-slate-400"
                            )}>
                              {v.registration_expiry}
                            </span>
                          ) : <span className="text-slate-300">—</span>}
                        </td>
                        <td className="px-4 py-3">
                          <select
                            value={v.status}
                            disabled={updatingStatus === v.id}
                            onChange={(e) => updateStatus(v.id, e.target.value)}
                            className={clsx(
                              "text-[10px] font-bold uppercase tracking-wide rounded-full px-2 py-0.5 border-0 outline-none cursor-pointer appearance-none text-center disabled:opacity-50",
                              STATUS_BADGE[v.status] ?? "bg-slate-100 text-slate-500"
                            )}
                          >
                            {Object.entries(STATUS_LABELS).map(([k, label]) => (
                              <option key={k} value={k}>{label}</option>
                            ))}
                          </select>
                        </td>
                        <td className="px-4 py-3 text-right">
                          <button
                            onClick={() => router.push(`/dashboard/fleet/${v.id}`)}
                            className="text-[#006CE4] text-xs font-semibold hover:underline whitespace-nowrap"
                          >
                            Detalji
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>

            {/* table footer */}
            <div className="px-5 py-3 bg-slate-50 border-t border-[#E7E7E7] rounded-b-xl">
              <span className="text-xs text-slate-500">
                Prikazano {filtered.length} od {vehicles.length} vozila
              </span>
            </div>
          </div>

          {/* ── Right stats panel (4 cols) ── */}
          <div className="col-span-12 lg:col-span-4 space-y-4">

            {/* Utilization rate */}
            <div className="bg-white rounded-xl border border-[#E7E7E7] shadow-sm p-5">
              <h3 className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider mb-4">
                Stopa iskorištenosti
              </h3>
              <div className="flex items-end gap-4 mb-3">
                <span className="text-4xl font-bold text-[#003580] leading-none">{utilizationRate}%</span>
                <span className="text-emerald-600 text-xs font-semibold mb-1 flex items-center gap-0.5">
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="23 6 13.5 15.5 8.5 10.5 1 18"/>
                    <polyline points="17 6 23 6 23 12"/>
                  </svg>
                  {counts.rented || 0} u najmu
                </span>
              </div>
              <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
                <div
                  className="h-full bg-[#003580] rounded-full transition-all duration-700"
                  style={{ width: `${utilizationRate}%` }}
                />
              </div>
              <p className="text-[11px] text-slate-400 mt-3 italic">
                {counts.free || 0} vozila trenutno slobodna.
              </p>
            </div>

            {/* Fleet status breakdown */}
            <div className="bg-white rounded-xl border border-[#E7E7E7] shadow-sm p-5">
              <h3 className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider mb-4">
                Status flote
              </h3>
              <div className="space-y-3">
                {(["free", "rented", "service", "washing", "inactive"] as const).map((key) => (
                  <div key={key} className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className={clsx("w-2 h-2 rounded-full flex-shrink-0", STATUS_DOT[key])} />
                      <span className="text-sm text-slate-600">{STATUS_LABELS[key]}</span>
                    </div>
                    <span className="text-sm font-bold text-slate-800">{counts[key] || 0}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Registration expiry alert */}
            {expiringSoon.length > 0 && (
              <div className="bg-amber-50 rounded-xl border border-amber-200 p-5 flex gap-3">
                <div className="flex-shrink-0 w-9 h-9 rounded-full bg-amber-100 flex items-center justify-center text-amber-600">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/>
                    <line x1="12" y1="9" x2="12" y2="13"/>
                    <line x1="12" y1="17" x2="12.01" y2="17"/>
                  </svg>
                </div>
                <div className="min-w-0">
                  <h4 className="text-sm font-semibold text-amber-800">Registracija ističe uskoro</h4>
                  <p className="text-xs text-amber-700 leading-relaxed mt-1">
                    {expiringSoon.length} {expiringSoon.length === 1 ? "vozilo ima" : "vozila imaju"} registraciju koja ističe u sljedećih 30 dana.
                  </p>
                  <div className="mt-2 space-y-1">
                    {expiringSoon.slice(0, 3).map((v) => (
                      <div key={v.id} className="text-xs text-amber-800 font-medium truncate">
                        {v.make} {v.model} — <span className="font-normal">{v.registration_expiry}</span>
                      </div>
                    ))}
                    {expiringSoon.length > 3 && (
                      <p className="text-xs text-amber-600">+{expiringSoon.length - 3} još...</p>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── Add / Edit modal ── */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm animate-fade-in">
          <div className="bg-white rounded-2xl border border-[#E7E7E7] shadow-2xl w-full max-w-2xl p-6 animate-slide-up max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-lg font-bold text-slate-800">
                {isEditing ? "Uredi vozilo" : "Novo vozilo"}
              </h2>
              <button
                onClick={() => setShowModal(false)}
                className="text-slate-400 hover:text-slate-600 transition-colors p-1 rounded-lg hover:bg-slate-100"
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="18" y1="6" x2="6" y2="18"/>
                  <line x1="6" y1="6" x2="18" y2="18"/>
                </svg>
              </button>
            </div>

            <div className="grid grid-cols-2 gap-4">
              {[
                { label: "Marka", key: "make", type: "text", placeholder: "npr. Volkswagen" },
                { label: "Model", key: "model", type: "text", placeholder: "npr. Golf" },
                { label: "Godište", key: "year", type: "number", placeholder: "2022" },
                { label: "Registracija", key: "registration", type: "text", placeholder: "A12-K-345" },
                { label: "Broj šasije", key: "chassis_number", type: "text", placeholder: "VIN..." },
                { label: "Boja", key: "color", type: "text", placeholder: "Bijela" },
                { label: "Dnevna tarifa (€)", key: "daily_rate", type: "number", placeholder: "50" },
                { label: "Trenutna km", key: "current_km", type: "number", placeholder: "0" },
                { label: "Nabavna cijena (€)", key: "purchase_price", type: "number", placeholder: "25000" },
                { label: "Registracija ističe", key: "registration_expiry", type: "date", placeholder: "" },
              ].map((f) => (
                <FieldInput
                  key={f.key}
                  label={f.label}
                  type={f.type}
                  placeholder={f.placeholder}
                  value={(editingVehicle as any)[f.key] ?? ""}
                  onChange={(val) => setField(f.key, val)}
                />
              ))}

              <div>
                <label className="block text-[11px] font-semibold text-slate-500 mb-1.5 uppercase tracking-wide">
                  Status
                </label>
                <select
                  className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-slate-800 text-sm focus:outline-none focus:ring-2 focus:ring-[#003580]/20 focus:border-[#003580] transition-all"
                  value={editingVehicle.status ?? "free"}
                  onChange={(e) => setField("status", e.target.value)}
                >
                  {Object.entries(STATUS_LABELS).map(([k, v]) => (
                    <option key={k} value={k}>{v}</option>
                  ))}
                </select>
              </div>
            </div>

            <div className="mt-4">
              <label className="block text-[11px] font-semibold text-slate-500 mb-1.5 uppercase tracking-wide">
                Napomene
              </label>
              <textarea
                className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-slate-800 text-sm placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-[#003580]/20 focus:border-[#003580] transition-all min-h-[80px] resize-none"
                placeholder="Dodatne napomene..."
                value={editingVehicle.notes ?? ""}
                onChange={(e) => setField("notes", e.target.value)}
              />
            </div>

            <div className="flex gap-3 justify-end mt-6 pt-4 border-t border-slate-100">
              <button
                onClick={() => setShowModal(false)}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold rounded-lg text-sm transition-colors"
              >
                Odustani
              </button>
              <button
                onClick={save}
                disabled={saving}
                className="px-4 py-2 bg-[#003580] hover:bg-[#002660] text-white font-semibold rounded-lg text-sm transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {saving ? "Čuvanje..." : isEditing ? "Spremi promjene" : "Dodaj vozilo"}
              </button>
            </div>
          </div>
        </div>
      )}

      <GlobalExpenseModal
        isOpen={showGlobalExpense}
        onClose={() => setShowGlobalExpense(false)}
        onSaved={load}
      />
    </div>
  );
}
