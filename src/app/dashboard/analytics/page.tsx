"use client";

import { useState, useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import clsx from "clsx";
import {
  LineChart, Line, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from "recharts";

type Period = "this_month" | "last_month" | "3m" | "ytd" | "all";
type CategoryFilter = "all" | "fuel" | "maintenance" | "insurance" | "washing" | "tyre" | "other";

interface Vehicle {
  id: string;
  make: string;
  model: string;
  registration: string;
  status: string;
  daily_rate: number;
}

interface Rental {
  id: string;
  vehicle_id: string;
  start_date: string;
  end_date: string;
  total_amount: number;
  status: string;
}

interface Expense {
  id: string;
  vehicle_id: string;
  date: string;
  type: string;
  amount: number;
  global_expense_id?: string | null;
}

const PERIOD_LABELS: Record<Period, string> = {
  this_month: "Ovaj mjesec",
  last_month: "Prošli mjesec",
  "3m": "Posljednja 3 mjeseca",
  ytd: "Od početka godine",
  all: "Sve vrijeme",
};

const CATEGORY_LABELS: Record<string, string> = {
  fuel: "Gorivo",
  maintenance: "Servis",
  insurance: "Osiguranje",
  washing: "Pranje",
  tyre: "Gume",
  other: "Ostalo",
};

const CATEGORY_COLORS: Record<string, string> = {
  fuel: "#f97316",
  maintenance: "#3b82f6",
  insurance: "#8b5cf6",
  washing: "#06b6d4",
  tyre: "#64748b",
  other: "#94a3b8",
};

function periodRange(p: Period): { from: string; to: string } {
  const now = new Date();
  const today = now.toISOString().slice(0, 10);

  if (p === "this_month") {
    const start = new Date(now.getFullYear(), now.getMonth(), 1);
    return { from: start.toISOString().slice(0, 10), to: today };
  }
  if (p === "last_month") {
    const start = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const end = new Date(now.getFullYear(), now.getMonth(), 0);
    return { from: start.toISOString().slice(0, 10), to: end.toISOString().slice(0, 10) };
  }
  if (p === "3m") {
    const start = new Date(now.getFullYear(), now.getMonth() - 2, 1);
    return { from: start.toISOString().slice(0, 10), to: today };
  }
  if (p === "ytd") {
    return { from: `${now.getFullYear()}-01-01`, to: today };
  }
  return { from: "1900-01-01", to: today };
}

const fmt = (n: number) =>
  `€${n.toLocaleString("de-DE", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

export default function AnalyticsPage() {
  const router = useRouter();
  const supabase = createClient();

  const [role, setRole] = useState<"admin" | "agent" | null>(null);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [rentals, setRentals] = useState<Rental[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [loading, setLoading] = useState(true);

  const [period, setPeriod] = useState<Period>("this_month");
  const [category, setCategory] = useState<CategoryFilter>("all");
  const [vehicleId, setVehicleId] = useState<string>("all");
  const [sortBy, setSortBy] = useState<"profit" | "revenue" | "costs">("profit");

  // Auth + role gate
  useEffect(() => {
    const check = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        router.push("/login");
        return;
      }
      const { data: profile } = await supabase
        .from("profiles")
        .select("role")
        .eq("id", user.id)
        .single();
      const r = (profile?.role as "admin" | "agent") || "agent";
      setRole(r);
      if (r !== "admin") {
        router.push("/dashboard");
      }
    };
    check();
  }, []);

  // Load data when filters change
  useEffect(() => {
    if (role !== "admin") return;

    const load = async () => {
      setLoading(true);
      const { from, to } = periodRange(period);

      const [vRes, rRes, eRes] = await Promise.all([
        supabase.from("vehicles").select("id, make, model, registration, status, daily_rate"),
        supabase
          .from("rentals")
          .select("id, vehicle_id, start_date, end_date, total_amount, status")
          .gte("start_date", from)
          .lte("start_date", to)
          .neq("status", "cancelled"),
        supabase
          .from("vehicle_expenses")
          .select("id, vehicle_id, date, type, amount, global_expense_id")
          .gte("date", from)
          .lte("date", to),
      ]);

      setVehicles(vRes.data || []);
      setRentals(rRes.data || []);
      setExpenses(eRes.data || []);
      setLoading(false);
    };

    load();
  }, [period, role]);

  // ── Computed data ──

  const filteredExpenses = useMemo(() => {
    return expenses.filter((e) => {
      if (category !== "all" && e.type !== category) return false;
      if (vehicleId !== "all" && e.vehicle_id !== vehicleId) return false;
      return true;
    });
  }, [expenses, category, vehicleId]);

  const filteredRentals = useMemo(() => {
    return vehicleId === "all" ? rentals : rentals.filter((r) => r.vehicle_id === vehicleId);
  }, [rentals, vehicleId]);

  const totalRevenue = filteredRentals.reduce((s, r) => s + Number(r.total_amount || 0), 0);
  const totalCosts = filteredExpenses.reduce((s, e) => s + Number(e.amount || 0), 0);
  const netProfit = totalRevenue - totalCosts;
  const profitMargin = totalRevenue > 0 ? (netProfit / totalRevenue) * 100 : 0;

  // Monthly time series
  const monthlySeries = useMemo(() => {
    const map: Record<string, { month: string; revenue: number; costs: number }> = {};
    const monthKey = (d: string) => d.slice(0, 7);

    filteredRentals.forEach((r) => {
      const k = monthKey(r.start_date);
      if (!map[k]) map[k] = { month: k, revenue: 0, costs: 0 };
      map[k].revenue += Number(r.total_amount || 0);
    });
    filteredExpenses.forEach((e) => {
      const k = monthKey(e.date);
      if (!map[k]) map[k] = { month: k, revenue: 0, costs: 0 };
      map[k].costs += Number(e.amount || 0);
    });

    return Object.values(map)
      .sort((a, b) => a.month.localeCompare(b.month))
      .map((row) => ({
        ...row,
        profit: row.revenue - row.costs,
        label: new Date(row.month + "-01").toLocaleDateString("hr-HR", { month: "short", year: "2-digit" }),
      }));
  }, [filteredRentals, filteredExpenses]);

  // Category breakdown (always uses all categories — ignores category filter so the pie shows the full picture)
  const categoryBreakdown = useMemo(() => {
    const baseExpenses = expenses.filter((e) =>
      vehicleId === "all" ? true : e.vehicle_id === vehicleId
    );
    const sums: Record<string, number> = {};
    baseExpenses.forEach((e) => {
      sums[e.type] = (sums[e.type] || 0) + Number(e.amount || 0);
    });
    return Object.entries(sums)
      .map(([type, value]) => ({
        name: CATEGORY_LABELS[type] || type,
        type,
        value: Number(value.toFixed(2)),
      }))
      .sort((a, b) => b.value - a.value);
  }, [expenses, vehicleId]);

  // Per-vehicle stats
  const vehicleStats = useMemo(() => {
    return vehicles
      .map((v) => {
        const vRentals = rentals.filter((r) => r.vehicle_id === v.id);
        const vExpenses = expenses.filter((e) => {
          if (category !== "all" && e.type !== category) return false;
          return e.vehicle_id === v.id;
        });
        const revenue = vRentals.reduce((s, r) => s + Number(r.total_amount || 0), 0);
        const costs = vExpenses.reduce((s, e) => s + Number(e.amount || 0), 0);
        const profit = revenue - costs;
        const margin = revenue > 0 ? (profit / revenue) * 100 : 0;
        return {
          id: v.id,
          name: `${v.make} ${v.model}`,
          registration: v.registration,
          revenue,
          costs,
          profit,
          margin,
          rentalCount: vRentals.length,
        };
      })
      .sort((a, b) => b[sortBy] - a[sortBy]);
  }, [vehicles, rentals, expenses, category, sortBy]);

  if (role !== "admin") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#F7F9FC]">
        <p className="text-slate-400 text-sm">Učitavanje...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#F7F9FC]">
      <div className="p-6 max-w-[1440px] mx-auto space-y-6">
        {/* ── Header ── */}
        <div className="flex items-end justify-between flex-wrap gap-4">
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-bold text-[#003580] tracking-tight">Analitika</h1>
              <span className="text-[10px] font-bold bg-[#003580]/10 text-[#003580] px-2 py-0.5 rounded uppercase tracking-wide">
                CEO View
              </span>
            </div>
            <p className="text-sm text-slate-500 mt-0.5">
              Detaljan pregled prihoda, troškova i profita po vozilu
            </p>
          </div>

          {/* Filter pills */}
          <div className="flex flex-wrap gap-2">
            <div className="flex items-center gap-0.5 bg-white border border-[#E7E7E7] rounded-lg p-1 shadow-sm">
              {(Object.keys(PERIOD_LABELS) as Period[]).map((p) => (
                <button
                  key={p}
                  onClick={() => setPeriod(p)}
                  className={clsx(
                    "px-3 py-1.5 rounded-md text-xs font-semibold transition-all whitespace-nowrap",
                    period === p
                      ? "bg-[#003580] text-white shadow-sm"
                      : "text-slate-500 hover:text-slate-800 hover:bg-slate-50"
                  )}
                >
                  {PERIOD_LABELS[p]}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* ── Secondary filters ── */}
        <div className="flex flex-wrap items-center gap-3 bg-white border border-[#E7E7E7] rounded-xl shadow-sm px-4 py-3">
          <div className="flex items-center gap-2">
            <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
              Kategorija troška:
            </span>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value as CategoryFilter)}
              className="bg-slate-50 border border-slate-200 rounded-lg px-3 py-1.5 text-sm font-medium text-slate-700 focus:outline-none focus:ring-2 focus:ring-[#003580]/20 focus:border-[#003580]"
            >
              <option value="all">Sve kategorije</option>
              {Object.entries(CATEGORY_LABELS).map(([k, v]) => (
                <option key={k} value={k}>{v}</option>
              ))}
            </select>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
              Vozilo:
            </span>
            <select
              value={vehicleId}
              onChange={(e) => setVehicleId(e.target.value)}
              className="bg-slate-50 border border-slate-200 rounded-lg px-3 py-1.5 text-sm font-medium text-slate-700 focus:outline-none focus:ring-2 focus:ring-[#003580]/20 focus:border-[#003580]"
            >
              <option value="all">Sva vozila</option>
              {vehicles.map((v) => (
                <option key={v.id} value={v.id}>
                  {v.make} {v.model} ({v.registration})
                </option>
              ))}
            </select>
          </div>

          {(category !== "all" || vehicleId !== "all") && (
            <button
              onClick={() => { setCategory("all"); setVehicleId("all"); }}
              className="ml-auto text-xs font-semibold text-slate-500 hover:text-[#003580] transition-colors"
            >
              ✕ Resetuj filtere
            </button>
          )}
        </div>

        {/* ── KPI cards ── */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <KPICard
            label="Prihod"
            value={fmt(totalRevenue)}
            sublabel={`${filteredRentals.length} najma`}
            color="text-emerald-600"
            dotColor="bg-emerald-500"
          />
          <KPICard
            label="Troškovi"
            value={fmt(totalCosts)}
            sublabel={`${filteredExpenses.length} stavki`}
            color="text-red-600"
            dotColor="bg-red-500"
          />
          <KPICard
            label="Neto profit"
            value={fmt(netProfit)}
            sublabel={netProfit >= 0 ? "Pozitivno" : "Negativno"}
            color={netProfit >= 0 ? "text-[#003580]" : "text-red-600"}
            dotColor={netProfit >= 0 ? "bg-[#003580]" : "bg-red-500"}
          />
          <KPICard
            label="Marža profita"
            value={`${profitMargin.toFixed(1)}%`}
            sublabel={profitMargin >= 20 ? "Zdrava marža" : profitMargin >= 0 ? "Niska marža" : "Gubitak"}
            color={profitMargin >= 20 ? "text-emerald-600" : profitMargin >= 0 ? "text-amber-600" : "text-red-600"}
            dotColor={profitMargin >= 20 ? "bg-emerald-500" : profitMargin >= 0 ? "bg-amber-400" : "bg-red-500"}
          />
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-16 text-slate-400 text-sm">
            Učitavanje podataka...
          </div>
        ) : (
          <>
            {/* ── Revenue vs Costs trend ── */}
            <div className="bg-white border border-[#E7E7E7] rounded-xl shadow-sm p-5">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h2 className="text-base font-semibold text-slate-800">Prihod naspram troškova</h2>
                  <p className="text-xs text-slate-400 mt-0.5">Mjesečni trend kroz odabrani period</p>
                </div>
              </div>
              {monthlySeries.length === 0 ? (
                <div className="py-12 text-center text-sm text-slate-400">Nema podataka za ovaj period</div>
              ) : (
                <div className="h-72">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={monthlySeries}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#E7E7E7" />
                      <XAxis dataKey="label" tick={{ fontSize: 11, fill: "#64748b" }} />
                      <YAxis
                        tick={{ fontSize: 11, fill: "#64748b" }}
                        tickFormatter={(v) => `€${(v / 1000).toFixed(1)}k`}
                      />
                      <Tooltip
                        formatter={(v: number) => fmt(v)}
                        contentStyle={{ borderRadius: 8, border: "1px solid #E7E7E7", fontSize: 12 }}
                      />
                      <Legend wrapperStyle={{ fontSize: 12 }} />
                      <Line type="monotone" dataKey="revenue" name="Prihod" stroke="#10b981" strokeWidth={2.5} dot={{ r: 3 }} />
                      <Line type="monotone" dataKey="costs" name="Troškovi" stroke="#ef4444" strokeWidth={2.5} dot={{ r: 3 }} />
                      <Line type="monotone" dataKey="profit" name="Profit" stroke="#003580" strokeWidth={2.5} strokeDasharray="5 3" dot={{ r: 3 }} />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              )}
            </div>

            {/* ── Two-up grid: Pie + Bar comparison ── */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Cost breakdown pie */}
              <div className="bg-white border border-[#E7E7E7] rounded-xl shadow-sm p-5">
                <div className="mb-4">
                  <h2 className="text-base font-semibold text-slate-800">Struktura troškova</h2>
                  <p className="text-xs text-slate-400 mt-0.5">Po kategoriji</p>
                </div>
                {categoryBreakdown.length === 0 ? (
                  <div className="py-12 text-center text-sm text-slate-400">Nema troškova</div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 items-center">
                    <div className="h-64">
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                          <Pie
                            data={categoryBreakdown}
                            dataKey="value"
                            nameKey="name"
                            cx="50%"
                            cy="50%"
                            innerRadius={48}
                            outerRadius={86}
                            paddingAngle={2}
                          >
                            {categoryBreakdown.map((entry) => (
                              <Cell key={entry.type} fill={CATEGORY_COLORS[entry.type] || "#94a3b8"} />
                            ))}
                          </Pie>
                          <Tooltip formatter={(v: number) => fmt(v)} contentStyle={{ borderRadius: 8, border: "1px solid #E7E7E7", fontSize: 12 }} />
                        </PieChart>
                      </ResponsiveContainer>
                    </div>
                    <div className="space-y-2">
                      {categoryBreakdown.map((c) => {
                        const total = categoryBreakdown.reduce((s, x) => s + x.value, 0);
                        const pct = total > 0 ? (c.value / total) * 100 : 0;
                        return (
                          <div key={c.type} className="flex items-center justify-between text-xs">
                            <div className="flex items-center gap-2">
                              <div className="w-2.5 h-2.5 rounded-sm" style={{ background: CATEGORY_COLORS[c.type] || "#94a3b8" }} />
                              <span className="font-medium text-slate-700">{c.name}</span>
                            </div>
                            <div className="text-right">
                              <div className="font-bold text-slate-800">{fmt(c.value)}</div>
                              <div className="text-[10px] text-slate-400">{pct.toFixed(1)}%</div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>

              {/* Vehicle profit comparison */}
              <div className="bg-white border border-[#E7E7E7] rounded-xl shadow-sm p-5">
                <div className="mb-4 flex items-center justify-between flex-wrap gap-2">
                  <div>
                    <h2 className="text-base font-semibold text-slate-800">Usporedba vozila</h2>
                    <p className="text-xs text-slate-400 mt-0.5">Prihod, troškovi i profit po vozilu</p>
                  </div>
                  <select
                    value={sortBy}
                    onChange={(e) => setSortBy(e.target.value as "profit" | "revenue" | "costs")}
                    className="bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1 text-xs font-medium text-slate-700 focus:outline-none focus:ring-2 focus:ring-[#003580]/20 focus:border-[#003580]"
                  >
                    <option value="profit">Sortiraj po profitu</option>
                    <option value="revenue">Sortiraj po prihodu</option>
                    <option value="costs">Sortiraj po troškovima</option>
                  </select>
                </div>
                {vehicleStats.length === 0 ? (
                  <div className="py-12 text-center text-sm text-slate-400">Nema vozila</div>
                ) : (
                  <div className="h-72">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={vehicleStats} layout="vertical" margin={{ left: 30 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#E7E7E7" />
                        <XAxis type="number" tick={{ fontSize: 11, fill: "#64748b" }} tickFormatter={(v) => `€${(v / 1000).toFixed(0)}k`} />
                        <YAxis type="category" dataKey="name" tick={{ fontSize: 10, fill: "#475569" }} width={120} />
                        <Tooltip
                          formatter={(v: number) => fmt(v)}
                          contentStyle={{ borderRadius: 8, border: "1px solid #E7E7E7", fontSize: 12 }}
                        />
                        <Legend wrapperStyle={{ fontSize: 12 }} />
                        <Bar dataKey="revenue" name="Prihod" fill="#10b981" radius={[0, 4, 4, 0]} />
                        <Bar dataKey="costs" name="Troškovi" fill="#ef4444" radius={[0, 4, 4, 0]} />
                        <Bar dataKey="profit" name="Profit" fill="#003580" radius={[0, 4, 4, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                )}
              </div>
            </div>

            {/* ── Per-vehicle table ── */}
            <div className="bg-white border border-[#E7E7E7] rounded-xl shadow-sm overflow-hidden">
              <div className="px-5 py-4 border-b border-[#E7E7E7] flex items-center justify-between">
                <div>
                  <h2 className="text-base font-semibold text-slate-800">Detaljan pregled po vozilu</h2>
                  <p className="text-xs text-slate-400 mt-0.5">Klikni vozilo za detalje</p>
                </div>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left">
                  <thead className="bg-slate-50 border-b border-[#E7E7E7]">
                    <tr>
                      {["Vozilo", "Reg.", "# Najma", "Prihod", "Troškovi", "Profit", "Marža"].map((h) => (
                        <th key={h} className="px-5 py-3 text-[11px] font-semibold text-slate-500 uppercase tracking-wider whitespace-nowrap">
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {vehicleStats.map((v) => (
                      <tr
                        key={v.id}
                        onClick={() => router.push(`/dashboard/fleet/${v.id}`)}
                        className="hover:bg-slate-50 transition-colors cursor-pointer"
                      >
                        <td className="px-5 py-3.5 text-sm font-semibold text-slate-800">{v.name}</td>
                        <td className="px-5 py-3.5 text-sm font-mono text-[#003580]">{v.registration}</td>
                        <td className="px-5 py-3.5 text-sm text-slate-600">{v.rentalCount}</td>
                        <td className="px-5 py-3.5 text-sm font-semibold text-emerald-600 whitespace-nowrap">{fmt(v.revenue)}</td>
                        <td className="px-5 py-3.5 text-sm font-semibold text-red-600 whitespace-nowrap">{fmt(v.costs)}</td>
                        <td className={clsx(
                          "px-5 py-3.5 text-sm font-bold whitespace-nowrap",
                          v.profit >= 0 ? "text-[#003580]" : "text-red-600"
                        )}>
                          {fmt(v.profit)}
                        </td>
                        <td className="px-5 py-3.5">
                          <div className="flex items-center gap-2">
                            <div className="flex-1 h-1.5 bg-slate-100 rounded-full overflow-hidden min-w-[60px] max-w-[120px]">
                              <div
                                className={clsx(
                                  "h-full rounded-full",
                                  v.margin >= 20 ? "bg-emerald-500" : v.margin >= 0 ? "bg-amber-400" : "bg-red-500"
                                )}
                                style={{ width: `${Math.max(0, Math.min(100, Math.abs(v.margin)))}%` }}
                              />
                            </div>
                            <span className={clsx(
                              "text-xs font-semibold whitespace-nowrap",
                              v.margin >= 20 ? "text-emerald-600" : v.margin >= 0 ? "text-amber-600" : "text-red-600"
                            )}>
                              {v.margin.toFixed(1)}%
                            </span>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                <div className="px-5 py-3 bg-slate-50 border-t border-[#E7E7E7] flex items-center justify-between">
                  <span className="text-xs text-slate-500">{vehicleStats.length} vozila</span>
                  <div className="flex items-center gap-6 text-xs">
                    <span>Ukupan prihod: <span className="font-bold text-emerald-600">{fmt(totalRevenue)}</span></span>
                    <span>Ukupni troškovi: <span className="font-bold text-red-600">{fmt(totalCosts)}</span></span>
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

function KPICard({
  label, value, sublabel, color, dotColor,
}: {
  label: string; value: string; sublabel: string; color: string; dotColor: string;
}) {
  return (
    <div className="bg-white rounded-xl border border-[#E7E7E7] shadow-sm p-5">
      <div className="flex items-center gap-2 mb-3">
        <div className={clsx("w-2 h-2 rounded-full flex-shrink-0", dotColor)} />
        <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">{label}</span>
      </div>
      <div className={clsx("text-2xl font-bold leading-none", color)}>{value}</div>
      <div className="text-[11px] font-medium text-slate-400 mt-2">{sublabel}</div>
    </div>
  );
}
