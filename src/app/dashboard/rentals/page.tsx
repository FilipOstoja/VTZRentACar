"use client";

import { useState, useEffect, useMemo } from "react";
import { createClient } from "@/lib/supabase/client";
import { CarDamageInspector, DamagePin } from "@/components/CarDamageInspector";
import ContractPreviewModal from "@/components/ContractPreviewModal";
import clsx from "clsx";
import type { ContractData } from "@/components/RentalContractPDF";

interface Rental {
  id: string;
  vehicle_id: string;
  client_id: string;
  start_date: string;
  end_date: string;
  pickup_km?: number;
  daily_rate: number;
  total_days?: number;
  total_amount?: number;
  deposit_amount?: number;
  status: string;
  damage_report_out?: { pins: DamagePin[] } | null;
  damage_report_in?: { pins: DamagePin[] } | null;
  vehicles?: { make: string; model: string; registration: string; persistent_damage?: { pins: DamagePin[] } };
  clients?: { full_name: string; phone?: string; is_blacklisted: boolean };
}
interface Vehicle {
  id: string; make: string; model: string; registration: string;
  status: string; daily_rate: number; current_km?: number;
  persistent_damage?: { pins: DamagePin[] };
}
interface Client {
  id: string; full_name: string; phone?: string; email?: string; is_blacklisted: boolean;
}

interface NewClientForm {
  first_name: string;
  last_name: string;
  email: string;
  phone: string;
  id_number: string;
  drivers_license: string;
  license_photo_front: string | null;
  license_photo_back: string | null;
}

type Step = 0 | 1 | 2;
type ClientMode = "existing" | "new";

const STATUS_BADGE: Record<string, string> = {
  active:    "bg-blue-100 text-blue-700",
  completed: "bg-emerald-100 text-emerald-700",
  cancelled: "bg-slate-100 text-slate-500",
};
const STATUS_LABEL: Record<string, string> = {
  active: "Aktivan", completed: "Završen", cancelled: "Otkazan",
};

function ModalLabel({ children }: { children: React.ReactNode }) {
  return (
    <label className="block text-[11px] font-semibold text-slate-500 mb-1.5 uppercase tracking-wide">
      {children}
    </label>
  );
}
function ModalInput(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      {...props}
      className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-slate-800 text-sm placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-[#003580]/20 focus:border-[#003580] transition-all"
    />
  );
}
function ModalSelect(props: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select
      {...props}
      className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-slate-800 text-sm focus:outline-none focus:ring-2 focus:ring-[#003580]/20 focus:border-[#003580] transition-all"
    />
  );
}

export default function RentalsPage() {
  const [rentals, setRentals]   = useState<Rental[]>([]);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [clients, setClients]   = useState<Client[]>([]);
  const [loading, setLoading]   = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [step, setStep]           = useState<Step>(1);
  const [saving, setSaving]       = useState(false);

  const [returnModal, setReturnModal]     = useState(false);
  const [returnRental, setReturnRental]   = useState<Rental | null>(null);
  const [returnDamages, setReturnDamages] = useState<DamagePin[]>([]);
  const [returning, setReturning]         = useState(false);
  const [syncDamagesToVehicle, setSyncDamagesToVehicle] = useState(false);

  const [contractPreview, setContractPreview] = useState<{ data: ContractData; clientEmail?: string } | null>(null);

  const [scanning, setScanning] = useState(false);
  const [scanError, setScanError] = useState<string | null>(null);

  const scanLicense = async (imageBase64: string) => {
    setScanning(true);
    setScanError(null);
    try {
      const res = await fetch("/api/scan-license", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ imageBase64 }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.detail?.error?.message || json.error || "Skeniranje nije uspjelo");
      const { extracted } = json;
      setNewClientForm((p) => ({
        ...p,
        first_name:      extracted.first_name      || p.first_name,
        last_name:       extracted.last_name        || p.last_name,
        id_number:       extracted.id_number        || p.id_number,
        drivers_license: extracted.license_number   || p.drivers_license,
      }));
    } catch (err) {
      setScanError(err instanceof Error ? err.message : "Nije moguće pročitati podatke — unesite ručno");
    } finally {
      setScanning(false);
    }
  };

  const [clientMode, setClientMode] = useState<ClientMode>("existing");
  const [newClientForm, setNewClientForm] = useState<NewClientForm>({
    first_name: "", last_name: "", email: "", phone: "",
    id_number: "", drivers_license: "",
    license_photo_front: null, license_photo_back: null,
  });

  const [form, setForm] = useState({
    vehicle_id: "", client_id: "",
    start_date: new Date().toISOString().split("T")[0],
    end_date: "", pickup_km: 0, deposit_amount: 200, daily_rate: 0,
  });
  const [damages, setDamages] = useState<DamagePin[]>([]);

  const supabase = createClient();

  const load = async () => {
    setLoading(true);
    const [{ data: r }, { data: v }, { data: c }] = await Promise.all([
      supabase.from("rentals")
        .select("*, vehicles(make, model, registration, persistent_damage), clients(full_name, phone, is_blacklisted)")
        .order("created_at", { ascending: false }).limit(50),
      supabase.from("vehicles")
        .select("id, make, model, registration, status, daily_rate, current_km, persistent_damage")
        .neq("status", "inactive"),
      supabase.from("clients")
        .select("id, full_name, phone, email, is_blacklisted").eq("is_blacklisted", false).order("full_name"),
    ]);
    setRentals(r || []); setVehicles(v || []); setClients(c || []);
    setLoading(false);
  };
  useEffect(() => { load(); }, []);

  // Compute booked vehicle IDs from already-loaded rentals — no extra query needed
  const bookedIds = useMemo(() => {
    const start = form.start_date;
    const end   = form.end_date || form.start_date;
    if (!start) return new Set<string>();
    return new Set(
      rentals
        .filter((r) => r.status === "active" && r.start_date <= end && r.end_date >= start)
        .map((r) => r.vehicle_id)
    );
  }, [rentals, form.start_date, form.end_date]);

  // Vehicles physically available for the chosen period
  const availableVehicles = useMemo(() =>
    vehicles.filter(
      (v) => v.status !== "service" && v.status !== "washing" && !bookedIds.has(v.id)
    ),
    [vehicles, bookedIds]
  );

  const selectedVehicle = vehicles.find((v) => v.id === form.vehicle_id);
  const totalDays = form.start_date && form.end_date
    ? Math.max(1, Math.ceil((new Date(form.end_date).getTime() - new Date(form.start_date).getTime()) / 86400000))
    : 0;
  const dailyRate = Number(selectedVehicle?.daily_rate) || Number(form.daily_rate) || 0;
  const totalAmount = totalDays * dailyRate;
  const newClientValid = newClientForm.first_name.trim() !== "" && newClientForm.last_name.trim() !== "";
  const step1Valid = form.vehicle_id && form.end_date && totalDays > 0 &&
    (clientMode === "existing" ? !!form.client_id : newClientValid);

  const handleVehicleSelect = (id: string) => {
    const v = vehicles.find((v) => v.id === id);
    setForm((prev) => ({ ...prev, vehicle_id: id, daily_rate: v?.daily_rate || 0, pickup_km: v?.current_km || 0 }));
  };

  const handleStartDateChange = (val: string) => {
    setForm((prev) => ({
      ...prev,
      start_date: val,
      // reset end_date if it would now be before the new start
      end_date: prev.end_date && prev.end_date < val ? "" : prev.end_date,
      // also clear selected vehicle — availability may have changed
      vehicle_id: "",
      daily_rate: 0,
      pickup_km: 0,
    }));
  };

  const handleEndDateChange = (val: string) => {
    if (val < form.start_date) return; // silently block past-start selection
    setForm((prev) => ({
      ...prev,
      end_date: val,
      vehicle_id: "",
      daily_rate: 0,
      pickup_km: 0,
    }));
  };

  const openModal = () => {
    setForm({ vehicle_id: "", client_id: "", start_date: new Date().toISOString().split("T")[0], end_date: "", pickup_km: 0, deposit_amount: 200, daily_rate: 0 });
    setClientMode("existing");
    setScanError(null);
    setNewClientForm({ first_name: "", last_name: "", email: "", phone: "", id_number: "", drivers_license: "", license_photo_front: null, license_photo_back: null });
    setDamages([]); setStep(0); setShowModal(true);
  };
  const save = async () => {
    setSaving(true);
    let clientId = form.client_id;

    if (clientMode === "new") {
      const { data: newClient } = await supabase.from("clients").insert({
        client_type: "individual",
        full_name: `${newClientForm.first_name.trim()} ${newClientForm.last_name.trim()}`,
        email: newClientForm.email || null,
        phone: newClientForm.phone || null,
        id_number: newClientForm.id_number || null,
        drivers_license: newClientForm.drivers_license || null,
        is_blacklisted: false,
      }).select().single();
      if (!newClient) { setSaving(false); return; }
      clientId = newClient.id;
    }

    const { data: rental } = await supabase.from("rentals").insert({
      ...form, client_id: clientId, total_days: totalDays, total_amount: totalAmount, status: "active",
      damage_report_out: damages.length > 0 ? { pins: damages } : null,
    }).select().single();
    if (rental) await supabase.from("vehicles").update({ status: "rented" }).eq("id", form.vehicle_id);
    setSaving(false); setShowModal(false); load();
    return { rental, clientId };
  };

  const buildContractData = (clientId: string): ContractData => {
    const clientData = clientMode === "existing"
      ? clients.find((c) => c.id === clientId)
      : null;
    const clientName = clientMode === "new"
      ? `${newClientForm.first_name.trim()} ${newClientForm.last_name.trim()}`
      : (clientData?.full_name ?? "");

    const contractNum = `VTZ-${new Date().getFullYear()}-${String(Date.now()).slice(-5)}`;
    const today = new Date().toLocaleDateString("hr-HR");

    return {
      contractNumber: contractNum,
      date: today,
      vehicleMake: selectedVehicle?.make ?? "",
      vehicleModel: selectedVehicle?.model ?? "",
      vehicleRegistration: selectedVehicle?.registration ?? "",
      clientName,
      clientPhone: clientMode === "new" ? newClientForm.phone : clientData?.phone,
      clientEmail: clientMode === "new" ? newClientForm.email : clientData?.email,
      clientIdNumber: clientMode === "new" ? newClientForm.id_number : undefined,
      clientDriversLicense: clientMode === "new" ? newClientForm.drivers_license : undefined,
      startDate: form.start_date,
      endDate: form.end_date,
      pickupKm: form.pickup_km,
      dailyRate,
      totalDays,
      totalAmount,
      depositAmount: form.deposit_amount,
      damages: damages.map((d) => ({ note: d.note })),
    };
  };

  const saveAndDownload = async () => {
    setSaving(true);
    let clientId = form.client_id;

    if (clientMode === "new") {
      const { data: newClient } = await supabase.from("clients").insert({
        client_type: "individual",
        full_name: `${newClientForm.first_name.trim()} ${newClientForm.last_name.trim()}`,
        email: newClientForm.email || null,
        phone: newClientForm.phone || null,
        id_number: newClientForm.id_number || null,
        drivers_license: newClientForm.drivers_license || null,
        is_blacklisted: false,
      }).select().single();
      if (!newClient) { setSaving(false); return; }
      clientId = newClient.id;
    }

    await supabase.from("rentals").insert({
      ...form, client_id: clientId, total_days: totalDays, total_amount: totalAmount, status: "active",
      damage_report_out: damages.length > 0 ? { pins: damages } : null,
    });
    await supabase.from("vehicles").update({ status: "rented" }).eq("id", form.vehicle_id);

    const contractData = buildContractData(clientId);
    const clientEmail = clientMode === "new"
      ? (newClientForm.email || undefined)
      : (clients.find((c) => c.id === clientId)?.email || undefined);

    setSaving(false);
    setShowModal(false);
    load();
    setContractPreview({ data: contractData, clientEmail });
  };
  const openReturnModal = (rental: Rental) => {
    setReturnRental(rental); setReturnDamages([]); setSyncDamagesToVehicle(false); setReturnModal(true);
  };
  const saveReturn = async () => {
    if (!returnRental) return;
    setReturning(true);
    await supabase.from("rentals").update({
      status: "completed",
      damage_report_in: returnDamages.length > 0 ? { pins: returnDamages } : null,
    }).eq("id", returnRental.id);

    if (syncDamagesToVehicle && returnDamages.length > 0) {
      const { data: veh } = await supabase
        .from("vehicles").select("persistent_damage").eq("id", returnRental.vehicle_id).single();
      const existing: DamagePin[] = (veh?.persistent_damage as { pins: DamagePin[] } | null)?.pins ?? [];
      await supabase.from("vehicles").update({
        status: "free",
        persistent_damage: { pins: [...existing, ...returnDamages] },
      }).eq("id", returnRental.vehicle_id);
    } else {
      await supabase.from("vehicles").update({ status: "free" }).eq("id", returnRental.vehicle_id);
    }

    setReturning(false); setReturnModal(false); setReturnRental(null); setReturnDamages([]); setSyncDamagesToVehicle(false); load();
  };

  const activeCount = rentals.filter((r) => r.status === "active").length;

  return (
    <div className="min-h-screen bg-[#F7F9FC]">
      <div className="p-4 sm:p-6 max-w-[1440px] mx-auto space-y-4 sm:space-y-6">

        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-end gap-3 sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold text-[#003580] tracking-tight">Kratkoročni najam</h1>
            <p className="text-sm text-slate-500 mt-0.5">{activeCount} aktivnih najma</p>
          </div>
          <button onClick={openModal} className="btn-primary self-start sm:self-auto">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
            </svg>
            Novi najam
          </button>
        </div>

        {/* Table */}
        <div className="bg-white border border-[#E7E7E7] rounded-xl shadow-sm overflow-hidden">
          {loading ? (
            <div className="py-16 text-center text-slate-400 text-sm">Učitavanje...</div>
          ) : rentals.length === 0 ? (
            <div className="py-16 text-center text-slate-400 text-sm">Nema najma</div>
          ) : (
            <table className="w-full">
              <thead className="bg-slate-50 border-b border-[#E7E7E7]">
                <tr>
                  {["Vozilo", "Klijent", "Od", "Do", "Dana", "Iznos", "Oštećenja", "Status", ""].map((h) => (
                    <th key={h} className="table-header">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rentals.map((r) => {
                  const pickupCount = r.damage_report_out?.pins?.length ?? 0;
                  const returnCount = r.damage_report_in?.pins?.length  ?? 0;
                  const isOverdue   = r.status === "active" && r.end_date < new Date().toISOString().split("T")[0];
                  return (
                    <tr key={r.id} className={clsx("hover:bg-slate-50 transition-colors", isOverdue && "bg-red-50/50")}>
                      <td className="table-cell">
                        <div className="font-semibold text-slate-800">{r.vehicles?.make} {r.vehicles?.model}</div>
                        <div className="text-xs font-mono text-[#003580] font-semibold">{r.vehicles?.registration}</div>
                      </td>
                      <td className="table-cell">
                        <div className="text-slate-700">{r.clients?.full_name}</div>
                        <div className="text-xs text-slate-400">{r.clients?.phone}</div>
                      </td>
                      <td className="table-cell text-slate-500">{r.start_date}</td>
                      <td className={clsx("table-cell", isOverdue ? "text-red-600 font-semibold" : "text-slate-500")}>{r.end_date}</td>
                      <td className="table-cell text-slate-600">{r.total_days}d</td>
                      <td className="table-cell font-semibold text-slate-800">
                        {r.total_amount != null && isFinite(r.total_amount) ? `${r.total_amount.toFixed(2)} KM` : <span className="text-slate-300">—</span>}
                      </td>
                      <td className="table-cell">
                        {pickupCount > 0 || returnCount > 0 ? (
                          <div className="flex flex-col gap-0.5">
                            {pickupCount > 0 && (
                              <span className="text-xs bg-orange-50 text-orange-600 border border-orange-200 px-2 py-0.5 rounded-full font-medium whitespace-nowrap">
                                ↑ {pickupCount} preuzimanje
                              </span>
                            )}
                            {returnCount > 0 && (
                              <span className="text-xs bg-indigo-50 text-indigo-600 border border-indigo-200 px-2 py-0.5 rounded-full font-medium whitespace-nowrap">
                                ↓ {returnCount} povratak
                              </span>
                            )}
                          </div>
                        ) : <span className="text-slate-300">—</span>}
                      </td>
                      <td className="table-cell">
                        <span className={clsx("text-[10px] font-bold px-2 py-0.5 rounded-full uppercase", STATUS_BADGE[r.status])}>
                          {isOverdue ? "Prekoračen" : STATUS_LABEL[r.status]}
                        </span>
                      </td>
                      <td className="table-cell">
                        {r.status === "active" && (
                          <button
                            onClick={() => openReturnModal(r)}
                            className="text-xs bg-emerald-50 text-emerald-700 border border-emerald-200 px-3 py-1.5 rounded-lg hover:bg-emerald-100 transition-colors font-semibold whitespace-nowrap"
                          >
                            Zatvori
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* ── New rental modal ── */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm animate-fade-in">
          <div className="bg-white border border-[#E7E7E7] rounded-2xl shadow-2xl w-full max-w-2xl animate-slide-up flex flex-col max-h-[92vh]">

            {/* Header */}
            <div className="flex items-center justify-between px-6 pt-6 pb-4 border-b border-[#E7E7E7] flex-shrink-0">
              <div>
                <h2 className="text-lg font-bold text-slate-800">Novi kratkoročni najam</h2>
                {step > 0 && (
                  <div className="flex items-center gap-2 mt-1.5">
                    <button
                      onClick={() => setStep(1)}
                      className={clsx("flex items-center gap-1.5 text-xs font-semibold transition-colors", step === 1 ? "text-[#003580]" : step1Valid ? "text-slate-400 hover:text-slate-700 cursor-pointer" : "text-slate-300 cursor-default")}
                    >
                      <span className={clsx("w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold", step === 1 ? "bg-[#003580] text-white" : step1Valid ? "bg-slate-200 text-slate-600" : "bg-slate-100 text-slate-400")}>1</span>
                      Detalji najma
                    </button>
                    <span className="text-slate-300">›</span>
                    <span className={clsx("flex items-center gap-1.5 text-xs font-semibold", step === 2 ? "text-[#003580]" : "text-slate-400")}>
                      <span className={clsx("w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold", step === 2 ? "bg-[#003580] text-white" : "bg-slate-100 text-slate-400")}>2</span>
                      Pregled vozila
                      {damages.length > 0 && <span className="bg-amber-500 text-white text-[10px] rounded-full px-1.5">{damages.length}</span>}
                    </span>
                  </div>
                )}
              </div>
              <button onClick={() => setShowModal(false)} className="text-slate-400 hover:text-slate-600 p-1 rounded-lg hover:bg-slate-100 transition-colors">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
                </svg>
              </button>
            </div>

            {/* Body */}
            <div className="overflow-y-auto flex-1 px-6 py-5">

              {/* ── Step 0: client type selection ── */}
              {step === 0 && (
                <div className="flex flex-col items-center justify-center py-4">
                  <p className="text-sm text-slate-500 mb-6">Odaberite tip klijenta za ovaj najam</p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 w-full max-w-md">
                    {/* New client */}
                    <button
                      type="button"
                      onClick={() => { setClientMode("new"); setStep(1); }}
                      className="group flex flex-col items-center gap-3 p-6 rounded-2xl border-2 border-emerald-200 bg-emerald-50 hover:border-emerald-400 hover:bg-emerald-100 transition-all active:scale-95"
                    >
                      <div className="w-16 h-16 rounded-full bg-emerald-500 flex items-center justify-center shadow-md shadow-emerald-200 group-hover:scale-105 transition-transform">
                        <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M16 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx="8.5" cy="7" r="4"/>
                          <line x1="20" y1="8" x2="20" y2="14"/><line x1="23" y1="11" x2="17" y2="11"/>
                        </svg>
                      </div>
                      <div className="text-center">
                        <div className="text-sm font-bold text-emerald-800">Novi klijent</div>
                        <div className="text-xs text-emerald-600 mt-0.5">Skeniraj vozačku + unesi podatke</div>
                      </div>
                    </button>
                    {/* Existing client */}
                    <button
                      type="button"
                      onClick={() => { setClientMode("existing"); setStep(1); }}
                      className="group flex flex-col items-center gap-3 p-6 rounded-2xl border-2 border-[#003580]/20 bg-[#003580]/5 hover:border-[#003580]/40 hover:bg-[#003580]/10 transition-all active:scale-95"
                    >
                      <div className="w-16 h-16 rounded-full bg-[#003580] flex items-center justify-center shadow-md shadow-[#003580]/20 group-hover:scale-105 transition-transform">
                        <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/>
                          <path d="M23 21v-2a4 4 0 00-3-3.87"/><path d="M16 3.13a4 4 0 010 7.75"/>
                        </svg>
                      </div>
                      <div className="text-center">
                        <div className="text-sm font-bold text-[#003580]">Postojeći klijent</div>
                        <div className="text-xs text-[#003580]/60 mt-0.5">Odaberi iz baze klijenata</div>
                      </div>
                    </button>
                  </div>
                </div>
              )}

              {step === 1 && (
                <div className="space-y-4">

                  {/* New client: photos FIRST, then fields */}
                  {clientMode === "new" && (
                    <div className="bg-slate-50 border border-[#E7E7E7] rounded-xl p-4 space-y-4">

                      {/* 1. Photo upload */}
                      <div>
                        <div className="flex items-center justify-between mb-2">
                          <ModalLabel>Fotografija vozačke dozvole</ModalLabel>
                          {newClientForm.license_photo_front && (
                            <button
                              type="button"
                              onClick={() => scanLicense(newClientForm.license_photo_front!)}
                              disabled={scanning}
                              className="flex items-center gap-1.5 text-[11px] font-semibold px-2.5 py-1 rounded-lg bg-[#003580] text-white hover:bg-[#00256a] disabled:opacity-60 transition-colors"
                            >
                              {scanning ? (
                                <>
                                  <svg className="animate-spin w-3 h-3" viewBox="0 0 24 24" fill="none">
                                    <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" strokeDasharray="60" strokeDashoffset="20" strokeLinecap="round"/>
                                  </svg>
                                  Skeniranje...
                                </>
                              ) : (
                                <>
                                  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                    <rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/>
                                  </svg>
                                  Skeniraj podatke
                                </>
                              )}
                            </button>
                          )}
                        </div>
                        {scanError && <p className="text-[11px] text-amber-600 mb-1.5 font-medium">{scanError}</p>}
                        <div className="grid grid-cols-2 gap-2">
                          {/* Front */}
                          <label className="relative cursor-pointer group">
                            <input type="file" accept="image/*" capture="environment" className="hidden"
                              onChange={(e) => {
                                const file = e.target.files?.[0];
                                if (!file) return;
                                const reader = new FileReader();
                                reader.onload = () => { const dataUrl = reader.result as string; setNewClientForm((p) => ({ ...p, license_photo_front: dataUrl })); scanLicense(dataUrl); };
                                reader.readAsDataURL(file);
                              }}
                            />
                            {newClientForm.license_photo_front ? (
                              <div className="relative">
                                <img src={newClientForm.license_photo_front} alt="Prednja strana" className="w-full h-28 object-cover rounded-xl border border-slate-200" />
                                <span className="absolute bottom-1.5 left-1.5 bg-black/60 text-white text-[10px] px-2 py-0.5 rounded-full font-medium">Prednja ✓</span>
                              </div>
                            ) : (
                              <div className="flex flex-col items-center justify-center h-28 border-2 border-dashed border-slate-300 group-hover:border-emerald-400 rounded-xl transition-colors bg-white">
                                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="group-hover:stroke-emerald-500 transition-colors">
                                  <rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/>
                                </svg>
                                <span className="text-[11px] text-slate-400 mt-2 group-hover:text-emerald-600 transition-colors font-medium">Prednja strana</span>
                                <span className="text-[10px] text-slate-300 mt-0.5">Tapni za foto</span>
                              </div>
                            )}
                          </label>
                          {/* Back */}
                          <label className="relative cursor-pointer group">
                            <input type="file" accept="image/*" capture="environment" className="hidden"
                              onChange={(e) => {
                                const file = e.target.files?.[0];
                                if (!file) return;
                                const reader = new FileReader();
                                reader.onload = () => setNewClientForm((p) => ({ ...p, license_photo_back: reader.result as string }));
                                reader.readAsDataURL(file);
                              }}
                            />
                            {newClientForm.license_photo_back ? (
                              <div className="relative">
                                <img src={newClientForm.license_photo_back} alt="Stražnja strana" className="w-full h-28 object-cover rounded-xl border border-slate-200" />
                                <span className="absolute bottom-1.5 left-1.5 bg-black/60 text-white text-[10px] px-2 py-0.5 rounded-full font-medium">Stražnja ✓</span>
                              </div>
                            ) : (
                              <div className="flex flex-col items-center justify-center h-28 border-2 border-dashed border-slate-300 group-hover:border-slate-400 rounded-xl transition-colors bg-white">
                                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                                  <rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/>
                                </svg>
                                <span className="text-[11px] text-slate-400 mt-2 font-medium">Stražnja strana</span>
                                <span className="text-[10px] text-slate-300 mt-0.5">Tapni za foto</span>
                              </div>
                            )}
                          </label>
                        </div>
                        {scanning && (
                          <p className="text-[11px] text-[#003580] mt-2 font-medium animate-pulse">AI čita podatke s vozačke dozvole...</p>
                        )}
                      </div>

                      {/* 2. Fields (auto-filled or manual) */}
                      <div>
                        <div className="flex items-center gap-2 mb-2">
                          <ModalLabel>Podaci klijenta</ModalLabel>
                          {(newClientForm.first_name || newClientForm.last_name) && (
                            <span className="text-[10px] font-bold text-emerald-600 bg-emerald-50 border border-emerald-200 px-1.5 py-0.5 rounded-full">Auto-popunjeno</span>
                          )}
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                          <div>
                            <ModalLabel>Ime <span className="text-red-400">*</span></ModalLabel>
                            <ModalInput placeholder="Marko" value={newClientForm.first_name} onChange={(e) => setNewClientForm((p) => ({ ...p, first_name: e.target.value }))} />
                          </div>
                          <div>
                            <ModalLabel>Prezime <span className="text-red-400">*</span></ModalLabel>
                            <ModalInput placeholder="Marković" value={newClientForm.last_name} onChange={(e) => setNewClientForm((p) => ({ ...p, last_name: e.target.value }))} />
                          </div>
                          <div>
                            <ModalLabel>Broj osobne iskaznice</ModalLabel>
                            <ModalInput placeholder="123456789" value={newClientForm.id_number} onChange={(e) => setNewClientForm((p) => ({ ...p, id_number: e.target.value }))} />
                          </div>
                          <div>
                            <ModalLabel>Broj vozačke dozvole</ModalLabel>
                            <ModalInput placeholder="B1234567" value={newClientForm.drivers_license} onChange={(e) => setNewClientForm((p) => ({ ...p, drivers_license: e.target.value }))} />
                          </div>
                          <div>
                            <ModalLabel>Email</ModalLabel>
                            <ModalInput type="email" placeholder="marko@email.com" value={newClientForm.email} onChange={(e) => setNewClientForm((p) => ({ ...p, email: e.target.value }))} />
                          </div>
                          <div>
                            <ModalLabel>Telefon</ModalLabel>
                            <ModalInput placeholder="+385 91 234 5678" value={newClientForm.phone} onChange={(e) => setNewClientForm((p) => ({ ...p, phone: e.target.value }))} />
                          </div>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Existing client dropdown */}
                  {clientMode === "existing" && (
                    <div>
                      <ModalLabel>Klijent</ModalLabel>
                      <ModalSelect value={form.client_id} onChange={(e) => setForm((p) => ({ ...p, client_id: e.target.value }))}>
                        <option value="">Odaberi klijenta...</option>
                        {clients.map((c) => (
                          <option key={c.id} value={c.id}>{c.full_name}{c.phone ? ` — ${c.phone}` : ""}</option>
                        ))}
                      </ModalSelect>
                    </div>
                  )}

                  {/* Dates + vehicle (shared) */}
                  <div>
                    <ModalLabel>
                      Vozilo — dostupna za period
                      {form.start_date && form.end_date ? ` (${form.start_date} → ${form.end_date})` : form.start_date ? ` od ${form.start_date}` : ""}
                    </ModalLabel>
                    <ModalSelect value={form.vehicle_id} onChange={(e) => handleVehicleSelect(e.target.value)} disabled={!form.start_date || !form.end_date}>
                      <option value="">{!form.end_date ? "Prvo odaberite datume..." : availableVehicles.length === 0 ? "Nema slobodnih vozila" : "Odaberi vozilo..."}</option>
                      {availableVehicles.map((v) => (
                        <option key={v.id} value={v.id}>{v.make} {v.model} — {v.registration} ({v.daily_rate} KM/dan)</option>
                      ))}
                    </ModalSelect>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <ModalLabel>Datum od</ModalLabel>
                      <ModalInput
                        type="date"
                        value={form.start_date}
                        min={new Date().toISOString().split("T")[0]}
                        onChange={(e) => handleStartDateChange(e.target.value)}
                      />
                    </div>
                    <div>
                      <ModalLabel>Datum do</ModalLabel>
                      <ModalInput
                        type="date"
                        value={form.end_date}
                        min={form.start_date}
                        onChange={(e) => handleEndDateChange(e.target.value)}
                      />
                    </div>
                    <div>
                      <ModalLabel>Kilometraža pri preuzimanju</ModalLabel>
                      <ModalInput type="number" value={form.pickup_km} onChange={(e) => setForm((p) => ({ ...p, pickup_km: Number(e.target.value) }))} />
                    </div>
                    <div>
                      <ModalLabel>Depozit (KM)</ModalLabel>
                      <ModalInput type="number" value={form.deposit_amount} onChange={(e) => setForm((p) => ({ ...p, deposit_amount: Number(e.target.value) }))} />
                    </div>
                  </div>
                  {step1Valid && (
                    <div className="bg-[#003580]/5 border border-[#003580]/15 rounded-xl p-4 space-y-2">
                      <h3 className="text-[11px] font-bold text-[#003580] uppercase tracking-wider">Pregled iznosa</h3>
                      <div className="flex justify-between text-sm">
                        <span className="text-slate-500">Broj dana:</span>
                        <span className="text-slate-800 font-semibold">{totalDays} dan(a)</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-slate-500">Dnevna tarifa:</span>
                        <div className="text-right">
                          <span className="text-slate-800 font-semibold">{dailyRate} KM</span>
                          <span className="text-slate-400 text-xs ml-1.5">≈ €{(dailyRate / 1.9583).toFixed(2)}</span>
                        </div>
                      </div>
                      <div className="flex justify-between text-sm font-bold border-t border-[#003580]/15 pt-2 mt-2">
                        <span className="text-slate-600">Ukupno:</span>
                        <div className="text-right">
                          <span className="text-[#003580] text-lg">{totalAmount.toFixed(2)} KM</span>
                          <div className="text-xs text-slate-400 font-normal">≈ €{(totalAmount / 1.9583).toFixed(2)}</div>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {step === 2 && (
                <div className="space-y-3">
                  <div className="bg-slate-50 border border-[#E7E7E7] rounded-xl p-3 flex items-center gap-3 text-sm">
                    <div className="w-8 h-8 rounded-lg bg-[#003580]/10 border border-[#003580]/20 flex items-center justify-center flex-shrink-0">
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#003580" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M5 17H3a2 2 0 01-2-2V9a2 2 0 012-2h16a2 2 0 012 2v6a2 2 0 01-2 2h-2"/>
                        <rect x="7" y="14" width="10" height="5" rx="2"/>
                      </svg>
                    </div>
                    <div>
                      <p className="text-slate-800 font-semibold">
                        {selectedVehicle?.make} {selectedVehicle?.model}
                        <span className="ml-2 text-[#003580] font-mono text-xs">{selectedVehicle?.registration}</span>
                      </p>
                      <p className="text-slate-500 text-xs">Označite sva postojeća oštećenja na vozilu prije predaje klijentu</p>
                    </div>
                  </div>
                  <CarDamageInspector
                    damages={damages}
                    onChange={setDamages}
                    vehicleMake={selectedVehicle?.make}
                    vehicleModel={selectedVehicle?.model}
                    preExistingDamages={selectedVehicle?.persistent_damage?.pins ?? []}
                  />
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="flex flex-col gap-2 px-4 sm:px-6 py-4 border-t border-[#E7E7E7] flex-shrink-0">
              {step === 2 && damages.length > 0 && (
                <p className="text-xs text-slate-500">
                  <span className="text-amber-600 font-semibold">{damages.length}</span> oštećenje(a) zabilježeno
                </p>
              )}
              <div className="flex flex-wrap gap-2 justify-end">
                <button onClick={() => setShowModal(false)} className="btn-secondary">Odustani</button>
                {step === 1 && (
                  <button onClick={() => setStep(2)} disabled={!step1Valid} className="btn-primary">
                    Dalje — Pregled vozila
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="9 18 15 12 9 6"/>
                    </svg>
                  </button>
                )}
                {step === 2 && (
                  <>
                    <button onClick={() => setStep(1)} className="btn-secondary">
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                        <polyline points="15 18 9 12 15 6"/>
                      </svg>
                      Natrag
                    </button>
                    <button onClick={save} disabled={saving} className="btn-secondary">
                      {saving ? "Kreiranje..." : "Kreiraj najam"}
                    </button>
                    <button onClick={saveAndDownload} disabled={saving} className="btn-primary">
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/>
                        <line x1="12" y1="18" x2="12" y2="12"/><polyline points="9 15 12 18 15 15"/>
                      </svg>
                      {saving ? "Generiranje..." : "Kreiraj + PDF"}
                    </button>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Contract preview modal ── */}
      {contractPreview && (
        <ContractPreviewModal
          contractData={contractPreview.data}
          clientEmail={contractPreview.clientEmail}
          onClose={() => setContractPreview(null)}
        />
      )}

      {/* ── Return inspection modal ── */}
      {returnModal && returnRental && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm animate-fade-in">
          <div className="bg-white border border-[#E7E7E7] rounded-2xl shadow-2xl w-full max-w-2xl animate-slide-up flex flex-col max-h-[92vh]">
            <div className="flex items-center justify-between px-6 pt-6 pb-4 border-b border-[#E7E7E7] flex-shrink-0">
              <div>
                <h2 className="text-lg font-bold text-slate-800">Povratni pregled vozila</h2>
                <p className="text-sm text-slate-500 mt-0.5">
                  {returnRental.vehicles?.make} {returnRental.vehicles?.model}
                  <span className="ml-2 text-[#003580] font-mono text-xs font-semibold">{returnRental.vehicles?.registration}</span>
                </p>
              </div>
              <button onClick={() => setReturnModal(false)} className="text-slate-400 hover:text-slate-600 p-1 rounded-lg hover:bg-slate-100 transition-colors">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
                </svg>
              </button>
            </div>
            <div className="overflow-y-auto flex-1 px-6 py-5">
              {(returnRental.damage_report_out?.pins?.length ?? 0) > 0 && (
                <div className="mb-4 bg-blue-50 border border-blue-200 rounded-xl p-3 text-xs text-slate-500 leading-relaxed">
                  <span className="text-blue-600 font-semibold">Plavi markeri</span> = oštećenja evidentirana pri preuzimanju.
                  {" "}Kliknite na auto da označite <span className="text-amber-600 font-semibold">nova oštećenja</span> pronađena pri povratku.
                </div>
              )}
              <CarDamageInspector
                damages={returnDamages}
                onChange={setReturnDamages}
                vehicleMake={returnRental.vehicles?.make}
                vehicleModel={returnRental.vehicles?.model}
                preExistingDamages={
                  returnRental.damage_report_out?.pins ??
                  returnRental.vehicles?.persistent_damage?.pins ??
                  []
                }
              />
            </div>
            <div className="flex flex-col gap-3 px-6 py-4 border-t border-[#E7E7E7] flex-shrink-0">
              {returnDamages.length > 0 ? (
                <label className="flex items-center gap-2.5 cursor-pointer select-none p-2.5 rounded-lg bg-amber-50 border border-amber-200">
                  <input
                    type="checkbox"
                    checked={syncDamagesToVehicle}
                    onChange={(e) => setSyncDamagesToVehicle(e.target.checked)}
                    className="w-4 h-4 rounded accent-amber-600"
                  />
                  <span className="text-xs text-amber-800 font-semibold">
                    Dodaj {returnDamages.length} nova oštećenja u stanje vozila (vidljivo u Stanje vozila)
                  </span>
                </label>
              ) : (
                <p className="text-xs text-slate-400">Nema novih oštećenja — vozilo vraćeno uredno</p>
              )}
              <div className="flex gap-3 justify-end">
                <button onClick={() => setReturnModal(false)} className="btn-secondary">Odustani</button>
                <button onClick={saveReturn} disabled={returning} className="btn-primary">
                  {returning ? "Zatvaranje..." : "Zatvori najam"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
