"use client";

import { useState, useRef } from "react";
import { createClient } from "@/lib/supabase/client";
import { uploadReceipt } from "@/lib/receipts";
import ReceiptUpload from "./ReceiptUpload";

const TYPES = [
  { value: "fuel", label: "Gorivo" },
  { value: "maintenance", label: "Servis" },
  { value: "insurance", label: "Osiguranje" },
  { value: "registration", label: "Registracija" },
  { value: "washing", label: "Pranje" },
  { value: "tyre", label: "Gume" },
  { value: "other", label: "Ostalo" },
];

interface Vehicle {
  id: string;
  make: string;
  model: string;
  registration: string;
}

interface Props {
  vehicles: Vehicle[];
  onSaved?: () => void;
}

export default function QuickAddRow({ vehicles, onSaved }: Props) {
  const supabase = createClient();
  const [vehicleId, setVehicleId] = useState("");
  const [type, setType] = useState("fuel");
  const [amount, setAmount] = useState<number>(0);
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [description, setDescription] = useState("");
  const [photo, setPhoto] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);
  const [flash, setFlash] = useState<"success" | "error" | null>(null);
  const amountRef = useRef<HTMLInputElement>(null);

  const reset = () => {
    setAmount(0);
    setDescription("");
    setPhoto(null);
    setDate(new Date().toISOString().slice(0, 10));
  };

  const save = async () => {
    if (!vehicleId || amount <= 0) {
      setFlash("error");
      setTimeout(() => setFlash(null), 1500);
      return;
    }
    setSaving(true);
    const imagePath = await uploadReceipt(supabase, photo, "vehicles");
    const { error } = await supabase.from("vehicle_expenses").insert({
      vehicle_id: vehicleId,
      date,
      type,
      description: description || null,
      amount,
      image_url: imagePath,
    });
    setSaving(false);

    if (error) {
      console.error(error);
      setFlash("error");
      setTimeout(() => setFlash(null), 1500);
      return;
    }

    setFlash("success");
    setTimeout(() => setFlash(null), 1500);
    reset();
    amountRef.current?.focus();
    onSaved?.();
  };

  return (
    <div className="bg-blue-50/40 border-b border-blue-100 px-4 py-3">
      <div className="flex items-center gap-2 mb-2">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="text-[#003580]">
          <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
        </svg>
        <span className="text-[11px] font-semibold text-[#003580] uppercase tracking-wider">Brzi unos troška</span>
      </div>
      <div className="flex flex-wrap items-end gap-2">
        <div className="flex-1 min-w-[160px]">
          <select
            value={vehicleId}
            onChange={(e) => setVehicleId(e.target.value)}
            className="w-full bg-white border border-slate-200 rounded-lg px-2.5 py-2 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#003580]/20 focus:border-[#003580]"
          >
            <option value="">— Odaberi vozilo —</option>
            {vehicles.map((v) => (
              <option key={v.id} value={v.id}>
                {v.make} {v.model} ({v.registration})
              </option>
            ))}
          </select>
        </div>
        <select
          value={type}
          onChange={(e) => setType(e.target.value)}
          className="bg-white border border-slate-200 rounded-lg px-2.5 py-2 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#003580]/20 focus:border-[#003580]"
        >
          {TYPES.map((t) => (
            <option key={t.value} value={t.value}>{t.label}</option>
          ))}
        </select>
        <input
          ref={amountRef}
          type="number"
          step="0.01"
          min="0"
          placeholder="KM"
          value={amount || ""}
          onChange={(e) => setAmount(parseFloat(e.target.value) || 0)}
          onKeyDown={(e) => e.key === "Enter" && save()}
          className="w-24 bg-white border border-slate-200 rounded-lg px-2.5 py-2 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#003580]/20 focus:border-[#003580]"
        />
        <input
          type="date"
          value={date}
          onChange={(e) => setDate(e.target.value)}
          className="bg-white border border-slate-200 rounded-lg px-2.5 py-2 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#003580]/20 focus:border-[#003580]"
        />
        <input
          type="text"
          placeholder="Opis (opcionalno)"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && save()}
          className="flex-1 min-w-[140px] bg-white border border-slate-200 rounded-lg px-2.5 py-2 text-sm text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-[#003580]/20 focus:border-[#003580]"
        />
        <ReceiptUpload value={photo} onChange={setPhoto} compact />
        <button
          onClick={save}
          disabled={saving || !vehicleId || amount <= 0}
          className={`px-4 py-2 rounded-lg text-sm font-semibold transition-colors shadow-sm ${
            flash === "success"
              ? "bg-emerald-500 text-white"
              : flash === "error"
              ? "bg-red-500 text-white"
              : "bg-[#003580] text-white hover:bg-[#002660] disabled:opacity-50 disabled:cursor-not-allowed"
          }`}
        >
          {saving ? "..." : flash === "success" ? "✓ Spremljeno" : flash === "error" ? "Greška" : "Spremi"}
        </button>
      </div>
    </div>
  );
}
