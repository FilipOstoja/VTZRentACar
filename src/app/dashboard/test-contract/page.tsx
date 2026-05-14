"use client";

import { useState } from "react";
import type { ContractData } from "@/components/RentalContractPDF";

// ─── Sample contract data ──────────────────────────────────────────────────────
const SAMPLE: ContractData = {
  contractNumber: "VTZ-2026-00042",
  date: "07.05.2026.",
  vehicleMake: "Volkswagen",
  vehicleModel: "Golf 8",
  vehicleRegistration: "A12-K-345",
  vehicleColor: "Siva",
  vehicleYear: 2022,
  clientName: "Marko Marković",
  clientPhone: "+387 61 234 567",
  clientEmail: "marko.markovic@email.ba",
  clientIdNumber: "0507990170012",
  clientDriversLicense: "0612345",
  startDate: "2026-05-08",
  endDate: "2026-05-15",
  pickupKm: 45200,
  dailyRate: 65,
  totalDays: 7,
  totalAmount: 455,
  depositAmount: 200,
  damages: [
    { note: "Ogrebotina na prednjem lijevom branikу — dužina cca 8 cm" },
    { note: "Mala udubina na stražnjim lijevim vratima, u visini kvake" },
  ],
};

export default function TestContractPage() {
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);

  const download = async () => {
    setLoading(true);
    setDone(false);
    try {
      const [{ RentalContractPDF }, { pdf }] = await Promise.all([
        import("@/components/RentalContractPDF"),
        import("@react-pdf/renderer"),
      ]);
      const React = (await import("react")).default;
      const blob = await pdf(React.createElement(RentalContractPDF, { data: SAMPLE }) as React.ReactElement<any>).toBlob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `ugovor-${SAMPLE.contractNumber}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
      setDone(true);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-ink-50 flex items-center justify-center p-8">
      <div className="bg-white border border-ink-150 rounded-2xl shadow-sm max-w-xl w-full p-8 space-y-6">

        <div>
          <h1 className="text-xl font-bold text-brand-500">Test — Ugovor o najmu (PDF)</h1>
          <p className="text-sm text-slate-500 mt-1">
            Prikazuje kako će izgledati ugovor koji se automatski generiše pri kreiranju najma.
          </p>
        </div>

        {/* Preview of the data that will be in the contract */}
        <div className="bg-slate-50 border border-ink-150 rounded-xl p-5 space-y-4 text-sm">

          <div>
            <p className="text-[11px] font-bold text-slate-400 uppercase tracking-widest mb-2">Vozilo</p>
            <div className="grid grid-cols-2 gap-y-1">
              <span className="text-slate-500">Model:</span>
              <span className="font-semibold text-slate-800">{SAMPLE.vehicleMake} {SAMPLE.vehicleModel} ({SAMPLE.vehicleYear})</span>
              <span className="text-slate-500">Registracija:</span>
              <span className="font-semibold font-mono text-brand-500">{SAMPLE.vehicleRegistration}</span>
              <span className="text-slate-500">Boja:</span>
              <span className="text-slate-700">{SAMPLE.vehicleColor}</span>
            </div>
          </div>

          <div className="border-t border-ink-150" />

          <div>
            <p className="text-[11px] font-bold text-slate-400 uppercase tracking-widest mb-2">Klijent</p>
            <div className="grid grid-cols-2 gap-y-1">
              <span className="text-slate-500">Ime:</span>
              <span className="font-semibold text-slate-800">{SAMPLE.clientName}</span>
              <span className="text-slate-500">Telefon:</span>
              <span className="text-slate-700">{SAMPLE.clientPhone}</span>
              <span className="text-slate-500">Email:</span>
              <span className="text-slate-700">{SAMPLE.clientEmail}</span>
              <span className="text-slate-500">Br. vozačke:</span>
              <span className="text-slate-700">{SAMPLE.clientDriversLicense}</span>
            </div>
          </div>

          <div className="border-t border-ink-150" />

          <div>
            <p className="text-[11px] font-bold text-slate-400 uppercase tracking-widest mb-2">Uvjeti najma</p>
            <div className="grid grid-cols-2 gap-y-1">
              <span className="text-slate-500">Period:</span>
              <span className="font-semibold text-slate-800">{SAMPLE.startDate} → {SAMPLE.endDate}</span>
              <span className="text-slate-500">Broj dana:</span>
              <span className="text-slate-700">{SAMPLE.totalDays} dana</span>
              <span className="text-slate-500">Dnevna tarifa:</span>
              <span className="text-slate-700">€{SAMPLE.dailyRate}</span>
              <span className="text-slate-500">Depozit:</span>
              <span className="text-slate-700">€{SAMPLE.depositAmount}</span>
              <span className="text-slate-500">Ukupno:</span>
              <span className="text-xl font-bold text-brand-500">€{SAMPLE.totalAmount}</span>
            </div>
          </div>

          <div className="border-t border-ink-150" />

          <div>
            <p className="text-[11px] font-bold text-slate-400 uppercase tracking-widest mb-2">
              Oštećenja pri preuzimanju ({SAMPLE.damages?.length})
            </p>
            {SAMPLE.damages?.map((d, i) => (
              <div key={i} className="flex gap-2 mb-1.5">
                <span className="w-5 h-5 rounded-full bg-orange-500 text-white text-[10px] font-bold flex items-center justify-center flex-shrink-0">{i + 1}</span>
                <span className="text-slate-600 text-xs leading-relaxed">{d.note}</span>
              </div>
            ))}
          </div>
        </div>

        <button
          onClick={download}
          disabled={loading}
          className="btn-primary w-full justify-center py-3 text-base"
        >
          {loading ? (
            <span className="flex items-center gap-2">
              <svg className="animate-spin w-4 h-4" viewBox="0 0 24 24" fill="none">
                <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" strokeDasharray="60" strokeDashoffset="20" strokeLinecap="round"/>
              </svg>
              Generiranje PDF-a...
            </span>
          ) : (
            <span className="flex items-center gap-2">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/>
                <polyline points="14 2 14 8 20 8"/>
                <line x1="12" y1="18" x2="12" y2="12"/>
                <polyline points="9 15 12 18 15 15"/>
              </svg>
              Preuzmi testni ugovor (PDF)
            </span>
          )}
        </button>

        {done && (
          <p className="text-center text-sm text-emerald-600 font-medium">
            ✓ PDF uspješno preuzet!
          </p>
        )}

        <p className="text-xs text-slate-400 text-center">
          Ova stranica je samo za testiranje — dostupna na{" "}
          <code className="bg-slate-100 px-1 rounded">/dashboard/test-contract</code>
        </p>
      </div>
    </div>
  );
}
