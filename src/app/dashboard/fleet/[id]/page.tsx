"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import clsx from "clsx";
import ReceiptUpload from "@/components/expenses/ReceiptUpload";
import ReceiptLightbox from "@/components/expenses/ReceiptLightbox";
import { uploadReceipt, getReceiptUrl } from "@/lib/receipts";
import { CarDamageInspector, type DamagePin } from "@/components/CarDamageInspector";

const STATUS_LABELS: Record<string, string> = {
  free: "Slobodno",
  rented: "U najmu",
  service: "Na servisu",
  washing: "Pranje",
  inactive: "Neaktivno",
};

const STATUS_BADGE: Record<string, string> = {
  free: "bg-emerald-100 text-emerald-700 border border-emerald-200",
  rented: "bg-blue-100 text-blue-700 border border-blue-200",
  service: "bg-amber-100 text-amber-700 border border-amber-200",
  washing: "bg-purple-100 text-purple-700 border border-purple-200",
  inactive: "bg-slate-100 text-slate-500 border border-slate-200",
};

const EXPENSE_TYPE_LABELS: Record<string, string> = {
  fuel: "Gorivo",
  maintenance: "Servis",
  insurance: "Osiguranje",
  washing: "Pranje",
  tyre: "Gume",
  other: "Ostalo",
  registration: "Registracija",
};

const EXPENSE_TYPE_BADGE: Record<string, string> = {
  fuel: "bg-orange-100 text-orange-700",
  maintenance: "bg-blue-100 text-blue-700",
  insurance: "bg-purple-100 text-purple-700",
  washing: "bg-cyan-100 text-cyan-700",
  tyre: "bg-slate-100 text-slate-600",
  other: "bg-slate-100 text-slate-500",
  registration: "bg-emerald-100 text-emerald-700",
};

const VEHICLE_COLORS: Record<string, string> = {
  default: "from-[#003580] to-[#006CE4]",
  crna: "from-slate-700 to-slate-900",
  bijela: "from-slate-200 to-slate-400",
  siva: "from-slate-400 to-slate-600",
  crvena: "from-red-500 to-red-700",
  plava: "from-blue-500 to-blue-700",
  zelena: "from-emerald-500 to-emerald-700",
  srebrna: "from-slate-300 to-slate-500",
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
  persistent_damage?: { pins: DamagePin[] };
}

interface Expense {
  id: string;
  vehicle_id: string;
  date: string;
  type: string;
  description?: string;
  vendor?: string;
  amount: number;
  image_url?: string | null;
  global_expense_id?: string | null;
}

interface Rental {
  id: string;
  client_id?: string;
  start_date: string;
  end_date: string;
  total_amount: number;
  status: string;
  clients?: { full_name: string; company_name?: string };
}

const emptyExpense = { date: new Date().toISOString().slice(0, 10), type: "maintenance", description: "", vendor: "", amount: 0 };

export default function VehicleDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const searchParams = useSearchParams();
  const supabase = createClient();

  const [vehicle, setVehicle] = useState<Vehicle | null>(null);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [rentals, setRentals] = useState<Rental[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<"expenses" | "rentals">("expenses");

  // Edit vehicle modal
  const [showEditModal, setShowEditModal] = useState(false);
  const [editingVehicle, setEditingVehicle] = useState<Partial<Vehicle>>({});
  const [saving, setSaving] = useState(false);

  // Add expense modal
  const [showExpenseModal, setShowExpenseModal] = useState(false);
  const [newExpense, setNewExpense] = useState({ ...emptyExpense });
  const [expensePhoto, setExpensePhoto] = useState<File | null>(null);
  const [savingExpense, setSavingExpense] = useState(false);
  const [splitMonths, setSplitMonths] = useState(1);

  // Vehicle condition (damage) modal
  const [showDamageModal, setShowDamageModal] = useState(false);
  const [vehicleDamages, setVehicleDamages] = useState<DamagePin[]>([]);
  const [savingDamages, setSavingDamages] = useState(false);

  // Receipt lightbox
  const [lightboxUrl, setLightboxUrl] = useState<string | null>(null);

  const openReceipt = async (path: string | null | undefined) => {
    const url = await getReceiptUrl(supabase, path);
    if (url) setLightboxUrl(url);
  };

  const load = async () => {
    setLoading(true);
    const [{ data: v }, { data: e }, { data: r }] = await Promise.all([
      supabase.from("vehicles").select("*").eq("id", id).single(),
      supabase.from("vehicle_expenses").select("*").eq("vehicle_id", id).order("date", { ascending: false }),
      supabase.from("rentals").select("*, clients(full_name, company_name)").eq("vehicle_id", id).order("start_date", { ascending: false }),
    ]);
    setVehicle(v);
    setExpenses(e || []);
    setRentals(r || []);
    setLoading(false);
  };

  useEffect(() => { load(); }, [id]);

  // Auto-open expense modal when ?expense=<type> is in the URL (e.g. from dashboard alerts)
  useEffect(() => {
    const expenseType = searchParams.get("expense");
    if (!expenseType || loading) return;
    setNewExpense({ ...emptyExpense, type: expenseType });
    setShowExpenseModal(true);
    // Remove the param from the URL without navigation so it doesn't re-trigger
    const url = new URL(window.location.href);
    url.searchParams.delete("expense");
    window.history.replaceState({}, "", url.toString());
  }, [loading, searchParams]);

  const saveVehicle = async () => {
    if (!vehicle) return;
    setSaving(true);
    await supabase.from("vehicles").update(editingVehicle).eq("id", vehicle.id);
    setSaving(false);
    setShowEditModal(false);
    load();
  };

  const saveExpense = async () => {
    setSavingExpense(true);
    const imagePath = await uploadReceipt(supabase, expensePhoto, "vehicles");
    const months = Math.max(1, splitMonths);
    const perMonth = Number((newExpense.amount / months).toFixed(2));
    const baseDate = new Date(newExpense.date);
    const rows = Array.from({ length: months }, (_, i) => {
      const d = new Date(baseDate);
      d.setMonth(d.getMonth() + i);
      return {
        ...newExpense,
        amount: perMonth,
        date: d.toISOString().slice(0, 10),
        vehicle_id: id,
        image_url: imagePath,
      };
    });
    await supabase.from("vehicle_expenses").insert(rows);
    setSavingExpense(false);
    setShowExpenseModal(false);
    setNewExpense({ ...emptyExpense });
    setExpensePhoto(null);
    setSplitMonths(1);
    load();
  };

  const openDamageModal = () => {
    setVehicleDamages(vehicle?.persistent_damage?.pins ?? []);
    setShowDamageModal(true);
  };

  const saveDamages = async () => {
    setSavingDamages(true);
    await supabase.from("vehicles").update({ persistent_damage: { pins: vehicleDamages } }).eq("id", id);
    setSavingDamages(false);
    setShowDamageModal(false);
    load();
  };

  const gradientKey = vehicle?.color?.toLowerCase() ?? "default";
  const gradient = VEHICLE_COLORS[gradientKey] ?? VEHICLE_COLORS.default;

  const totalExpenses = expenses.reduce((sum, e) => sum + e.amount, 0);

  const RENTAL_STATUS: Record<string, string> = {
    active: "bg-blue-100 text-blue-700",
    completed: "bg-emerald-100 text-emerald-700",
    cancelled: "bg-red-100 text-red-700",
    upcoming: "bg-amber-100 text-amber-700",
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#F7F9FC] flex items-center justify-center">
        <div className="text-slate-400 text-sm">Učitavanje...</div>
      </div>
    );
  }

  if (!vehicle) {
    return (
      <div className="min-h-screen bg-[#F7F9FC] flex items-center justify-center">
        <div className="text-center">
          <p className="text-slate-500 mb-4">Vozilo nije pronađeno.</p>
          <button onClick={() => router.push("/dashboard/fleet")} className="btn-primary">Nazad na flotu</button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#F7F9FC]">
      <div className="p-4 sm:p-6 max-w-[1200px] mx-auto space-y-4 sm:space-y-6">

        {/* Back nav */}
        <button
          onClick={() => router.push("/dashboard/fleet")}
          className="flex items-center gap-2 text-sm text-slate-500 hover:text-[#003580] transition-colors font-medium"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="15 18 9 12 15 6"/>
          </svg>
          Vozni park
        </button>

        {/* ── Hero card ── */}
        <div className="bg-white border border-[#E7E7E7] rounded-2xl shadow-sm overflow-hidden">
          <div className="grid grid-cols-1 lg:grid-cols-5">

            {/* Car visual */}
            <div className={clsx("lg:col-span-2 bg-gradient-to-br p-8 flex flex-col justify-between min-h-[220px]", gradient)}>
              <div className="flex items-start justify-between">
                <span className={clsx(
                  "inline-flex px-2.5 py-1 rounded-full text-[11px] font-bold uppercase tracking-wide backdrop-blur-sm",
                  STATUS_BADGE[vehicle.status] ?? "bg-white/20 text-white"
                )}>
                  {STATUS_LABELS[vehicle.status]}
                </span>
                {vehicle.registration_expiry && new Date(vehicle.registration_expiry) < new Date(Date.now() + 30 * 86400000) && (
                  <span className="bg-amber-400 text-amber-900 text-[10px] font-bold px-2 py-1 rounded-full">
                    REG. ISTIČE
                  </span>
                )}
              </div>

              {/* Car silhouette */}
              <div className="flex justify-center py-4">
                <svg viewBox="0 0 240 100" className="w-48 h-20 opacity-25 fill-white" xmlns="http://www.w3.org/2000/svg">
                  <path d="M30 65 L30 55 Q32 45 50 40 L80 30 Q100 20 130 20 L165 20 Q185 20 200 30 L215 40 Q225 45 225 55 L225 65 Q220 70 210 70 L200 70 Q198 60 185 60 Q172 60 170 70 L80 70 Q78 60 65 60 Q52 60 50 70 L40 70 Q30 70 30 65 Z"/>
                  <circle cx="65" cy="70" r="12" />
                  <circle cx="185" cy="70" r="12" />
                </svg>
              </div>

              <div>
                <h1 className="text-2xl font-bold text-white leading-tight">{vehicle.make} {vehicle.model}</h1>
                <p className="text-white/70 text-sm mt-0.5">{vehicle.year} · {vehicle.color ?? "—"}</p>
              </div>
            </div>

            {/* Specs grid */}
            <div className="lg:col-span-3 p-6 flex flex-col justify-between">
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-x-6 gap-y-5">
                {[
                  { label: "Registracija", value: vehicle.registration, mono: true },
                  { label: "Godište", value: String(vehicle.year) },
                  { label: "Dnevna tarifa", value: `${vehicle.daily_rate} KM/dan` },
                  { label: "Trenutna km", value: vehicle.current_km ? `${vehicle.current_km.toLocaleString()} km` : "—" },
                  { label: "Reg. ističe", value: vehicle.registration_expiry ?? "—", warn: vehicle.registration_expiry ? new Date(vehicle.registration_expiry) < new Date(Date.now() + 30 * 86400000) : false },
                  { label: "Boja", value: vehicle.color ?? "—" },
                  { label: "Broj šasije", value: vehicle.chassis_number ?? "—", mono: true, span: true },
                ].map((s) => (
                  <div key={s.label} className={s.span ? "col-span-2 sm:col-span-1" : ""}>
                    <div className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-0.5">{s.label}</div>
                    <div className={clsx(
                      "text-sm font-semibold",
                      s.mono ? "font-mono text-[#003580]" : "text-slate-800",
                      s.warn ? "text-amber-600" : ""
                    )}>
                      {s.value}
                    </div>
                  </div>
                ))}
              </div>

              {vehicle.notes && (
                <div className="mt-4 bg-slate-50 border border-[#E7E7E7] rounded-lg px-4 py-3 text-sm text-slate-500 italic">
                  {vehicle.notes}
                </div>
              )}

              <div className="flex flex-wrap gap-2 mt-5 pt-4 border-t border-[#E7E7E7]">
                <button
                  onClick={() => { setEditingVehicle({ ...vehicle }); setShowEditModal(true); }}
                  className="btn-secondary text-sm"
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/>
                    <path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/>
                  </svg>
                  Uredi vozilo
                </button>
                <button onClick={openDamageModal} className="btn-secondary text-sm">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
                  </svg>
                  Stanje vozila
                  {(vehicle.persistent_damage?.pins?.length ?? 0) > 0 && (
                    <span className="ml-1 bg-amber-100 text-amber-700 text-[10px] font-bold px-1.5 py-0.5 rounded-full">
                      {vehicle.persistent_damage!.pins.length}
                    </span>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* ── Summary chips ── */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          {[
            { label: "Ukupno troškova", value: `${totalExpenses.toLocaleString("de-DE", { minimumFractionDigits: 2 })} KM`, color: "text-red-600" },
            { label: "Broj stavki troškova", value: String(expenses.length), color: "text-slate-800" },
            { label: "Ukupno najma", value: String(rentals.length), color: "text-[#003580]" },
            { label: "Prihod od najma", value: `${rentals.reduce((s, r) => s + (isFinite(Number(r.total_amount)) ? Number(r.total_amount) : 0), 0).toLocaleString("de-DE", { minimumFractionDigits: 2 })} KM`, color: "text-emerald-600" },
          ].map((s) => (
            <div key={s.label} className="bg-white border border-[#E7E7E7] rounded-xl shadow-sm p-4">
              <div className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-1">{s.label}</div>
              <div className={clsx("text-xl font-bold", s.color)}>{s.value}</div>
            </div>
          ))}
        </div>

        {/* ── Tabs ── */}
        <div className="bg-white border border-[#E7E7E7] rounded-2xl shadow-sm overflow-hidden">
          {/* Tab bar */}
          <div className="flex items-center justify-between px-5 border-b border-[#E7E7E7]">
            <div className="flex gap-1">
              {(["expenses", "rentals"] as const).map((tab) => (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab)}
                  className={clsx(
                    "px-4 py-3.5 text-sm font-semibold transition-all border-b-2 -mb-px",
                    activeTab === tab
                      ? "text-[#003580] border-[#003580]"
                      : "text-slate-400 border-transparent hover:text-slate-700"
                  )}
                >
                  {tab === "expenses" ? "Troškovi" : "Historija najma"}
                </button>
              ))}
            </div>
            {activeTab === "expenses" && (
              <button
                onClick={() => { setNewExpense({ ...emptyExpense }); setShowExpenseModal(true); }}
                className="btn-primary text-xs py-1.5"
              >
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
                </svg>
                Dodaj trošak
              </button>
            )}
          </div>

          {/* Expenses tab */}
          {activeTab === "expenses" && (
            <>
              {expenses.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 text-slate-400 gap-3">
                  <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="opacity-30">
                    <rect x="2" y="5" width="20" height="14" rx="2"/><line x1="2" y1="10" x2="22" y2="10"/>
                  </svg>
                  <p className="text-sm">Nema evidentiranih troškova</p>
                  <button onClick={() => setShowExpenseModal(true)} className="btn-primary text-xs">Dodaj prvi trošak</button>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left">
                    <thead className="bg-slate-50 border-b border-[#E7E7E7]">
                      <tr>
                        {["Datum", "Tip", "Opis", "Dobavljač", "Iznos"].map((h) => (
                          <th key={h} className="px-5 py-3 text-[11px] font-semibold text-slate-500 uppercase tracking-wider whitespace-nowrap">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {expenses.map((e) => (
                        <tr key={e.id} className="hover:bg-slate-50 transition-colors">
                          <td className="px-5 py-3.5 text-sm text-slate-500 whitespace-nowrap">{e.date}</td>
                          <td className="px-5 py-3.5">
                            <div className="flex items-center gap-1.5">
                              <span className={clsx("inline-flex px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wide", EXPENSE_TYPE_BADGE[e.type] ?? "bg-slate-100 text-slate-500")}>
                                {EXPENSE_TYPE_LABELS[e.type] ?? e.type}
                              </span>
                              {e.global_expense_id && (
                                <span
                                  className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wide bg-amber-100 text-amber-700"
                                  title="Dio globalnog troška podijeljenog na sva vozila"
                                >
                                  <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                    <circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/>
                                  </svg>
                                  Globalno
                                </span>
                              )}
                            </div>
                          </td>
                          <td className="px-5 py-3.5 text-sm text-slate-700">{e.description || "—"}</td>
                          <td className="px-5 py-3.5 text-sm text-slate-500">{e.vendor || "—"}</td>
                          <td className="px-5 py-3.5 text-sm font-bold text-slate-800 whitespace-nowrap">
                            <div className="flex items-center justify-between gap-2">
                              <span>{Number(e.amount).toLocaleString("de-DE", { minimumFractionDigits: 2 })} KM</span>
                              {e.image_url && (
                                <button
                                  onClick={() => openReceipt(e.image_url)}
                                  className="text-[#003580] hover:text-[#002660] p-1 rounded hover:bg-blue-50 transition-colors"
                                  title="Prikaži račun"
                                >
                                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                    <path d="M21.44 11.05l-9.19 9.19a6 6 0 01-8.49-8.49l9.19-9.19a4 4 0 015.66 5.66l-9.2 9.19a2 2 0 01-2.83-2.83l8.49-8.48"/>
                                  </svg>
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  <div className="px-5 py-3 bg-slate-50 border-t border-[#E7E7E7] flex items-center justify-between rounded-b-2xl">
                    <span className="text-xs text-slate-500">{expenses.length} stavki</span>
                    <span className="text-sm font-bold text-slate-800">
                      Ukupno: {totalExpenses.toLocaleString("de-DE", { minimumFractionDigits: 2 })} KM
                    </span>
                  </div>
                </div>
              )}
            </>
          )}

          {/* Rentals tab */}
          {activeTab === "rentals" && (
            <>
              {rentals.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 text-slate-400 gap-2">
                  <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="opacity-30">
                    <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>
                  </svg>
                  <p className="text-sm">Nema evidentirane historije najma</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left">
                    <thead className="bg-slate-50 border-b border-[#E7E7E7]">
                      <tr>
                        {["Klijent", "Od", "Do", "Ukupno", "Status"].map((h) => (
                          <th key={h} className="px-5 py-3 text-[11px] font-semibold text-slate-500 uppercase tracking-wider whitespace-nowrap">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {rentals.map((r) => (
                        <tr key={r.id} className="hover:bg-slate-50 transition-colors">
                          <td className="px-5 py-3.5">
                            <div className="text-sm font-semibold text-slate-800">{r.clients?.full_name ?? "—"}</div>
                            {r.clients?.company_name && <div className="text-xs text-slate-400">{r.clients.company_name}</div>}
                          </td>
                          <td className="px-5 py-3.5 text-sm text-slate-500 whitespace-nowrap">{r.start_date}</td>
                          <td className="px-5 py-3.5 text-sm text-slate-500 whitespace-nowrap">{r.end_date}</td>
                          <td className="px-5 py-3.5 text-sm font-bold text-slate-800 whitespace-nowrap">
                            {isFinite(Number(r.total_amount)) ? `${Number(r.total_amount).toLocaleString("de-DE", { minimumFractionDigits: 2 })} KM` : "—"}
                          </td>
                          <td className="px-5 py-3.5">
                            <span className={clsx("inline-flex px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wide", RENTAL_STATUS[r.status] ?? "bg-slate-100 text-slate-500")}>
                              {r.status === "active" ? "Aktivan" : r.status === "completed" ? "Završen" : r.status === "cancelled" ? "Otkazan" : r.status === "upcoming" ? "Predstojeći" : r.status}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  <div className="px-5 py-3 bg-slate-50 border-t border-[#E7E7E7] rounded-b-2xl">
                    <span className="text-xs text-slate-500">{rentals.length} najma</span>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {/* ── Edit vehicle modal ── */}
      {showEditModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
          <div className="bg-white rounded-2xl border border-[#E7E7E7] shadow-2xl w-full max-w-2xl p-6 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-lg font-bold text-slate-800">Uredi vozilo</h2>
              <button onClick={() => setShowEditModal(false)} className="text-slate-400 hover:text-slate-600 p-1 rounded-lg hover:bg-slate-100 transition-colors">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
                </svg>
              </button>
            </div>
            <div className="grid grid-cols-2 gap-4">
              {[
                { label: "Marka", key: "make", type: "text" },
                { label: "Model", key: "model", type: "text" },
                { label: "Godište", key: "year", type: "number" },
                { label: "Registracija", key: "registration", type: "text" },
                { label: "Broj šasije", key: "chassis_number", type: "text" },
                { label: "Boja", key: "color", type: "text" },
                { label: "Dnevna tarifa (KM)", key: "daily_rate", type: "number" },
                { label: "Trenutna km", key: "current_km", type: "number" },
                { label: "Nabavna cijena (KM)", key: "purchase_price", type: "number" },
                { label: "Registracija ističe", key: "registration_expiry", type: "date" },
              ].map((f) => (
                <div key={f.key}>
                  <label className="block text-[11px] font-semibold text-slate-500 mb-1.5 uppercase tracking-wide">{f.label}</label>
                  <input
                    type={f.type}
                    className="input"
                    value={(editingVehicle as any)[f.key] ?? ""}
                    onChange={(e) => setEditingVehicle((prev) => ({ ...prev, [f.key]: f.type === "number" ? Number(e.target.value) : e.target.value }))}
                  />
                </div>
              ))}
              <div>
                <label className="block text-[11px] font-semibold text-slate-500 mb-1.5 uppercase tracking-wide">Status</label>
                <select
                  className="input"
                  value={editingVehicle.status ?? "free"}
                  onChange={(e) => setEditingVehicle((prev) => ({ ...prev, status: e.target.value }))}
                >
                  {Object.entries(STATUS_LABELS).map(([k, v]) => (
                    <option key={k} value={k}>{v}</option>
                  ))}
                </select>
              </div>
            </div>
            <div className="mt-4">
              <label className="block text-[11px] font-semibold text-slate-500 mb-1.5 uppercase tracking-wide">Napomene</label>
              <textarea
                className="input min-h-[70px] resize-none"
                value={editingVehicle.notes ?? ""}
                onChange={(e) => setEditingVehicle((prev) => ({ ...prev, notes: e.target.value }))}
              />
            </div>
            <div className="flex gap-3 justify-end mt-6 pt-4 border-t border-slate-100">
              <button onClick={() => setShowEditModal(false)} className="btn-secondary">Odustani</button>
              <button onClick={saveVehicle} disabled={saving} className="btn-primary">
                {saving ? "Čuvanje..." : "Spremi promjene"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Add expense modal ── */}
      {showExpenseModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
          <div className="bg-white rounded-2xl border border-[#E7E7E7] shadow-2xl w-full max-w-md p-6">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-lg font-bold text-slate-800">Novi trošak</h2>
              <button onClick={() => setShowExpenseModal(false)} className="text-slate-400 hover:text-slate-600 p-1 rounded-lg hover:bg-slate-100 transition-colors">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
                </svg>
              </button>
            </div>
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="label">Datum</label>
                  <input type="date" className="input" value={newExpense.date} onChange={(e) => setNewExpense((p) => ({ ...p, date: e.target.value }))} />
                </div>
                <div>
                  <label className="label">Tip troška</label>
                  <select className="input" value={newExpense.type} onChange={(e) => setNewExpense((p) => ({ ...p, type: e.target.value }))}>
                    {Object.entries(EXPENSE_TYPE_LABELS).map(([k, v]) => (
                      <option key={k} value={k}>{v}</option>
                    ))}
                  </select>
                </div>
              </div>
              <div>
                <label className="label">Opis</label>
                <input type="text" className="input" placeholder="Kratki opis troška..." value={newExpense.description} onChange={(e) => setNewExpense((p) => ({ ...p, description: e.target.value }))} />
              </div>
              <div>
                <label className="label">Dobavljač / servis</label>
                <input type="text" className="input" placeholder="npr. Auto Servis Petrović" value={newExpense.vendor} onChange={(e) => setNewExpense((p) => ({ ...p, vendor: e.target.value }))} />
              </div>
              <div>
                <label className="label">Iznos (KM)</label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm font-medium pointer-events-none">KM</span>
                  <input type="number" step="0.01" min="0" className="input pl-7" value={newExpense.amount} onChange={(e) => setNewExpense((p) => ({ ...p, amount: Number(e.target.value) }))} />
                </div>
              </div>
              {/* Monthly split */}
              <div className="bg-slate-50 rounded-xl p-3 border border-slate-200">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[12px] font-semibold text-slate-600">Raspodijeli po miesecima</span>
                  <button
                    type="button"
                    onClick={() => setSplitMonths(v => v <= 1 ? 2 : 1)}
                    className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${splitMonths > 1 ? "bg-[#003580]" : "bg-slate-300"}`}
                  >
                    <span className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white shadow transition-transform ${splitMonths > 1 ? "translate-x-4" : "translate-x-0.5"}`} />
                  </button>
                </div>
                {splitMonths > 1 && (
                  <div className="flex items-center gap-3 mt-1">
                    <div className="flex items-center gap-2">
                      <label className="text-xs text-slate-500">Broj mieseci:</label>
                      <input
                        type="number" min="2" max="60"
                        value={splitMonths}
                        onChange={e => setSplitMonths(Math.max(2, parseInt(e.target.value) || 2))}
                        className="w-16 bg-white border border-slate-200 rounded-lg px-2 py-1 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#003580]/20 focus:border-[#003580]"
                      />
                    </div>
                    <div className="text-xs text-slate-500">
                      = <span className="font-semibold text-[#003580]">{(newExpense.amount / splitMonths).toFixed(2)} KM</span> / miesec
                    </div>
                  </div>
                )}
              </div>
              <ReceiptUpload value={expensePhoto} onChange={setExpensePhoto} />
            </div>
            <div className="flex gap-3 justify-end mt-6 pt-4 border-t border-slate-100">
              <button onClick={() => { setShowExpenseModal(false); setSplitMonths(1); }} className="btn-secondary">Odustani</button>
              <button onClick={saveExpense} disabled={savingExpense} className="btn-primary">
                {savingExpense ? "Čuvanje..." : "Dodaj trošak"}
              </button>
            </div>
          </div>
        </div>
      )}

      <ReceiptLightbox url={lightboxUrl} onClose={() => setLightboxUrl(null)} />

      {/* ── Stanje vozila (damage) modal ── */}
      {showDamageModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl flex flex-col max-h-[95vh]">
            <div className="flex items-center justify-between px-6 py-4 border-b border-[#E7E7E7] flex-shrink-0">
              <div>
                <h2 className="text-lg font-bold text-slate-800">Stanje vozila</h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  {vehicle.make} {vehicle.model} · {vehicleDamages.length === 0 ? "Nema evidentiranih oštećenja" : `${vehicleDamages.length} oštećenje(a)`}
                </p>
              </div>
              <button onClick={() => setShowDamageModal(false)} className="text-slate-400 hover:text-slate-600 p-1 rounded-lg hover:bg-slate-100 transition-colors">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
                </svg>
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-4">
              <CarDamageInspector
                damages={vehicleDamages}
                onChange={setVehicleDamages}
                vehicleMake={vehicle.make}
                vehicleModel={vehicle.model}
              />
            </div>
            <div className="flex gap-3 justify-end px-6 py-4 border-t border-[#E7E7E7] flex-shrink-0">
              <button onClick={() => setShowDamageModal(false)} className="btn-secondary">Odustani</button>
              <button onClick={saveDamages} disabled={savingDamages} className="btn-primary">
                {savingDamages ? "Čuvanje..." : "Spremi stanje"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
