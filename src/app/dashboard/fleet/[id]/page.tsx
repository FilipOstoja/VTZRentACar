"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import clsx from "clsx";
import ReceiptUpload from "@/components/expenses/ReceiptUpload";
import { Skeleton } from "@/components/ui/Skeleton";
import ReceiptLightbox from "@/components/expenses/ReceiptLightbox";
import { uploadReceipt, getReceiptUrl } from "@/lib/receipts";
import { CarDamageInspector, type DamagePin } from "@/components/CarDamageInspector";
import { getVehiclePhoto } from "@/lib/vehiclePhoto";
import {
  isFilled,
  isValidYear,
  isPositiveNumber,
  isNonNegativeNumber,
  isValidRegistration,
  REQUIRED,
  INVALID_YEAR,
  MUST_BE_POSITIVE,
  MUST_BE_NON_NEGATIVE,
  REGISTRATION_TOO_SHORT,
  type ValidationErrors,
} from "@/lib/validation";

const MODEL_3D_OPTIONS: { key: string; label: string; sublabel: string }[] = [
  { key: "golf_8",        label: "Golf 8",        sublabel: "Hatchback" },
  { key: "passat_sedan",  label: "Passat Sedan",  sublabel: "Limuzina" },
  { key: "passat_estate", label: "Passat Estate", sublabel: "Karavan" },
  { key: "crafter",       label: "Crafter",       sublabel: "Kombi" },
];

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
  model_3d?: string | null;
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
  const [editErrors, setEditErrors] = useState<ValidationErrors>({});

  // Delete vehicle modal
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  // Add expense modal
  const [showExpenseModal, setShowExpenseModal] = useState(false);
  const [newExpense, setNewExpense] = useState({ ...emptyExpense });
  const [expensePhoto, setExpensePhoto] = useState<File | null>(null);
  const [savingExpense, setSavingExpense] = useState(false);
  const [splitMonths, setSplitMonths] = useState(1);
  const [newRegistrationExpiry, setNewRegistrationExpiry] = useState<string>("");
  const [expenseErrors, setExpenseErrors] = useState<ValidationErrors>({});

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
    if (expenseType === "registration") {
      const base = vehicle?.registration_expiry ? new Date(vehicle.registration_expiry) : new Date();
      if (base.getTime() < Date.now()) base.setTime(Date.now());
      base.setFullYear(base.getFullYear() + 1);
      setNewRegistrationExpiry(base.toISOString().slice(0, 10));
    }
    setShowExpenseModal(true);
    // Remove the param from the URL without navigation so it doesn't re-trigger
    const url = new URL(window.location.href);
    url.searchParams.delete("expense");
    window.history.replaceState({}, "", url.toString());
  }, [loading, searchParams, vehicle?.registration_expiry]);

  const validateVehicle = (v: Partial<Vehicle>): ValidationErrors => {
    const e: ValidationErrors = {};
    if (!isFilled(v.make)) e.make = REQUIRED;
    if (!isFilled(v.model)) e.model = REQUIRED;
    if (!isValidYear(v.year)) e.year = INVALID_YEAR;
    if (!isFilled(v.registration)) e.registration = REQUIRED;
    else if (!isValidRegistration(String(v.registration))) e.registration = REGISTRATION_TOO_SHORT;
    if (!isPositiveNumber(v.daily_rate)) e.daily_rate = MUST_BE_POSITIVE;
    if (!isNonNegativeNumber(v.current_km)) e.current_km = MUST_BE_NON_NEGATIVE;
    if (v.purchase_price != null && !isNonNegativeNumber(v.purchase_price)) e.purchase_price = MUST_BE_NON_NEGATIVE;
    return e;
  };

  const saveVehicle = async () => {
    if (!vehicle) return;
    const errs = validateVehicle(editingVehicle);
    setEditErrors(errs);
    if (Object.keys(errs).length > 0) return;
    setSaving(true);
    await supabase.from("vehicles").update({
      ...editingVehicle,
      daily_rate: Number(editingVehicle.daily_rate),
      current_km: Number(editingVehicle.current_km ?? 0),
      year: Number(editingVehicle.year),
      purchase_price: editingVehicle.purchase_price != null && editingVehicle.purchase_price !== 0
        ? Number(editingVehicle.purchase_price)
        : null,
      model_3d: editingVehicle.model_3d ?? null,
    }).eq("id", vehicle.id);
    setSaving(false);
    setShowEditModal(false);
    setEditErrors({});
    load();
  };

  const setEditField = (key: keyof Vehicle, val: any) => {
    setEditingVehicle((prev) => ({ ...prev, [key]: val }));
    if (editErrors[key as string]) {
      setEditErrors((prev) => { const n = { ...prev }; delete n[key as string]; return n; });
    }
  };

  const deleteVehicle = async () => {
    if (!vehicle) return;
    setDeleting(true);
    setDeleteError(null);
    const { error } = await supabase.from("vehicles").delete().eq("id", vehicle.id);
    setDeleting(false);
    if (error) {
      setDeleteError(
        rentals.length > 0
          ? "Vozilo ima istoriju najma i ne može se obrisati. Postavite status na 'Neaktivno' umjesto toga."
          : "Greška pri brisanju vozila. Pokušajte ponovo."
      );
      return;
    }
    router.push("/dashboard/fleet");
  };

  const validateExpense = (): ValidationErrors => {
    const e: ValidationErrors = {};
    if (!isFilled(newExpense.date)) e.date = REQUIRED;
    if (!isPositiveNumber(newExpense.amount)) e.amount = MUST_BE_POSITIVE;
    if (newExpense.type === "registration") {
      if (!isFilled(newRegistrationExpiry)) {
        e.new_registration_expiry = "Datum važenja nove registracije je obavezan";
      } else if (newRegistrationExpiry <= newExpense.date) {
        e.new_registration_expiry = "Novi datum mora biti nakon datuma plaćanja";
      }
    }
    return e;
  };

  const saveExpense = async () => {
    const errs = validateExpense();
    setExpenseErrors(errs);
    if (Object.keys(errs).length > 0) return;

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

    // If this is a Registracija expense, also update the vehicle's expiry date
    if (newExpense.type === "registration" && newRegistrationExpiry) {
      await supabase
        .from("vehicles")
        .update({ registration_expiry: newRegistrationExpiry })
        .eq("id", id);
    }

    setSavingExpense(false);
    setShowExpenseModal(false);
    setNewExpense({ ...emptyExpense });
    setExpensePhoto(null);
    setSplitMonths(1);
    setNewRegistrationExpiry("");
    setExpenseErrors({});
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
  const vehiclePhoto = vehicle ? getVehiclePhoto(vehicle.make, vehicle.model) : null;

  const totalExpenses = expenses.reduce((sum, e) => sum + e.amount, 0);

  const RENTAL_STATUS: Record<string, string> = {
    active: "bg-blue-100 text-blue-700",
    completed: "bg-emerald-100 text-emerald-700",
    cancelled: "bg-red-100 text-red-700",
    upcoming: "bg-amber-100 text-amber-700",
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-ink-50" aria-busy="true" aria-label="Učitavanje vozila">
        <div className="p-4 sm:p-6 max-w-[1440px] mx-auto space-y-5">
          {/* header skeleton */}
          <div className="flex items-center gap-3">
            <Skeleton className="w-9 h-9" rounded="lg" />
            <div className="space-y-2">
              <Skeleton className="h-6 w-48" />
              <Skeleton className="h-3 w-32" />
            </div>
          </div>
          {/* hero card skeleton */}
          <div className="bg-white border border-ink-150 rounded-xl shadow-sm p-5 flex flex-col sm:flex-row gap-5">
            <Skeleton className="w-full sm:w-64 h-40" rounded="lg" />
            <div className="flex-1 space-y-3">
              <Skeleton className="h-5 w-40" />
              <Skeleton className="h-3 w-24" />
              <div className="grid grid-cols-2 gap-3 pt-2">
                {Array.from({ length: 4 }).map((_, i) => (
                  <div key={i}>
                    <Skeleton className="h-2.5 w-16 mb-2" />
                    <Skeleton className="h-4 w-24" />
                  </div>
                ))}
              </div>
            </div>
          </div>
          {/* tabs skeleton */}
          <div className="bg-white border border-ink-150 rounded-xl shadow-sm p-5 space-y-4">
            <div className="flex gap-2">
              {Array.from({ length: 4 }).map((_, i) => (
                <Skeleton key={i} className="h-9 w-24" rounded="lg" />
              ))}
            </div>
            <Skeleton className="h-32 w-full" rounded="lg" />
          </div>
        </div>
      </div>
    );
  }

  if (!vehicle) {
    return (
      <div className="min-h-screen bg-ink-50 flex items-center justify-center">
        <div className="text-center">
          <p className="text-slate-500 mb-4">Vozilo nije pronađeno.</p>
          <button onClick={() => router.push("/dashboard/fleet")} className="btn-primary">Nazad na flotu</button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-ink-50">
      <div className="p-4 sm:p-6 max-w-[1200px] mx-auto space-y-4 sm:space-y-6">

        {/* Back nav */}
        <button
          onClick={() => router.push("/dashboard/fleet")}
          className="flex items-center gap-2 text-sm text-slate-500 hover:text-brand-500 transition-colors font-medium"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="15 18 9 12 15 6"/>
          </svg>
          Vozni park
        </button>

        {/* ── Hero card ── */}
        <div className="bg-white border border-ink-150 rounded-2xl shadow-sm overflow-hidden">
          <div className="grid grid-cols-1 lg:grid-cols-5">

            {/* Car visual */}
            <div className={clsx("relative lg:col-span-2 bg-gradient-to-br overflow-hidden min-h-[280px]", gradient)}>
              {/* Background photo (covers the whole card area) */}
              {vehiclePhoto ? (
                <img
                  src={vehiclePhoto}
                  alt={`${vehicle.make} ${vehicle.model}`}
                  className="absolute inset-0 w-full h-full object-cover"
                />
              ) : (
                <div className="absolute inset-0 flex items-center justify-center">
                  <svg viewBox="0 0 240 100" className="w-56 h-24 opacity-20 fill-white" xmlns="http://www.w3.org/2000/svg">
                    <path d="M30 65 L30 55 Q32 45 50 40 L80 30 Q100 20 130 20 L165 20 Q185 20 200 30 L215 40 Q225 45 225 55 L225 65 Q220 70 210 70 L200 70 Q198 60 185 60 Q172 60 170 70 L80 70 Q78 60 65 60 Q52 60 50 70 L40 70 Q30 70 30 65 Z"/>
                    <circle cx="65" cy="70" r="12" />
                    <circle cx="185" cy="70" r="12" />
                  </svg>
                </div>
              )}

              {/* Dark gradient overlay for text contrast */}
              {vehiclePhoto && (
                <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/40 to-black/30" />
              )}

              {/* Content layer */}
              <div className="relative h-full p-6 flex flex-col justify-between min-h-[280px]">
                <div className="flex items-start justify-between">
                  <span className={clsx(
                    "inline-flex px-2.5 py-1 rounded-full text-[11px] font-bold uppercase tracking-wide backdrop-blur-sm",
                    STATUS_BADGE[vehicle.status] ?? "bg-white/20 text-white"
                  )}>
                    {STATUS_LABELS[vehicle.status]}
                  </span>
                  {vehicle.registration_expiry && new Date(vehicle.registration_expiry) < new Date(Date.now() + 30 * 86400000) && (
                    <span className="bg-amber-400 text-amber-900 text-[10px] font-bold px-2 py-1 rounded-full shadow-lg">
                      REG. ISTIČE
                    </span>
                  )}
                </div>

                <div>
                  <h1 className="text-2xl font-bold text-white leading-tight drop-shadow-lg">{vehicle.make} {vehicle.model}</h1>
                  <p className="text-white/80 text-sm mt-0.5 drop-shadow">{vehicle.year} · {vehicle.color ?? "—"}</p>
                </div>
              </div>
            </div>

            {/* Specs grid */}
            <div className="lg:col-span-3 p-6 flex flex-col justify-between">
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-x-6 gap-y-5">
                {[
                  { label: "Registracija", value: vehicle.registration, mono: true },
                  { label: "Godište", value: String(vehicle.year) },
                  { label: "Dnevna tarifa", value: `${(Number(vehicle.daily_rate) * 1.9583).toFixed(2)} KM/dan` },
                  { label: "Trenutna km", value: vehicle.current_km ? `${vehicle.current_km.toLocaleString()} km` : "—" },
                  { label: "Reg. ističe", value: vehicle.registration_expiry ?? "—", warn: vehicle.registration_expiry ? new Date(vehicle.registration_expiry) < new Date(Date.now() + 30 * 86400000) : false },
                  { label: "Boja", value: vehicle.color ?? "—" },
                  { label: "Broj šasije", value: vehicle.chassis_number ?? "—", mono: true, span: true },
                ].map((s) => (
                  <div key={s.label} className={s.span ? "col-span-2 sm:col-span-1" : ""}>
                    <div className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-0.5">{s.label}</div>
                    <div className={clsx(
                      "text-sm font-semibold",
                      s.mono ? "font-mono text-brand-500" : "text-slate-800",
                      s.warn ? "text-amber-600" : ""
                    )}>
                      {s.value}
                    </div>
                  </div>
                ))}
              </div>

              {vehicle.notes && (
                <div className="mt-4 bg-slate-50 border border-ink-150 rounded-lg px-4 py-3 text-sm text-slate-500 italic">
                  {vehicle.notes}
                </div>
              )}

              <div className="flex flex-wrap gap-2 mt-5 pt-4 border-t border-ink-150">
                <button
                  onClick={() => { setEditingVehicle({ ...vehicle }); setEditErrors({}); setShowEditModal(true); }}
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
            { label: "Ukupno troškova", value: `${(totalExpenses * 1.9583).toLocaleString("hr-HR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} KM`, color: "text-red-600" },
            { label: "Broj stavki troškova", value: String(expenses.length), color: "text-slate-800" },
            { label: "Ukupno najma", value: String(rentals.length), color: "text-brand-500" },
            { label: "Prihod od najma", value: `${(rentals.reduce((s, r) => s + (isFinite(Number(r.total_amount)) ? Number(r.total_amount) : 0), 0) * 1.9583).toLocaleString("hr-HR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} KM`, color: "text-emerald-600" },
          ].map((s) => (
            <div key={s.label} className="bg-white border border-ink-150 rounded-xl shadow-sm p-4">
              <div className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-1">{s.label}</div>
              <div className={clsx("text-xl font-bold", s.color)}>{s.value}</div>
            </div>
          ))}
        </div>

        {/* ── Tabs ── */}
        <div className="bg-white border border-ink-150 rounded-2xl shadow-sm overflow-hidden">
          {/* Tab bar */}
          <div className="flex items-center justify-between px-5 border-b border-ink-150">
            <div className="flex gap-1">
              {(["expenses", "rentals"] as const).map((tab) => (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab)}
                  className={clsx(
                    "px-4 py-3.5 text-sm font-semibold transition-all border-b-2 -mb-px",
                    activeTab === tab
                      ? "text-brand-500 border-[#003580]"
                      : "text-slate-400 border-transparent hover:text-slate-700"
                  )}
                >
                  {tab === "expenses" ? "Troškovi" : "Povijest najma"}
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
                    <thead className="bg-slate-50 border-b border-ink-150">
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
                              <span>{(Number(e.amount) * 1.9583).toLocaleString("hr-HR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} KM</span>
                              {e.image_url && (
                                <button
                                  onClick={() => openReceipt(e.image_url)}
                                  className="text-brand-500 hover:text-[#002660] p-1 rounded hover:bg-blue-50 transition-colors"
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
                  <div className="px-5 py-3 bg-slate-50 border-t border-ink-150 flex items-center justify-between rounded-b-2xl">
                    <span className="text-xs text-slate-500">{expenses.length} stavki</span>
                    <span className="text-sm font-bold text-slate-800">
                      Ukupno: {(totalExpenses * 1.9583).toLocaleString("hr-HR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} KM
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
                    <thead className="bg-slate-50 border-b border-ink-150">
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
                            {isFinite(Number(r.total_amount)) ? `${(Number(r.total_amount) * 1.9583).toLocaleString("hr-HR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} KM` : "—"}
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
                  <div className="px-5 py-3 bg-slate-50 border-t border-ink-150 rounded-b-2xl">
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
          <div className="bg-white rounded-2xl border border-ink-150 shadow-2xl w-full max-w-2xl p-6 max-h-[90vh] overflow-y-auto">
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
                { label: "Marka",                key: "make",                type: "text",   required: true },
                { label: "Model",                key: "model",               type: "text",   required: true },
                { label: "Godište",              key: "year",                type: "number", required: true },
                { label: "Registracija",         key: "registration",        type: "text",   required: true },
                { label: "Broj šasije",          key: "chassis_number",      type: "text" },
                { label: "Boja",                 key: "color",               type: "text" },
                { label: "Dnevna tarifa (€)",    key: "daily_rate",          type: "number", required: true },
                { label: "Trenutna km",          key: "current_km",          type: "number" },
                { label: "Nabavna cijena (€)",   key: "purchase_price",      type: "number" },
                { label: "Registracija ističe",  key: "registration_expiry", type: "date" },
              ].map((f) => (
                <div key={f.key}>
                  <label className="block text-[11px] font-semibold text-slate-500 mb-1.5 uppercase tracking-wide">
                    {f.label}
                    {f.required && <span className="text-red-400 ml-1">*</span>}
                  </label>
                  <input
                    type={f.type}
                    className={clsx(
                      "w-full bg-slate-50 border rounded-lg px-3 py-2 text-slate-800 text-sm placeholder:text-slate-400 focus:outline-none focus:ring-2 transition-all",
                      editErrors[f.key]
                        ? "border-red-300 focus:ring-red-200 focus:border-red-400"
                        : "border-slate-200 focus:ring-brand-500/20 focus:border-brand-500"
                    )}
                    value={(editingVehicle as any)[f.key] ?? ""}
                    onChange={(e) => setEditField(f.key as keyof Vehicle, f.type === "number" ? Number(e.target.value) : e.target.value)}
                  />
                  {editErrors[f.key] && (
                    <p className="text-[11px] text-red-500 mt-1 font-medium">{editErrors[f.key]}</p>
                  )}
                </div>
              ))}
              <div>
                <label className="block text-[11px] font-semibold text-slate-500 mb-1.5 uppercase tracking-wide">Status</label>
                <select
                  className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-slate-800 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 transition-all"
                  value={editingVehicle.status ?? "free"}
                  onChange={(e) => setEditField("status", e.target.value)}
                >
                  {Object.entries(STATUS_LABELS).map(([k, v]) => (
                    <option key={k} value={k}>{v}</option>
                  ))}
                </select>
              </div>
            </div>

            {/* 3D model selector */}
            <div className="mt-5">
              <label className="block text-[11px] font-semibold text-slate-500 mb-2 uppercase tracking-wide">
                3D model za inspekciju oštećenja
              </label>
              <p className="text-[11px] text-slate-400 mb-3">
                Koristi se za 3D inspektor pri preuzimanju i povratku vozila.
              </p>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                <button
                  type="button"
                  onClick={() => setEditField("model_3d", null)}
                  className={clsx(
                    "flex flex-col items-center gap-1.5 p-3 rounded-xl border-2 transition-all active:scale-95",
                    !editingVehicle.model_3d
                      ? "border-slate-400 bg-slate-50 ring-2 ring-slate-200"
                      : "border-slate-200 bg-white hover:border-slate-300"
                  )}
                >
                  <div className="w-9 h-9 rounded-full bg-slate-200 flex items-center justify-center">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#64748b" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <line x1="18" y1="6" x2="6" y2="18"/>
                      <line x1="6" y1="6" x2="18" y2="18"/>
                    </svg>
                  </div>
                  <div className="text-center">
                    <div className="text-xs font-bold text-slate-700">Bez 3D modela</div>
                    <div className="text-[10px] text-slate-400">Dodaj kasnije</div>
                  </div>
                </button>
                {MODEL_3D_OPTIONS.map((m) => (
                  <button
                    key={m.key}
                    type="button"
                    onClick={() => setEditField("model_3d", m.key)}
                    className={clsx(
                      "flex flex-col items-center gap-1.5 p-3 rounded-xl border-2 transition-all active:scale-95",
                      editingVehicle.model_3d === m.key
                        ? "border-[#003580]/60 bg-brand-500/5 ring-2 ring-[#003580]/20"
                        : "border-slate-200 bg-white hover:border-[#003580]/30"
                    )}
                  >
                    <div className={clsx(
                      "w-9 h-9 rounded-full flex items-center justify-center",
                      editingVehicle.model_3d === m.key ? "bg-brand-500" : "bg-slate-100"
                    )}>
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none"
                        stroke={editingVehicle.model_3d === m.key ? "white" : "#64748b"}
                        strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M5 17H3a2 2 0 01-2-2V9a2 2 0 012-2h16a2 2 0 012 2v6a2 2 0 01-2 2h-2"/>
                        <rect x="7" y="14" width="10" height="5" rx="2"/>
                      </svg>
                    </div>
                    <div className="text-center">
                      <div className="text-xs font-bold text-slate-800">{m.label}</div>
                      <div className="text-[10px] text-slate-400">{m.sublabel}</div>
                    </div>
                  </button>
                ))}
              </div>
            </div>

            <div className="mt-4">
              <label className="block text-[11px] font-semibold text-slate-500 mb-1.5 uppercase tracking-wide">Napomene</label>
              <textarea
                className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-slate-800 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 transition-all min-h-[70px] resize-none"
                value={editingVehicle.notes ?? ""}
                onChange={(e) => setEditField("notes", e.target.value)}
              />
            </div>

            {/* Danger zone — delete */}
            <div className="mt-6 pt-4 border-t border-red-100 bg-red-50/30 -mx-6 px-6 pb-1 rounded-b-2xl">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <h3 className="text-xs font-bold text-red-700 uppercase tracking-wide">Opasna zona</h3>
                  <p className="text-[11px] text-slate-500 mt-0.5">
                    Brisanje vozila je trajno. Vozila s historijom najma ne mogu se obrisati.
                  </p>
                </div>
                <button
                  onClick={() => { setDeleteError(null); setShowDeleteConfirm(true); }}
                  className="px-3 py-1.5 bg-white border border-red-300 text-red-700 text-xs font-semibold rounded-lg hover:bg-red-50 transition-colors whitespace-nowrap"
                >
                  Obriši vozilo
                </button>
              </div>
            </div>

            <div className="flex gap-3 justify-end mt-4 pt-4 border-t border-slate-100">
              <button onClick={() => setShowEditModal(false)} className="btn-secondary">Odustani</button>
              <button onClick={saveVehicle} disabled={saving} className="btn-primary">
                {saving ? "Čuvanje..." : "Spremi promjene"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Delete confirmation modal ── */}
      {showDeleteConfirm && vehicle && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-fade-in">
          <div className="bg-white rounded-2xl border border-ink-150 shadow-2xl w-full max-w-md p-6 animate-slide-up">
            <div className="flex items-start gap-3 mb-4">
              <div className="w-10 h-10 rounded-full bg-red-100 flex items-center justify-center flex-shrink-0">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#dc2626" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/>
                  <line x1="12" y1="9" x2="12" y2="13"/>
                  <line x1="12" y1="17" x2="12.01" y2="17"/>
                </svg>
              </div>
              <div className="flex-1 min-w-0">
                <h2 className="text-lg font-bold text-slate-800">Obrisati vozilo?</h2>
                <p className="text-sm text-slate-500 mt-1">
                  <span className="font-semibold text-slate-700">{vehicle.make} {vehicle.model}</span>
                  <span className="ml-1 font-mono text-brand-500">({vehicle.registration})</span>
                </p>
              </div>
            </div>
            <p className="text-sm text-slate-600 leading-relaxed">
              Ova radnja je trajna i ne može se poništiti. Svi troškovi vezani za ovo vozilo bit će zadržani u sistemu, ali samo vozilo neće više biti dostupno.
            </p>
            {rentals.length > 0 && (
              <div className="mt-3 bg-amber-50 border border-amber-200 rounded-lg p-3 text-xs text-amber-800">
                <span className="font-semibold">Pažnja:</span> ovo vozilo ima {rentals.length} {rentals.length === 1 ? "zapis najma" : "zapisa najma"}. Brisanje će vjerovatno biti odbijeno — razmotrite postavljanje statusa na "Neaktivno" umjesto toga.
              </div>
            )}
            {deleteError && (
              <div className="mt-3 bg-red-50 border border-red-200 rounded-lg p-3 text-xs text-red-700 font-medium">
                {deleteError}
              </div>
            )}
            <div className="flex gap-3 justify-end mt-5">
              <button
                onClick={() => setShowDeleteConfirm(false)}
                disabled={deleting}
                className="btn-secondary"
              >
                Odustani
              </button>
              <button
                onClick={deleteVehicle}
                disabled={deleting}
                className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white font-semibold rounded-lg text-sm transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {deleting ? "Brisanje..." : "Da, obriši trajno"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Add expense modal ── */}
      {showExpenseModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
          <div className="bg-white rounded-2xl border border-ink-150 shadow-2xl w-full max-w-md max-h-[92vh] flex flex-col">
            <div className="flex items-center justify-between px-6 pt-6 pb-4 border-b border-slate-100 flex-shrink-0">
              <h2 className="text-lg font-bold text-slate-800">Novi trošak</h2>
              <button onClick={() => setShowExpenseModal(false)} className="text-slate-400 hover:text-slate-600 p-1 rounded-lg hover:bg-slate-100 transition-colors">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
                </svg>
              </button>
            </div>
            <div className="flex-1 overflow-y-auto px-6 py-5 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="label">Datum <span className="text-red-400">*</span></label>
                  <input
                    type="date"
                    className={clsx(
                      "input",
                      expenseErrors.date && "border-red-300 focus:ring-red-200 focus:border-red-400"
                    )}
                    value={newExpense.date}
                    onChange={(e) => {
                      setNewExpense((p) => ({ ...p, date: e.target.value }));
                      if (expenseErrors.date) setExpenseErrors((p) => { const n = { ...p }; delete n.date; return n; });
                    }}
                  />
                  {expenseErrors.date && <p className="text-[11px] text-red-500 mt-1 font-medium">{expenseErrors.date}</p>}
                </div>
                <div>
                  <label className="label">Tip troška</label>
                  <select
                    className="input"
                    value={newExpense.type}
                    onChange={(e) => {
                      const newType = e.target.value;
                      setNewExpense((p) => ({ ...p, type: newType }));
                      // When switching to registration, suggest a default new expiry: 1 year after current expiry, or today+1y
                      if (newType === "registration" && !newRegistrationExpiry) {
                        const base = vehicle?.registration_expiry
                          ? new Date(vehicle.registration_expiry)
                          : new Date();
                        if (base.getTime() < Date.now()) base.setTime(Date.now());
                        base.setFullYear(base.getFullYear() + 1);
                        setNewRegistrationExpiry(base.toISOString().slice(0, 10));
                      }
                    }}
                  >
                    {Object.entries(EXPENSE_TYPE_LABELS).map(([k, v]) => (
                      <option key={k} value={k}>{v}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Conditional: registration expiry picker — shows when type === "registration" */}
              {newExpense.type === "registration" && (
                <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-3.5">
                  <label className="block text-[11px] font-semibold text-emerald-700 mb-1.5 uppercase tracking-wide">
                    Nova registracija važi do <span className="text-red-400">*</span>
                  </label>
                  <input
                    type="date"
                    min={newExpense.date}
                    className={clsx(
                      "w-full bg-white border rounded-lg px-3 py-2 text-slate-800 text-sm focus:outline-none focus:ring-2 transition-all",
                      expenseErrors.new_registration_expiry
                        ? "border-red-300 focus:ring-red-200 focus:border-red-400"
                        : "border-emerald-200 focus:ring-emerald-200 focus:border-emerald-400"
                    )}
                    value={newRegistrationExpiry}
                    onChange={(e) => {
                      setNewRegistrationExpiry(e.target.value);
                      if (expenseErrors.new_registration_expiry) {
                        setExpenseErrors((p) => { const n = { ...p }; delete n.new_registration_expiry; return n; });
                      }
                    }}
                  />
                  {expenseErrors.new_registration_expiry ? (
                    <p className="text-[11px] text-red-500 mt-1 font-medium">{expenseErrors.new_registration_expiry}</p>
                  ) : (
                    <p className="text-[11px] text-emerald-700 mt-1.5 font-medium">
                      Automatski ažurira polje "Registracija ističe" na vozilu
                    </p>
                  )}
                  {vehicle?.registration_expiry && (
                    <p className="text-[11px] text-slate-500 mt-1">
                      Trenutno važi do: <span className="font-mono font-semibold">{vehicle.registration_expiry}</span>
                    </p>
                  )}
                </div>
              )}

              <div>
                <label className="label">Opis</label>
                <input type="text" className="input" placeholder="Kratki opis troška..." value={newExpense.description} onChange={(e) => setNewExpense((p) => ({ ...p, description: e.target.value }))} />
              </div>
              <div>
                <label className="label">Dobavljač / servis</label>
                <input type="text" className="input" placeholder="npr. Auto Servis Petrović" value={newExpense.vendor} onChange={(e) => setNewExpense((p) => ({ ...p, vendor: e.target.value }))} />
              </div>
              <div>
                <label className="label">Iznos (€) <span className="text-red-400">*</span></label>
                <input
                  type="number" step="0.01" min="0"
                  className={clsx(
                    "input",
                    expenseErrors.amount && "border-red-300 focus:ring-red-200 focus:border-red-400"
                  )}
                  placeholder="npr. 50.00"
                  value={newExpense.amount || ""}
                  onChange={(e) => {
                    setNewExpense((p) => ({ ...p, amount: Number(e.target.value) }));
                    if (expenseErrors.amount) setExpenseErrors((p) => { const n = { ...p }; delete n.amount; return n; });
                  }}
                />
                {newExpense.amount > 0 && (
                  <p className="text-[11px] text-slate-400 mt-1">≈ {(newExpense.amount * 1.9583).toFixed(2)} KM</p>
                )}
                {expenseErrors.amount && <p className="text-[11px] text-red-500 mt-1 font-medium">{expenseErrors.amount}</p>}
              </div>
              {/* Monthly split */}
              <div className="bg-slate-50 rounded-xl p-3 border border-slate-200">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[12px] font-semibold text-slate-600">Raspodijeli po mjesecima</span>
                  <button
                    type="button"
                    onClick={() => setSplitMonths(v => v <= 1 ? 2 : 1)}
                    className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${splitMonths > 1 ? "bg-brand-500" : "bg-slate-300"}`}
                  >
                    <span className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white shadow transition-transform ${splitMonths > 1 ? "translate-x-4" : "translate-x-0.5"}`} />
                  </button>
                </div>
                {splitMonths > 1 && (
                  <div className="flex items-center gap-3 mt-1">
                    <div className="flex items-center gap-2">
                      <label className="text-xs text-slate-500">Broj mjeseci:</label>
                      <input
                        type="number" min="2" max="60"
                        value={splitMonths || ""}
                        onChange={e => {
                          const raw = e.target.value;
                          if (raw === "") { setSplitMonths(0); return; }
                          const n = parseInt(raw, 10);
                          setSplitMonths(isNaN(n) ? 0 : n);
                        }}
                        onBlur={() => { if (splitMonths < 2) setSplitMonths(2); }}
                        className="w-16 bg-white border border-slate-200 rounded-lg px-2 py-1 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500"
                      />
                    </div>
                    {splitMonths >= 2 && (
                      <div className="text-xs text-slate-500">
                        = <span className="font-semibold text-brand-500">{(newExpense.amount / splitMonths * 1.9583).toFixed(2)} KM</span> / mjesec
                      </div>
                    )}
                  </div>
                )}
              </div>
              <ReceiptUpload value={expensePhoto} onChange={setExpensePhoto} />
            </div>
            <div className="flex gap-3 justify-end px-6 py-4 border-t border-slate-100 flex-shrink-0 bg-white rounded-b-2xl">
              <button
                onClick={() => {
                  setShowExpenseModal(false);
                  setSplitMonths(1);
                  setNewRegistrationExpiry("");
                  setExpenseErrors({});
                }}
                className="btn-secondary"
              >
                Odustani
              </button>
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
            <div className="flex items-center justify-between px-6 py-4 border-b border-ink-150 flex-shrink-0">
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
                vehicleModel3d={vehicle.model_3d}
              />
            </div>
            <div className="flex gap-3 justify-end px-6 py-4 border-t border-ink-150 flex-shrink-0">
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
