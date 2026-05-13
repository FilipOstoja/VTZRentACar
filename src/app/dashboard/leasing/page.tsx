"use client";

import { useState, useEffect } from "react";
import { calculateLeasing, formatCurrency, formatPct, LeasingInputs, LeasingResults } from "@/lib/leasing";
import { createClient } from "@/lib/supabase/client";

const DEFAULT_INPUTS: LeasingInputs = {
  vehiclePrice: 50000,
  downPaymentPct: 0.15,
  annualInterestRate: 0.07,
  periodMonths: 48,
  kaskoYearly: 1315.79,
  aoYearly: 561.80,
  tyresTotal: 7000,
  serviceTotal: 1600,
  adminTotal: 2000,
  marginPct: 0.17,
  vatPct: 0.17,
  residualValue: 80000,
};

// ── Local components ────────────────────────────────────────

function InputField({
  label, sublabel, value, onChange, prefix, suffix, type = "number", step = "any", min,
}: {
  label: string; sublabel?: string; value: number; onChange: (v: number) => void;
  prefix?: string; suffix?: string; type?: string; step?: string; min?: number;
}) {
  return (
    <div className="space-y-1">
      <label className="block text-[11px] font-semibold text-slate-500 uppercase tracking-wide">
        {label}
        {sublabel && <span className="text-slate-400 ml-1 normal-case font-normal">{sublabel}</span>}
      </label>
      <div className="relative flex items-center">
        {prefix && <span className="absolute left-3 text-slate-400 text-sm font-medium pointer-events-none">{prefix}</span>}
        <input
          type={type} step={step} min={min} value={value}
          onChange={(e) => onChange(Number(e.target.value))}
          className={`input ${prefix ? "pl-7" : ""} ${suffix ? "pr-8" : ""}`}
        />
        {suffix && <span className="absolute right-3 text-slate-400 text-sm font-medium pointer-events-none">{suffix}</span>}
      </div>
    </div>
  );
}

function ResultRow({
  label, value, highlight = false, accent = false, sublabel,
}: {
  label: string; value: string; highlight?: boolean; accent?: boolean; sublabel?: string;
}) {
  return (
    <div className={`flex items-center justify-between py-2.5 px-3 rounded-lg ${
      accent   ? "bg-[#003580]/8 border border-[#003580]/15" :
      highlight ? "bg-slate-50" : ""
    }`}>
      <div>
        <span className={`text-sm ${accent ? "text-slate-800 font-semibold" : "text-slate-500"}`}>{label}</span>
        {sublabel && <div className="text-xs text-slate-400">{sublabel}</div>}
      </div>
      <span className={`font-mono text-sm font-semibold ${accent ? "text-[#003580] text-base" : "text-slate-800"}`}>
        {value}
      </span>
    </div>
  );
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <h3 className="text-[11px] font-bold uppercase tracking-widest text-slate-500 border-b border-[#E7E7E7] pb-2 mb-3">
      {children}
    </h3>
  );
}

// ── Page ───────────────────────────────────────────────────

export default function LeasingPage() {
  const [inputs, setInputs]                     = useState<LeasingInputs>(DEFAULT_INPUTS);
  const [results, setResults]                   = useState<LeasingResults | null>(null);
  const [vehicleDescription, setVehicleDescription] = useState("");
  const [clientSearch, setClientSearch]         = useState("");
  const [clients, setClients]                   = useState<any[]>([]);
  const [selectedClient, setSelectedClient]     = useState<any>(null);
  const [saving, setSaving]                     = useState(false);
  const [saved, setSaved]                       = useState(false);
  const supabase = createClient();

  const set = (key: keyof LeasingInputs) => (v: number) =>
    setInputs((prev) => ({ ...prev, [key]: v }));

  useEffect(() => { setResults(calculateLeasing(inputs)); }, [inputs]);

  useEffect(() => {
    const searchClients = async () => {
      if (clientSearch.length < 2) { setClients([]); return; }
      const { data } = await supabase.from("clients")
        .select("id, full_name, company_name").ilike("full_name", `%${clientSearch}%`).limit(5);
      setClients(data || []);
    };
    searchClients();
  }, [clientSearch]);

  const saveOffer = async () => {
    if (!results) return;
    setSaving(true);
    await supabase.from("leasing_offers").insert({
      client_id: selectedClient?.id || null,
      vehicle_description: vehicleDescription,
      vehicle_price: inputs.vehiclePrice,
      down_payment_pct: inputs.downPaymentPct,
      annual_interest_rate: inputs.annualInterestRate,
      period_months: inputs.periodMonths,
      kasko_yearly: inputs.kaskoYearly,
      ao_yearly: inputs.aoYearly,
      tyres_total: inputs.tyresTotal,
      service_total: inputs.serviceTotal,
      admin_total: inputs.adminTotal,
      margin_pct: inputs.marginPct,
      vat_pct: inputs.vatPct,
      residual_value: inputs.residualValue,
      monthly_financing_rate: results.monthlyFinancingRate,
      total_cost: results.totalCost,
      monthly_cost: results.monthlyCost,
      margin_amount: results.marginAmount,
      monthly_rent_no_vat: results.monthlyRentNoVat,
      monthly_rent_with_vat: results.monthlyRentWithVat,
      vtx_profit: results.vtzProfit,
      possible_profit: results.possibleProfit,
    });
    setSaving(false); setSaved(true);
    setTimeout(() => setSaved(false), 3000);
  };

  const reset = () => {
    setInputs(DEFAULT_INPUTS); setVehicleDescription(""); setSelectedClient(null); setClientSearch("");
  };

  if (!results) return null;

  return (
    <div className="min-h-screen bg-[#F7F9FC]">
      <div className="p-4 sm:p-6 max-w-[1440px] mx-auto space-y-4 sm:space-y-6">

        {/* Header */}
        <div className="flex items-end justify-between">
          <div>
            <h1 className="text-2xl font-bold text-[#003580] tracking-tight">Leasing Kalkulator</h1>
            <p className="text-sm text-slate-500 mt-0.5">Dugoročni najam — B2B kalkulator profitabilnosti</p>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={reset} className="btn-secondary">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 11-2.12-9.36L23 10"/>
              </svg>
              Reset
            </button>
            <button onClick={saveOffer} disabled={saving || saved} className="btn-primary">
              {saved ? (
                <>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
                  Spremljeno!
                </>
              ) : saving ? "Čuvanje..." : (
                <>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M19 21H5a2 2 0 01-2-2V5a2 2 0 012-2h11l5 5v11a2 2 0 01-2 2z"/>
                    <polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/>
                  </svg>
                  Spremi ponudu
                </>
              )}
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-5 gap-6">

          {/* ─── Inputs (3 cols) ─── */}
          <div className="xl:col-span-3 space-y-5">

            {/* Offer meta */}
            <div className="bg-white border border-[#E7E7E7] rounded-xl shadow-sm p-5 space-y-4">
              <SectionTitle>Detalji ponude</SectionTitle>
              <div>
                <label className="label">Vozilo (opis)</label>
                <input className="input" placeholder="npr. Volkswagen Passat 2.0 TDI 2024" value={vehicleDescription} onChange={(e) => setVehicleDescription(e.target.value)} />
              </div>
              <div className="relative">
                <label className="label">Klijent (kompanija)</label>
                <input
                  className="input"
                  placeholder="Pretraži klijenta..."
                  value={selectedClient ? selectedClient.full_name : clientSearch}
                  onChange={(e) => { setClientSearch(e.target.value); setSelectedClient(null); }}
                />
                {clients.length > 0 && !selectedClient && (
                  <div className="absolute z-10 w-full mt-1 bg-white border border-[#E7E7E7] rounded-xl shadow-xl overflow-hidden">
                    {clients.map((c) => (
                      <button
                        key={c.id}
                        onClick={() => { setSelectedClient(c); setClients([]); }}
                        className="w-full text-left px-4 py-2.5 hover:bg-slate-50 text-sm text-slate-700 transition-colors border-b border-slate-100 last:border-b-0"
                      >
                        {c.full_name}
                        {c.company_name && <span className="text-slate-400 ml-2">— {c.company_name}</span>}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Financing */}
            <div className="bg-white border border-[#E7E7E7] rounded-xl shadow-sm p-5 space-y-4">
              <SectionTitle>Finansiranje vozila</SectionTitle>
              <div className="grid grid-cols-2 gap-4">
                <InputField label="Cijena auta" prefix="€" value={inputs.vehiclePrice} onChange={set("vehiclePrice")} />
                <InputField label="Učešće" sublabel="(%) npr. 0.15 = 15%" value={inputs.downPaymentPct} onChange={set("downPaymentPct")} step="0.01" min={0} />
                <InputField label="Kamata godišnja" sublabel="(%) npr. 0.07 = 7%" value={inputs.annualInterestRate} onChange={set("annualInterestRate")} step="0.001" min={0} />
                <InputField label="Period" suffix="mj" value={inputs.periodMonths} onChange={set("periodMonths")} min={1} />
              </div>
              <div className="bg-slate-50 border border-[#E7E7E7] rounded-lg p-3 grid grid-cols-3 gap-3 text-center">
                {[
                  { label: "Učešće iznos", value: formatCurrency(results.downPaymentAmount) },
                  { label: "Leasing glavnica", value: formatCurrency(results.leasingPrincipal) },
                  { label: "Godina najma", value: `${results.yearsOfLease.toFixed(1)} god.` },
                ].map((s) => (
                  <div key={s.label}>
                    <div className="text-[11px] text-slate-500 mb-1 font-semibold uppercase tracking-wide">{s.label}</div>
                    <div className="text-sm font-bold text-slate-800">{s.value}</div>
                  </div>
                ))}
              </div>
            </div>

            {/* Costs */}
            <div className="bg-white border border-[#E7E7E7] rounded-xl shadow-sm p-5 space-y-4">
              <SectionTitle>Troškovi (cijeli period najma)</SectionTitle>
              <div className="grid grid-cols-2 gap-4">
                <InputField label="Kasko (godišnje)" prefix="€" value={inputs.kaskoYearly} onChange={set("kaskoYearly")} />
                <InputField label="AO Kasko (godišnje)" prefix="€" value={inputs.aoYearly} onChange={set("aoYearly")} />
                <InputField label="Gume (ukupno)" prefix="€" value={inputs.tyresTotal} onChange={set("tyresTotal")} />
                <InputField label="Servis (ukupno)" prefix="€" value={inputs.serviceTotal} onChange={set("serviceTotal")} />
                <div className="col-span-2">
                  <InputField label="Administracija i neplanirano" prefix="€" value={inputs.adminTotal} onChange={set("adminTotal")} />
                </div>
              </div>
            </div>

            {/* Margin & VAT */}
            <div className="bg-white border border-[#E7E7E7] rounded-xl shadow-sm p-5 space-y-4">
              <SectionTitle>Marža i PDV</SectionTitle>
              <div className="grid grid-cols-2 gap-4">
                <InputField label="Marža posto" sublabel="(%) npr. 0.17 = 17%" value={inputs.marginPct} onChange={set("marginPct")} step="0.01" min={0} />
                <InputField label="PDV" sublabel="(%) npr. 0.17 = 17%" value={inputs.vatPct} onChange={set("vatPct")} step="0.01" min={0} />
                <div className="col-span-2">
                  <InputField label="Vrijednost vozila nakon isteka najma" prefix="€" value={inputs.residualValue} onChange={set("residualValue")} />
                </div>
              </div>
            </div>
          </div>

          {/* ─── Results (2 cols) ─── */}
          <div className="xl:col-span-2 space-y-5">

            <div className="bg-white border border-[#E7E7E7] rounded-xl shadow-sm p-5 space-y-1">
              <SectionTitle>Finansiranje</SectionTitle>
              <ResultRow label="Mjesečna rata financiranja" value={formatCurrency(results.monthlyFinancingRate)} highlight />
              <ResultRow label="Ukupno otplata" value={formatCurrency(results.totalRepayment)} />
              <ResultRow label="Ukupna kamata" value={formatCurrency(results.totalInterest)} />
              <ResultRow label="Ukupno financiranje auta" value={formatCurrency(results.totalFinancing)} highlight />
            </div>

            <div className="bg-white border border-[#E7E7E7] rounded-xl shadow-sm p-5 space-y-1">
              <SectionTitle>Osiguranje (period)</SectionTitle>
              <ResultRow label="Ukupno Kasko" value={formatCurrency(results.totalKasko)} />
              <ResultRow label="Ukupno AO" value={formatCurrency(results.totalAO)} />
            </div>

            <div className="bg-white border border-[#E7E7E7] rounded-xl shadow-sm p-5 space-y-1">
              <SectionTitle>Ukupni troškovi</SectionTitle>
              <ResultRow label="Ukupan trošak" value={formatCurrency(results.totalCost)} highlight />
              <ResultRow label="Mjesečni trošak" value={formatCurrency(results.monthlyCost)} />
              <ResultRow label={`Marža iznos (${formatPct(inputs.marginPct)})`} value={formatCurrency(results.marginAmount)} />
            </div>

            {/* Client offer — key output */}
            <div className="bg-white border border-[#003580]/20 rounded-xl shadow-sm p-5 space-y-2">
              <SectionTitle>Ponuda klijentu</SectionTitle>
              <ResultRow label="Najamnina (bez PDV)" value={formatCurrency(results.monthlyRentNoVat)} highlight />
              <ResultRow
                label={`Mjesečni najam s PDV (${formatPct(inputs.vatPct)})`}
                value={formatCurrency(results.monthlyRentWithVat)}
                accent
              />
            </div>

            {/* Profit — admin only */}
            <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-5 space-y-2">
              <SectionTitle>VTZ Profit (interno)</SectionTitle>
              <ResultRow label="Profit od najma" value={formatCurrency(results.vtzProfit)} highlight />
              <ResultRow label="Vrijednost vozila (rezidualna)" value={formatCurrency(inputs.residualValue)} />
              <ResultRow label="Mogući ukupni profit" value={formatCurrency(results.possibleProfit)} accent />
            </div>

            <div className="bg-slate-50 border border-[#E7E7E7] rounded-xl p-4 text-xs text-slate-500 leading-relaxed">
              <strong className="text-slate-600 block mb-1">Napomena</strong>
              Klijent vidi samo <span className="text-[#003580] font-semibold">miesečni najam s PDV ({formatCurrency(results.monthlyRentWithVat)})</span>.
              Interne marže, troškovi i profit su vidljivi samo adminu.
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
