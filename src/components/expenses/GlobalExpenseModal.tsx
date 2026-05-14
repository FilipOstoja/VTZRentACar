"use client";

import { useState, useEffect } from "react";
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

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onSaved?: () => void;
}

export default function GlobalExpenseModal({ isOpen, onClose, onSaved }: Props) {
  const supabase = createClient();
  const [vehicleCount, setVehicleCount] = useState(0);
  const [saving, setSaving] = useState(false);
  const [splitMonths, setSplitMonths] = useState(1);
  const [form, setForm] = useState({
    description: "",
    type: "other",
    total_amount: 0,
    vendor: "",
    date: new Date().toISOString().slice(0, 10),
  });
  const [photo, setPhoto] = useState<File | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    supabase
      .from("vehicles")
      .select("id", { count: "exact", head: true })
      .then(({ count }) => setVehicleCount(count || 0));
  }, [isOpen]);

  const reset = () => {
    setForm({
      description: "",
      type: "other",
      total_amount: 0,
      vendor: "",
      date: new Date().toISOString().slice(0, 10),
    });
    setPhoto(null);
    setSplitMonths(1);
  };

  const save = async () => {
    if (!form.description.trim() || form.total_amount <= 0) return;

    setSaving(true);
    try {
      // 1. Snapshot current vehicles
      const { data: vehicles } = await supabase.from("vehicles").select("id");
      if (!vehicles || vehicles.length === 0) {
        alert("Nema vozila u floti.");
        setSaving(false);
        return;
      }

      // 2. Upload receipt photo if provided
      const imagePath = await uploadReceipt(supabase, photo, "global");

      // 3. Get current user for created_by
      const { data: { user } } = await supabase.auth.getUser();

      // 4. Insert parent global_expenses row
      const { data: parent, error: parentErr } = await supabase
        .from("global_expenses")
        .insert({
          description: form.description,
          type: form.type,
          total_amount: form.total_amount,
          vendor: form.vendor || null,
          date: form.date,
          image_url: imagePath,
          vehicle_count: vehicles.length,
          created_by: user?.id || null,
        })
        .select()
        .single();

      if (parentErr || !parent) {
        console.error(parentErr);
        alert("Greška kod spremanja globalnog troška.");
        setSaving(false);
        return;
      }

      // 5. Fan out into N child vehicle_expenses rows (with optional monthly split)
      const months = Math.max(1, splitMonths);
      const perVehiclePerMonth = Number((form.total_amount / vehicles.length / months).toFixed(2));
      const baseDate = new Date(form.date);
      const rows = vehicles.flatMap((v) =>
        Array.from({ length: months }, (_, i) => {
          const d = new Date(baseDate);
          d.setMonth(d.getMonth() + i);
          return {
            vehicle_id: v.id,
            date: d.toISOString().slice(0, 10),
            type: form.type,
            description: form.description,
            vendor: form.vendor || null,
            amount: perVehiclePerMonth,
            image_url: imagePath,
            global_expense_id: parent.id,
          };
        })
      );

      const { error: childErr } = await supabase.from("vehicle_expenses").insert(rows);
      if (childErr) {
        console.error(childErr);
        alert("Greška kod podjele po vozilima.");
        setSaving(false);
        return;
      }

      reset();
      setSaving(false);
      onSaved?.();
      onClose();
    } catch (err) {
      console.error(err);
      setSaving(false);
    }
  };

  if (!isOpen) return null;

  const perVehicle = vehicleCount > 0 ? form.total_amount / vehicleCount : 0;

  return (
    <div
      className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-2xl shadow-xl max-w-md w-full max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-6 py-5 border-b border-ink-150 flex items-center justify-between">
          <div>
            <h2 className="text-lg font-bold text-brand-500">Globalni trošak</h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Podijeljen ravnomjerno na {vehicleCount} {vehicleCount === 1 ? "vozilo" : vehicleCount < 5 ? "vozila" : "vozila"}
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-700 transition-colors w-8 h-8 flex items-center justify-center rounded-lg hover:bg-slate-100"
          >
            ✕
          </button>
        </div>

        <div className="p-6 space-y-4">
          <div>
            <label className="block text-[11px] font-semibold text-slate-500 mb-1.5 uppercase tracking-wide">
              Opis *
            </label>
            <input
              type="text"
              placeholder="npr. Reklamna kampanja Q2"
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-slate-800 text-sm placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[11px] font-semibold text-slate-500 mb-1.5 uppercase tracking-wide">
                Tip
              </label>
              <select
                value={form.type}
                onChange={(e) => setForm({ ...form, type: e.target.value })}
                className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-slate-800 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500"
              >
                {TYPES.map((t) => (
                  <option key={t.value} value={t.value}>{t.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-[11px] font-semibold text-slate-500 mb-1.5 uppercase tracking-wide">
                Datum
              </label>
              <input
                type="date"
                value={form.date}
                onChange={(e) => setForm({ ...form, date: e.target.value })}
                className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-slate-800 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[11px] font-semibold text-slate-500 mb-1.5 uppercase tracking-wide">
                Ukupan iznos (€) *
              </label>
              <input
                type="number"
                step="0.01"
                min="0"
                placeholder="npr. 100.00"
                value={form.total_amount || ""}
                onChange={(e) => setForm({ ...form, total_amount: parseFloat(e.target.value) || 0 })}
                className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-slate-800 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500"
              />
              {form.total_amount > 0 && (
                <p className="text-[11px] text-slate-400 mt-1">≈ {(form.total_amount * 1.9583).toFixed(2)} KM</p>
              )}
            </div>
            <div>
              <label className="block text-[11px] font-semibold text-slate-500 mb-1.5 uppercase tracking-wide">
                Po vozilu
              </label>
              <div className="w-full bg-blue-50 border border-blue-100 rounded-lg px-3 py-2 text-brand-500 text-sm font-bold">
                {(perVehicle * 1.9583).toFixed(2)} KM
              </div>
            </div>
          </div>

          <div>
            <label className="block text-[11px] font-semibold text-slate-500 mb-1.5 uppercase tracking-wide">
              Dobavljač
            </label>
            <input
              type="text"
              placeholder="npr. Google Ads"
              value={form.vendor}
              onChange={(e) => setForm({ ...form, vendor: e.target.value })}
              className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-slate-800 text-sm placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500"
            />
          </div>

          {/* Monthly split */}
          <div className="bg-slate-50 rounded-xl p-3 border border-slate-200">
            <div className="flex items-center justify-between mb-1">
              <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wide">Raspodijeli po mjesecima</span>
              <button
                type="button"
                onClick={() => setSplitMonths(v => v <= 1 ? 2 : 1)}
                className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${splitMonths > 1 ? "bg-brand-500" : "bg-slate-300"}`}
              >
                <span className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white shadow transition-transform ${splitMonths > 1 ? "translate-x-4" : "translate-x-0.5"}`} />
              </button>
            </div>
            {splitMonths > 1 && (
              <div className="flex items-center gap-3 mt-2">
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
                    className="w-16 bg-white border border-slate-200 rounded-lg px-2 py-1 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-brand-500/20"
                  />
                </div>
                {splitMonths >= 2 && (
                  <div className="text-xs text-slate-500">
                    = <span className="font-semibold text-brand-500">{vehicleCount > 0 ? (form.total_amount / vehicleCount / splitMonths * 1.9583).toFixed(2) : "0.00"} KM</span> / vozilo / mjesec
                  </div>
                )}
              </div>
            )}
          </div>

          <ReceiptUpload value={photo} onChange={setPhoto} />
        </div>

        <div className="px-6 py-4 border-t border-ink-150 flex justify-end gap-2">
          <button
            onClick={onClose}
            disabled={saving}
            className="px-4 py-2 rounded-lg text-sm font-semibold text-slate-600 hover:bg-slate-100 transition-colors"
          >
            Odustani
          </button>
          <button
            onClick={save}
            disabled={saving || !form.description.trim() || form.total_amount <= 0}
            className="px-5 py-2 rounded-lg text-sm font-semibold bg-brand-500 text-white hover:bg-brand-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {saving ? "Spremanje..." : "Spremi i podijeli"}
          </button>
        </div>
      </div>
    </div>
  );
}
