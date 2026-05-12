"use client";

import { useState, useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import clsx from "clsx";
import {
  BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from "recharts";

// ── Types ──────────────────────────────────────────────────────
type Period = "this_month" | "last_month" | "3m" | "ytd" | "all";
type CategoryFilter = "all" | "fuel" | "maintenance" | "insurance" | "washing" | "tyre" | "other";

interface Vehicle {
  id: string; make: string; model: string; registration: string;
  status: string; daily_rate: number;
  purchase_price?: number; current_km?: number; registration_expiry?: string;
}
interface Rental {
  id: string; vehicle_id: string; start_date: string; end_date: string;
  total_amount: number; status: string;
}
interface Expense {
  id: string; vehicle_id: string; date: string; type: string; amount: number;
}

// ── Constants ──────────────────────────────────────────────────
const PERIOD_LABELS: Record<Period, string> = {
  this_month: "Ovaj mj.", last_month: "Prošli mj.", "3m": "3 mj.", ytd: "Ova god.", all: "Sve",
};
const CATEGORY_LABELS: Record<string, string> = {
  fuel: "Gorivo", maintenance: "Servis", insurance: "Osiguranje",
  washing: "Pranje", tyre: "Gume", other: "Ostalo",
};
const CATEGORY_COLORS: Record<string, string> = {
  fuel: "#f97316", maintenance: "#3b82f6", insurance: "#8b5cf6",
  washing: "#06b6d4", tyre: "#64748b", other: "#94a3b8",
};
const DOW_LABELS = ["Pon", "Uto", "Sri", "Čet", "Pet", "Sub", "Ned"];

// ── Utilities ──────────────────────────────────────────────────
function periodRange(p: Period): { from: string; to: string } {
  const now = new Date();
  const today = now.toISOString().slice(0, 10);
  if (p === "this_month") return { from: new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10), to: today };
  if (p === "last_month") return { from: new Date(now.getFullYear(), now.getMonth() - 1, 1).toISOString().slice(0, 10), to: new Date(now.getFullYear(), now.getMonth(), 0).toISOString().slice(0, 10) };
  if (p === "3m") return { from: new Date(now.getFullYear(), now.getMonth() - 2, 1).toISOString().slice(0, 10), to: today };
  if (p === "ytd") return { from: `${now.getFullYear()}-01-01`, to: today };
  return { from: "1900-01-01", to: today };
}

function prevPeriodRange(p: Period): { from: string; to: string } | null {
  const now = new Date();
  if (p === "this_month") return { from: new Date(now.getFullYear(), now.getMonth() - 1, 1).toISOString().slice(0, 10), to: new Date(now.getFullYear(), now.getMonth(), 0).toISOString().slice(0, 10) };
  if (p === "last_month") return { from: new Date(now.getFullYear(), now.getMonth() - 2, 1).toISOString().slice(0, 10), to: new Date(now.getFullYear(), now.getMonth() - 1, 0).toISOString().slice(0, 10) };
  if (p === "3m") return { from: new Date(now.getFullYear(), now.getMonth() - 5, 1).toISOString().slice(0, 10), to: new Date(now.getFullYear(), now.getMonth() - 3, 0).toISOString().slice(0, 10) };
  if (p === "ytd") return { from: `${now.getFullYear() - 1}-01-01`, to: `${now.getFullYear() - 1}-12-31` };
  return null;
}

const fmt = (n: number) => `€${Math.round(n).toLocaleString("de-DE")}`;
const fmtFull = (n: number) => `€${n.toLocaleString("de-DE", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const pct = (n: number) => `${n.toFixed(1)}%`;

// ── Sparkline ──────────────────────────────────────────────────
function Sparkline({ data, positive = true }: { data: number[]; positive?: boolean }) {
  if (data.length < 2) return <div className="w-16 h-5" />;
  const max = Math.max(...data, 1);
  const min = Math.min(...data);
  const range = max - min || 1;
  const w = 64; const h = 20;
  const pts = data.map((v, i) => {
    const x = (i / (data.length - 1)) * w;
    const y = h - ((v - min) / range) * (h - 4) - 2;
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  }).join(" ");
  const color = positive ? "#10b981" : "#ef4444";
  return (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} className="overflow-visible">
      <polyline points={pts} fill="none" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

// ── Trend arrow ────────────────────────────────────────────────
function TrendBadge({ current, prev }: { current: number; prev: number }) {
  if (prev === 0) return null;
  const delta = ((current - prev) / Math.abs(prev)) * 100;
  const up = delta >= 0;
  return (
    <span className={clsx("inline-flex items-center gap-0.5 text-[11px] font-bold px-1.5 py-0.5 rounded", up ? "bg-emerald-100 text-emerald-700" : "bg-red-100 text-red-600")}>
      {up ? "▲" : "▼"} {Math.abs(delta).toFixed(0)}%
    </span>
  );
}

// ── Traffic-light indicator dot ────────────────────────────────
function HealthDot({ level }: { level: "green" | "amber" | "red" }) {
  return (
    <span className={clsx("inline-block w-2.5 h-2.5 rounded-full flex-shrink-0", {
      "bg-emerald-500": level === "green",
      "bg-amber-400": level === "amber",
      "bg-red-500": level === "red",
    })} />
  );
}

// ── Page ───────────────────────────────────────────────────────
export default function AnalyticsPage() {
  const router = useRouter();
  const supabase = createClient();

  const [role, setRole] = useState<"admin" | "agent" | null>(null);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [rentals, setRentals] = useState<Rental[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [prevRentals, setPrevRentals] = useState<Rental[]>([]);
  const [allTimeRentals, setAllTimeRentals] = useState<Rental[]>([]);
  const [alerts, setAlerts] = useState<{ id: string; text: string; type: "overdue" | "registration" }[]>([]);
  const [loading, setLoading] = useState(true);

  const [period, setPeriod] = useState<Period>("this_month");
  const [category, setCategory] = useState<CategoryFilter>("all");
  const [vehicleId, setVehicleId] = useState<string>("all");
  const [sortBy, setSortBy] = useState<"profit" | "revenue" | "costs">("profit");
  const [drillCategory, setDrillCategory] = useState<string | null>(null);
  const [showCosts, setShowCosts] = useState(false);
  const [yearlyExpenses, setYearlyExpenses] = useState<Expense[]>([]);

  // Auth gate
  useEffect(() => {
    const check = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { router.push("/login"); return; }
      const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).single();
      const r = (profile?.role as "admin" | "agent") || "agent";
      setRole(r);
      if (r !== "admin") router.push("/dashboard");
    };
    check();
  }, []);

  // Load data
  useEffect(() => {
    if (role !== "admin") return;
    const load = async () => {
      setLoading(true);
      const { from, to } = periodRange(period);
      const today = new Date().toISOString().slice(0, 10);
      const in30 = new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10);
      const prev = prevPeriodRange(period);

      const yearStart = `${new Date().getFullYear()}-01-01`;
      const [vRes, rRes, eRes, prevRes, allRes, yearExpRes] = await Promise.all([
        supabase.from("vehicles").select("id, make, model, registration, status, daily_rate, purchase_price, current_km, registration_expiry"),
        supabase.from("rentals").select("id, vehicle_id, start_date, end_date, total_amount, status").gte("start_date", from).lte("start_date", to).neq("status", "cancelled"),
        supabase.from("vehicle_expenses").select("id, vehicle_id, date, type, amount").gte("date", from).lte("date", to),
        prev
          ? supabase.from("rentals").select("id, vehicle_id, start_date, end_date, total_amount, status").gte("start_date", prev.from).lte("start_date", prev.to).neq("status", "cancelled")
          : Promise.resolve({ data: [] }),
        supabase.from("rentals").select("id, vehicle_id, start_date, total_amount, status").neq("status", "cancelled"),
        supabase.from("vehicle_expenses").select("id, vehicle_id, date, type, amount").gte("date", yearStart),
      ]);

      const vs = vRes.data || [];
      setVehicles(vs);
      setRentals(rRes.data || []);
      setExpenses(eRes.data || []);
      setPrevRentals((prevRes as any).data || []);
      setAllTimeRentals(allRes.data || []);
      setYearlyExpenses((yearExpRes as any).data || []);

      // Build alerts
      const overdue = (rRes.data || []).filter((r: Rental) => r.status === "active" && r.end_date < today);
      const expiring = vs.filter((v: Vehicle) => v.registration_expiry && v.registration_expiry >= today && v.registration_expiry <= in30);
      setAlerts([
        ...overdue.map((r: Rental) => {
          const v = vs.find((x: Vehicle) => x.id === r.vehicle_id);
          return { id: r.id, text: `${v?.make} ${v?.model} (${v?.registration}) — rok istekao ${r.end_date}`, type: "overdue" as const };
        }),
        ...expiring.map((v: Vehicle) => ({
          id: v.id, text: `${v.make} ${v.model} (${v.registration}) — reg. ističe ${v.registration_expiry}`, type: "registration" as const,
        })),
      ]);
      setLoading(false);
    };
    load();
  }, [period, role]);

  // ── Computed ──────────────────────────────────────────────────
  const filteredExpenses = useMemo(() =>
    expenses.filter(e =>
      (category === "all" || e.type === category) &&
      (vehicleId === "all" || e.vehicle_id === vehicleId) &&
      (!drillCategory || e.type === drillCategory)
    ), [expenses, category, vehicleId, drillCategory]);

  const filteredRentals = useMemo(() =>
    rentals.filter(r => vehicleId === "all" || r.vehicle_id === vehicleId),
    [rentals, vehicleId]);

  const totalRevenue = filteredRentals.reduce((s, r) => s + Number(r.total_amount || 0), 0);
  const totalCosts = filteredExpenses.reduce((s, e) => s + Number(e.amount || 0), 0);
  const netProfit = totalRevenue - totalCosts;
  const profitMargin = totalRevenue > 0 ? (netProfit / totalRevenue) * 100 : 0;
  const prevRevenue = prevRentals.reduce((s, r) => s + Number(r.total_amount || 0), 0);

  const utilization = useMemo(() => {
    const active = vehicles.filter(v => v.status !== "inactive");
    if (!active.length) return 0;
    return Math.round((active.filter(v => v.status === "rented").length / active.length) * 100);
  }, [vehicles]);

  const utilizationHealth = utilization >= 70 ? "green" : utilization >= 40 ? "amber" : "red";
  const profitHealth = profitMargin >= 25 ? "green" : profitMargin >= 0 ? "amber" : "red";
  const alertHealth = alerts.length === 0 ? "green" : alerts.length <= 2 ? "amber" : "red";

  const monthlySeries = useMemo(() => {
    const map: Record<string, { month: string; revenue: number; costs: number }> = {};
    filteredRentals.forEach(r => {
      const k = r.start_date.slice(0, 7);
      if (!map[k]) map[k] = { month: k, revenue: 0, costs: 0 };
      map[k].revenue += Number(r.total_amount || 0);
    });
    filteredExpenses.forEach(e => {
      const k = e.date.slice(0, 7);
      if (!map[k]) map[k] = { month: k, revenue: 0, costs: 0 };
      map[k].costs += Number(e.amount || 0);
    });
    return Object.values(map).sort((a, b) => a.month.localeCompare(b.month)).map(row => ({
      ...row, profit: row.revenue - row.costs,
      label: new Date(row.month + "-01").toLocaleDateString("hr-HR", { month: "short", year: "2-digit" }),
    }));
  }, [filteredRentals, filteredExpenses]);

  const sparkData = monthlySeries.slice(-8).map(m => m.revenue);

  const dowData = useMemo(() => {
    const counts = [0, 0, 0, 0, 0, 0, 0];
    filteredRentals.forEach(r => { const d = new Date(r.start_date); counts[(d.getDay() + 6) % 7]++; });
    const max = Math.max(...counts, 1);
    return DOW_LABELS.map((name, i) => ({ name, count: counts[i], fill: counts[i] / max > 0.7 ? "#003580" : counts[i] / max > 0.4 ? "#60a5fa" : "#bfdbfe" }));
  }, [filteredRentals]);

  const categoryBreakdown = useMemo(() => {
    const base = expenses.filter(e => vehicleId === "all" || e.vehicle_id === vehicleId);
    const sums: Record<string, number> = {};
    base.forEach(e => { sums[e.type] = (sums[e.type] || 0) + Number(e.amount || 0); });
    return Object.entries(sums).map(([type, value]) => ({
      name: CATEGORY_LABELS[type] || type, type, value: Number(value.toFixed(2)),
    })).sort((a, b) => b.value - a.value);
  }, [expenses, vehicleId]);

  const vehicleStats = useMemo(() => {
    return vehicles.map(v => {
      const vRentals = rentals.filter(r => r.vehicle_id === v.id);
      const vAllRentals = allTimeRentals.filter(r => r.vehicle_id === v.id);
      const vExpenses = expenses.filter(e => (category === "all" || e.type === category) && e.vehicle_id === v.id);
      const revenue = vRentals.reduce((s, r) => s + Number(r.total_amount || 0), 0);
      const costs = vExpenses.reduce((s, e) => s + Number(e.amount || 0), 0);
      const profit = revenue - costs;
      const margin = revenue > 0 ? (profit / revenue) * 100 : 0;
      const lifetimeRevenue = vAllRentals.reduce((s, r) => s + Number(r.total_amount || 0), 0);
      const breakeven = v.purchase_price && v.purchase_price > 0 ? Math.min(100, (lifetimeRevenue / v.purchase_price) * 100) : null;
      const costPerKm = v.current_km && v.current_km > 0 ? costs / v.current_km : null;
      return {
        id: v.id, name: `${v.make} ${v.model}`, registration: v.registration, status: v.status,
        revenue, costs, profit, margin, rentalCount: vRentals.length,
        breakeven, costPerKm, lifetimeRevenue, purchasePrice: v.purchase_price,
      };
    }).sort((a, b) => b[sortBy] - a[sortBy]);
  }, [vehicles, rentals, allTimeRentals, expenses, category, sortBy]);

  const costPerKmData = useMemo(() =>
    vehicleStats.filter(v => v.costPerKm !== null && v.costPerKm! > 0)
      .sort((a, b) => (b.costPerKm || 0) - (a.costPerKm || 0))
      .map(v => ({ name: v.registration, value: Number((v.costPerKm || 0).toFixed(3)) })),
    [vehicleStats]);

  const yearlyMonthlyData = useMemo(() => {
    const year = new Date().getFullYear();
    const labels = ["Jan", "Feb", "Mar", "Apr", "Maj", "Jun", "Jul", "Aug", "Sep", "Okt", "Nov", "Dec"];
    return labels.map((label, i) => {
      const key = `${year}-${String(i + 1).padStart(2, "0")}`;
      const revenue = allTimeRentals
        .filter(r => r.start_date?.startsWith(key))
        .reduce((s, r) => s + Number(r.total_amount || 0), 0);
      const costs = yearlyExpenses
        .filter(e => e.date.startsWith(key))
        .reduce((s, e) => s + Number(e.amount || 0), 0);
      return { label, revenue, costs };
    });
  }, [allTimeRentals, yearlyExpenses]);

  if (role !== "admin") {
    return <div className="min-h-screen flex items-center justify-center bg-[#F7F9FC]"><p className="text-slate-400 text-sm">Učitavanje...</p></div>;
  }

  return (
    <div className="min-h-screen bg-[#F7F9FC]">
      <div className="p-4 sm:p-6 max-w-[1440px] mx-auto space-y-5">

        {/* ── Header + period pills ── */}
        <div className="flex flex-col sm:flex-row sm:items-center gap-3 sm:justify-between">
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-bold text-[#003580] tracking-tight">Analitika</h1>
              <span className="text-[10px] font-bold bg-[#003580]/10 text-[#003580] px-2 py-0.5 rounded uppercase tracking-wide">CEO View</span>
            </div>
            <p className="text-sm text-slate-500 mt-0.5">Prihod · Troškovi · Profit · Upozorenja</p>
          </div>
          <div className="flex items-center gap-1 bg-white border border-[#E7E7E7] rounded-lg p-1 shadow-sm self-start sm:self-auto flex-wrap">
            {(Object.keys(PERIOD_LABELS) as Period[]).map(p => (
              <button key={p} onClick={() => setPeriod(p)} className={clsx("px-3 py-1.5 rounded-md text-xs font-semibold transition-all whitespace-nowrap", period === p ? "bg-[#003580] text-white shadow-sm" : "text-slate-500 hover:text-slate-800 hover:bg-slate-50")}>
                {PERIOD_LABELS[p]}
              </button>
            ))}
          </div>
        </div>

        {/* ── Alert banner ── */}
        {alerts.length > 0 && (
          <div className="bg-red-50 border border-red-200 rounded-xl p-4">
            <div className="flex items-center gap-2 mb-2">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#ef4444" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
              <span className="text-sm font-bold text-red-700">{alerts.length} aktivnih upozorenja</span>
            </div>
            <div className="space-y-1">
              {alerts.map(a => (
                <div key={a.id} className="flex items-center gap-2 text-xs text-red-600">
                  <span className={clsx("w-1.5 h-1.5 rounded-full flex-shrink-0", a.type === "overdue" ? "bg-red-500" : "bg-amber-500")} />
                  {a.text}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── KPI row 1: Fleet health ── */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">

          {/* Utilization */}
          <div className="bg-white border border-[#E7E7E7] rounded-xl shadow-sm p-4 col-span-1">
            <div className="flex items-center gap-1.5 mb-2">
              <HealthDot level={utilizationHealth} />
              <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Iskorištenost</span>
            </div>
            <div className={clsx("text-2xl font-black leading-none", { "text-emerald-600": utilizationHealth === "green", "text-amber-600": utilizationHealth === "amber", "text-red-600": utilizationHealth === "red" })}>
              {utilization}%
            </div>
            <div className="w-full bg-slate-100 h-1.5 rounded-full mt-2.5 overflow-hidden">
              <div className={clsx("h-full rounded-full transition-all", { "bg-emerald-500": utilizationHealth === "green", "bg-amber-400": utilizationHealth === "amber", "bg-red-500": utilizationHealth === "red" })} style={{ width: `${utilization}%` }} />
            </div>
            <p className="text-[10px] text-slate-400 mt-1.5">{vehicles.filter(v => v.status === "rented").length} / {vehicles.filter(v => v.status !== "inactive").length} vozila</p>
          </div>

          {/* Active rentals */}
          <div className="bg-white border border-[#E7E7E7] rounded-xl shadow-sm p-4">
            <div className="flex items-center gap-1.5 mb-2">
              <HealthDot level="green" />
              <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Aktivni najam</span>
            </div>
            <div className="text-2xl font-black text-[#003580] leading-none">{filteredRentals.length}</div>
            <p className="text-[10px] text-slate-400 mt-2">u odabranom periodu</p>
          </div>

          {/* Revenue */}
          <div className="bg-white border border-[#E7E7E7] rounded-xl shadow-sm p-4">
            <div className="flex items-center gap-1.5 mb-2">
              <HealthDot level="green" />
              <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Prihod</span>
            </div>
            <div className="text-xl font-black text-emerald-600 leading-none tabular-nums">{fmt(totalRevenue)}</div>
            <div className="flex items-center gap-2 mt-2">
              <Sparkline data={sparkData} positive />
              {prevRevenue > 0 && <TrendBadge current={totalRevenue} prev={prevRevenue} />}
            </div>
          </div>

          {/* Costs */}
          <div className="bg-white border border-[#E7E7E7] rounded-xl shadow-sm p-4">
            <div className="flex items-center gap-1.5 mb-2">
              <HealthDot level="amber" />
              <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Troškovi</span>
            </div>
            <div className="text-xl font-black text-red-500 leading-none tabular-nums">{fmt(totalCosts)}</div>
            <p className="text-[10px] text-slate-400 mt-2">{filteredExpenses.length} stavki</p>
          </div>

          {/* Net Profit */}
          <div className={clsx("border rounded-xl shadow-sm p-4", netProfit >= 0 ? "bg-[#003580] border-[#002660]" : "bg-red-600 border-red-700")}>
            <div className="flex items-center gap-1.5 mb-2">
              <span className="w-2.5 h-2.5 rounded-full bg-white/40 flex-shrink-0" />
              <span className="text-[10px] font-bold text-white/80 uppercase tracking-wider">Neto profit</span>
            </div>
            <div className="text-xl font-black text-white leading-none tabular-nums">{fmt(netProfit)}</div>
            <p className={clsx("text-[10px] mt-2 font-bold", netProfit >= 0 ? "text-white/70" : "text-white/70")}>{pct(Math.abs(profitMargin))} marža</p>
          </div>

          {/* Alerts */}
          <div className={clsx("border rounded-xl shadow-sm p-4", alertHealth === "green" ? "bg-white border-[#E7E7E7]" : alertHealth === "amber" ? "bg-amber-50 border-amber-200" : "bg-red-50 border-red-200")}>
            <div className="flex items-center gap-1.5 mb-2">
              <HealthDot level={alertHealth} />
              <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Upozorenja</span>
            </div>
            <div className={clsx("text-2xl font-black leading-none", alertHealth === "green" ? "text-emerald-600" : alertHealth === "amber" ? "text-amber-600" : "text-red-600")}>
              {alerts.length}
            </div>
            <p className="text-[10px] text-slate-400 mt-2">{alerts.length === 0 ? "Sve u redu" : "Zahtijeva pažnju"}</p>
          </div>
        </div>

        {/* ── Filters ── */}
        <div className="flex flex-wrap items-center gap-3 bg-white border border-[#E7E7E7] rounded-xl shadow-sm px-4 py-3 text-sm">
          <div className="flex items-center gap-2">
            <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">Trošak:</span>
            <select value={category} onChange={e => setCategory(e.target.value as CategoryFilter)} className="bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-[#003580]/20 focus:border-[#003580]">
              <option value="all">Sve kategorije</option>
              {Object.entries(CATEGORY_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">Vozilo:</span>
            <select value={vehicleId} onChange={e => setVehicleId(e.target.value)} className="bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-[#003580]/20 focus:border-[#003580]">
              <option value="all">Sva vozila</option>
              {vehicles.map(v => <option key={v.id} value={v.id}>{v.make} {v.model} ({v.registration})</option>)}
            </select>
          </div>
          {drillCategory && (
            <button onClick={() => setDrillCategory(null)} className="ml-auto text-xs font-semibold text-[#003580] hover:underline">
              ✕ Ukloni drill-down: {CATEGORY_LABELS[drillCategory]}
            </button>
          )}
          {(category !== "all" || vehicleId !== "all") && !drillCategory && (
            <button onClick={() => { setCategory("all"); setVehicleId("all"); }} className="ml-auto text-xs font-semibold text-slate-400 hover:text-[#003580]">
              ✕ Resetuj filtere
            </button>
          )}
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-20 text-slate-400 text-sm">Učitavanje podataka...</div>
        ) : (
          <>
            {/* ── Monthly Revenue bar chart (Riderly-style) ── */}
            <div className="bg-white border border-[#E7E7E7] rounded-xl shadow-sm p-5">
              <div className="flex items-start sm:items-center justify-between gap-3 mb-5">
                <div>
                  <h2 className="text-base font-semibold text-slate-800">Miesečni prihod {new Date().getFullYear()}</h2>
                  <p className="text-xs text-slate-400 mt-0.5">Prihod po miesecu — uključite toggle za usporedbu s troškovima</p>
                </div>
                <div className="flex items-center gap-2.5 flex-shrink-0">
                  <span className="text-xs text-slate-500 whitespace-nowrap">Prikaži troškove:</span>
                  <button
                    onClick={() => setShowCosts(v => !v)}
                    className={clsx(
                      "relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none",
                      showCosts ? "bg-[#003580]" : "bg-slate-200"
                    )}
                  >
                    <span className={clsx(
                      "inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform",
                      showCosts ? "translate-x-6" : "translate-x-1"
                    )} />
                  </button>
                </div>
              </div>
              <div className="h-64 sm:h-72">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={yearlyMonthlyData} barGap={3} barCategoryGap={showCosts ? "25%" : "35%"}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f0f4f8" vertical={false} />
                    <XAxis dataKey="label" tick={{ fontSize: 12, fill: "#94a3b8" }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fontSize: 11, fill: "#94a3b8" }} tickFormatter={v => v >= 1000 ? `€${(v / 1000).toFixed(0)}k` : `€${v}`} axisLine={false} tickLine={false} />
                    <Tooltip
                      formatter={(v: number, name: string) => [fmtFull(v), name === "revenue" ? "Prihod" : "Troškovi"]}
                      contentStyle={{ borderRadius: 8, border: "1px solid #E7E7E7", fontSize: 12, boxShadow: "0 4px 12px rgba(0,0,0,0.08)" }}
                      cursor={{ fill: "#f8fafc" }}
                    />
                    <Bar dataKey="revenue" name="revenue" fill="#003580" radius={[3, 3, 0, 0]} />
                    {showCosts && (
                      <Bar dataKey="costs" name="costs" fill="#ef4444" radius={[3, 3, 0, 0]} opacity={0.85} />
                    )}
                  </BarChart>
                </ResponsiveContainer>
              </div>
              <div className="flex items-center gap-5 mt-3 text-[11px] text-slate-500">
                <span className="flex items-center gap-1.5">
                  <span className="w-3 h-3 rounded-sm bg-[#003580]" />
                  Prihod
                </span>
                {showCosts && (
                  <span className="flex items-center gap-1.5">
                    <span className="w-3 h-3 rounded-sm bg-red-500" />
                    Troškovi
                  </span>
                )}
              </div>
            </div>

            {/* ── Day-of-week + Cost breakdown ── */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">

              {/* Day-of-week utilization */}
              <div className="bg-white border border-[#E7E7E7] rounded-xl shadow-sm p-5">
                <div className="mb-4">
                  <h2 className="text-base font-semibold text-slate-800">Zauzeto po danu u tjednu</h2>
                  <p className="text-xs text-slate-400 mt-0.5">Broj rezervacija po danu — identificira "mrtve zone"</p>
                </div>
                {filteredRentals.length === 0 ? (
                  <div className="py-12 text-center text-sm text-slate-400">Nema podataka</div>
                ) : (
                  <div className="h-52">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={dowData} barSize={28}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#E7E7E7" vertical={false} />
                        <XAxis dataKey="name" tick={{ fontSize: 12, fill: "#475569", fontWeight: 600 }} />
                        <YAxis tick={{ fontSize: 11, fill: "#94a3b8" }} allowDecimals={false} />
                        <Tooltip contentStyle={{ borderRadius: 8, border: "1px solid #E7E7E7", fontSize: 12 }} formatter={(v: number) => [`${v} rezervacija`, "Broj"]} />
                        <Bar dataKey="count" radius={[4, 4, 0, 0]}>
                          {dowData.map((entry, i) => <Cell key={i} fill={entry.fill} />)}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                )}
                <div className="flex items-center gap-4 mt-3 text-[11px] text-slate-500">
                  <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-sm bg-[#003580]" /> Visoka popunjenost</span>
                  <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-sm bg-[#60a5fa]" /> Srednja</span>
                  <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-sm bg-[#bfdbfe]" /> Niska</span>
                </div>
              </div>

              {/* Cost breakdown pie */}
              <div className="bg-white border border-[#E7E7E7] rounded-xl shadow-sm p-5">
                <div className="mb-4">
                  <h2 className="text-base font-semibold text-slate-800">Struktura troškova</h2>
                  <p className="text-xs text-slate-400 mt-0.5">Klikni kategoriju za drill-down</p>
                </div>
                {categoryBreakdown.length === 0 ? (
                  <div className="py-12 text-center text-sm text-slate-400">Nema troškova</div>
                ) : (
                  <div className="grid grid-cols-2 gap-4 items-center">
                    <div className="h-52">
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                          <Pie
                            data={categoryBreakdown} dataKey="value" nameKey="name"
                            cx="50%" cy="50%" innerRadius={44} outerRadius={80} paddingAngle={2}
                            onClick={(d) => { setDrillCategory(d.type === drillCategory ? null : d.type); }}
                            style={{ cursor: "pointer" }}
                          >
                            {categoryBreakdown.map(entry => (
                              <Cell key={entry.type} fill={CATEGORY_COLORS[entry.type] || "#94a3b8"} opacity={drillCategory && drillCategory !== entry.type ? 0.3 : 1} />
                            ))}
                          </Pie>
                          <Tooltip formatter={(v: number) => fmtFull(v)} contentStyle={{ borderRadius: 8, border: "1px solid #E7E7E7", fontSize: 12 }} />
                        </PieChart>
                      </ResponsiveContainer>
                    </div>
                    <div className="space-y-2">
                      {categoryBreakdown.map(c => {
                        const total = categoryBreakdown.reduce((s, x) => s + x.value, 0);
                        const p = total > 0 ? (c.value / total) * 100 : 0;
                        return (
                          <button
                            key={c.type}
                            onClick={() => setDrillCategory(c.type === drillCategory ? null : c.type)}
                            className={clsx("w-full flex items-center justify-between text-xs rounded-lg px-2 py-1.5 transition-colors text-left", drillCategory === c.type ? "bg-slate-100" : "hover:bg-slate-50")}
                          >
                            <div className="flex items-center gap-2">
                              <div className="w-2.5 h-2.5 rounded-sm flex-shrink-0" style={{ background: CATEGORY_COLORS[c.type] || "#94a3b8" }} />
                              <span className="font-medium text-slate-700">{c.name}</span>
                            </div>
                            <div className="text-right ml-2">
                              <div className="font-bold text-slate-800">{fmtFull(c.value)}</div>
                              <div className="text-[10px] text-slate-400">{p.toFixed(1)}%</div>
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* ── Cost per KM ── */}
            {costPerKmData.length > 0 && (
              <div className="bg-white border border-[#E7E7E7] rounded-xl shadow-sm p-5">
                <div className="mb-4">
                  <h2 className="text-base font-semibold text-slate-800">Trošak po kilometru</h2>
                  <p className="text-xs text-slate-400 mt-0.5">Period troškovi ÷ ukupni km — otkriva skuplja vozila za eksploataciju</p>
                </div>
                <div className="h-48">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={costPerKmData} layout="vertical" margin={{ left: 10, right: 20 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#E7E7E7" />
                      <XAxis type="number" tick={{ fontSize: 11, fill: "#64748b" }} tickFormatter={v => `€${v.toFixed(2)}`} />
                      <YAxis type="category" dataKey="name" tick={{ fontSize: 11, fill: "#475569" }} width={80} />
                      <Tooltip contentStyle={{ borderRadius: 8, border: "1px solid #E7E7E7", fontSize: 12 }} formatter={(v: number) => [`€${v.toFixed(3)}/km`, "Trošak"]} />
                      <Bar dataKey="value" radius={[0, 4, 4, 0]} fill="#003580" />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
            )}

            {/* ── Per-vehicle profitability table ── */}
            <div className="bg-white border border-[#E7E7E7] rounded-xl shadow-sm overflow-hidden">
              <div className="px-5 py-4 border-b border-[#E7E7E7] flex items-center justify-between flex-wrap gap-3">
                <div>
                  <h2 className="text-base font-semibold text-slate-800">Profitabilnost po vozilu</h2>
                  <p className="text-xs text-slate-400 mt-0.5">Klikni vozilo za detalje · Breakeven = životni prihod vs. nabavna cijena</p>
                </div>
                <select value={sortBy} onChange={e => setSortBy(e.target.value as "profit" | "revenue" | "costs")} className="bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs font-medium text-slate-700 focus:outline-none focus:ring-2 focus:ring-[#003580]/20 focus:border-[#003580]">
                  <option value="profit">Sortiraj po profitu</option>
                  <option value="revenue">Sortiraj po prihodu</option>
                  <option value="costs">Sortiraj po troškovima</option>
                </select>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left">
                  <thead className="bg-slate-50 border-b border-[#E7E7E7]">
                    <tr>
                      {["Vozilo", "Status", "# Najma", "Prihod", "Troškovi", "Profit", "Marža", "Breakeven"].map(h => (
                        <th key={h} className="px-4 py-3 text-[10px] font-bold text-slate-500 uppercase tracking-wider whitespace-nowrap">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {vehicleStats.map(v => {
                      const mHealth = v.margin >= 25 ? "green" : v.margin >= 0 ? "amber" : "red";
                      return (
                        <tr key={v.id} onClick={() => router.push(`/dashboard/fleet/${v.id}`)} className="hover:bg-slate-50 transition-colors cursor-pointer">
                          <td className="px-4 py-3.5">
                            <div className="text-sm font-semibold text-slate-800">{v.name}</div>
                            <div className="text-xs font-mono text-[#003580] font-bold">{v.registration}</div>
                          </td>
                          <td className="px-4 py-3.5">
                            <span className={clsx("text-[10px] font-bold px-2 py-0.5 rounded-full uppercase whitespace-nowrap", {
                              "bg-emerald-100 text-emerald-700": v.status === "free",
                              "bg-blue-100 text-blue-700": v.status === "rented",
                              "bg-amber-100 text-amber-700": v.status === "service",
                              "bg-purple-100 text-purple-700": v.status === "washing",
                              "bg-slate-100 text-slate-500": v.status === "inactive",
                            })}>
                              {{ free: "Slobodno", rented: "U najmu", service: "Servis", washing: "Pranje", inactive: "Neaktivno" }[v.status] || v.status}
                            </span>
                          </td>
                          <td className="px-4 py-3.5 text-sm text-slate-600 text-center">{v.rentalCount}</td>
                          <td className="px-4 py-3.5 text-sm font-semibold text-emerald-600 whitespace-nowrap">{fmtFull(v.revenue)}</td>
                          <td className="px-4 py-3.5 text-sm font-semibold text-red-500 whitespace-nowrap">{fmtFull(v.costs)}</td>
                          <td className={clsx("px-4 py-3.5 text-sm font-black whitespace-nowrap", v.profit >= 0 ? "text-[#003580]" : "text-red-600")}>{fmtFull(v.profit)}</td>
                          <td className="px-4 py-3.5 min-w-[100px]">
                            <div className="flex items-center gap-2">
                              <div className="flex-1 h-2 bg-slate-100 rounded-full overflow-hidden">
                                <div className={clsx("h-full rounded-full", { "bg-emerald-500": mHealth === "green", "bg-amber-400": mHealth === "amber", "bg-red-500": mHealth === "red" })} style={{ width: `${Math.max(0, Math.min(100, Math.abs(v.margin)))}%` }} />
                              </div>
                              <span className={clsx("text-xs font-bold whitespace-nowrap", { "text-emerald-600": mHealth === "green", "text-amber-600": mHealth === "amber", "text-red-600": mHealth === "red" })}>
                                {pct(v.margin)}
                              </span>
                            </div>
                          </td>
                          <td className="px-4 py-3.5 min-w-[120px]">
                            {v.breakeven !== null ? (
                              <div>
                                <div className="flex items-center gap-1.5 mb-1">
                                  <div className="flex-1 h-2 bg-slate-100 rounded-full overflow-hidden">
                                    <div className={clsx("h-full rounded-full", v.breakeven! >= 100 ? "bg-emerald-500" : v.breakeven! >= 50 ? "bg-amber-400" : "bg-red-400")} style={{ width: `${v.breakeven!}%` }} />
                                  </div>
                                  <span className={clsx("text-[10px] font-bold whitespace-nowrap", v.breakeven! >= 100 ? "text-emerald-600" : v.breakeven! >= 50 ? "text-amber-600" : "text-red-500")}>
                                    {pct(v.breakeven!)}
                                  </span>
                                </div>
                                <div className="text-[10px] text-slate-400">{fmtFull(v.lifetimeRevenue)} / {fmtFull(v.purchasePrice!)}</div>
                              </div>
                            ) : (
                              <span className="text-xs text-slate-300">Nema podatka</span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
                <div className="px-5 py-3 bg-slate-50 border-t border-[#E7E7E7] flex flex-wrap items-center justify-between gap-2 text-xs text-slate-500">
                  <span>{vehicleStats.length} vozila</span>
                  <div className="flex flex-wrap gap-4">
                    <span>Prihod: <span className="font-bold text-emerald-600">{fmt(totalRevenue)}</span></span>
                    <span>Troškovi: <span className="font-bold text-red-500">{fmt(totalCosts)}</span></span>
                    <span>Neto: <span className={clsx("font-bold", netProfit >= 0 ? "text-[#003580]" : "text-red-600")}>{fmt(netProfit)}</span></span>
                  </div>
                </div>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
