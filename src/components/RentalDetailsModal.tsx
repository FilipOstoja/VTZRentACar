"use client";

import type { DamagePin } from "./CarDamageInspector";

interface DetailsRental {
  id: string;
  start_date: string;
  end_date: string;
  pickup_km?: number;
  return_km?: number | null;
  daily_rate: number;
  total_days?: number;
  total_amount?: number;
  deposit_amount?: number;
  status: string;
  pickup_type?: "walk_in" | "airport";
  flight_number?: string | null;
  damage_report_out?: { pins: DamagePin[] } | null;
  damage_report_in?: { pins: DamagePin[] } | null;
  vehicles?: { make: string; model: string; registration: string };
  clients?: { full_name: string; phone?: string };
}

interface Props {
  rental: DetailsRental;
  onClose: () => void;
  onCloseRental: () => void;
}

function formatDate(iso: string) {
  const d = new Date(iso);
  return d.toLocaleDateString("hr-HR", { day: "2-digit", month: "2-digit", year: "numeric" });
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2">
      {children}
    </div>
  );
}

function Row({ label, value, mono }: { label: string; value: React.ReactNode; mono?: boolean }) {
  return (
    <div className="flex items-baseline justify-between text-sm">
      <span className="text-slate-500">{label}</span>
      <span className={`text-slate-800 font-semibold ${mono ? "font-mono" : ""}`}>{value}</span>
    </div>
  );
}

const STATUS_LABEL: Record<string, string> = {
  active: "Aktivan",
  completed: "Završen",
  cancelled: "Otkazan",
};

const STATUS_STYLE: Record<string, string> = {
  active: "bg-blue-100 text-blue-700 border-blue-200",
  completed: "bg-emerald-100 text-emerald-700 border-emerald-200",
  cancelled: "bg-slate-100 text-slate-500 border-slate-200",
};

export default function RentalDetailsModal({ rental, onClose, onCloseRental }: Props) {
  const pickupCount = rental.damage_report_out?.pins?.length ?? 0;
  const returnCount = rental.damage_report_in?.pins?.length ?? 0;
  const isActive = rental.status === "active";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm animate-fade-in">
      <div className="bg-white border border-[#E7E7E7] rounded-2xl shadow-2xl w-full max-w-xl animate-slide-up flex flex-col max-h-[92vh]">

        {/* Header */}
        <div className="flex items-center justify-between px-6 pt-6 pb-4 border-b border-[#E7E7E7] flex-shrink-0">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <h2 className="text-lg font-bold text-slate-800">Detalji najma</h2>
              <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase border ${STATUS_STYLE[rental.status] ?? "bg-slate-100 text-slate-500 border-slate-200"}`}>
                {STATUS_LABEL[rental.status] ?? rental.status}
              </span>
            </div>
            <p className="text-sm text-slate-500">
              {rental.vehicles?.make} {rental.vehicles?.model}
              <span className="ml-2 text-[#003580] font-mono text-xs font-semibold">
                {rental.vehicles?.registration}
              </span>
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 p-1 rounded-lg hover:bg-slate-100 transition-colors"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18"/>
              <line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
          </button>
        </div>

        {/* Body */}
        <div className="overflow-y-auto flex-1 px-6 py-5 space-y-5">

          {/* Klijent */}
          <div>
            <SectionLabel>Klijent</SectionLabel>
            <div className="text-slate-800 font-semibold">{rental.clients?.full_name ?? "—"}</div>
            {rental.clients?.phone && (
              <a
                href={`tel:${rental.clients.phone}`}
                className="text-xs text-[#003580] font-medium hover:underline"
              >
                {rental.clients.phone}
              </a>
            )}
          </div>

          {/* Period */}
          <div>
            <SectionLabel>Period</SectionLabel>
            <div className="bg-slate-50 border border-[#E7E7E7] rounded-xl p-3 space-y-1.5">
              <Row label="Od" value={formatDate(rental.start_date)} />
              <Row label="Do" value={formatDate(rental.end_date)} />
              <Row label="Broj dana" value={`${rental.total_days ?? 0} dan(a)`} />
            </div>
          </div>

          {/* Finansije */}
          <div>
            <SectionLabel>Finansije</SectionLabel>
            <div className="bg-slate-50 border border-[#E7E7E7] rounded-xl p-3 space-y-1.5">
              <Row
                label="Dnevna tarifa"
                value={
                  <>
                    {(rental.daily_rate * 1.9583).toFixed(2)} KM
                    <span className="text-slate-400 font-normal text-xs ml-1.5">
                      ≈ €{rental.daily_rate}
                    </span>
                  </>
                }
              />
              <Row
                label="Ukupno"
                value={
                  <>
                    {((rental.total_amount ?? 0) * 1.9583).toFixed(2)} KM
                    <span className="text-slate-400 font-normal text-xs ml-1.5">
                      ≈ €{(rental.total_amount ?? 0).toFixed(2)}
                    </span>
                  </>
                }
              />
              <Row label="Depozit" value={`${((rental.deposit_amount ?? 0) * 1.9583).toFixed(2)} KM`} />
            </div>
          </div>

          {/* Kilometraža */}
          <div>
            <SectionLabel>Kilometraža</SectionLabel>
            <div className="bg-slate-50 border border-[#E7E7E7] rounded-xl p-3 space-y-1.5">
              <Row
                label="Pri preuzimanju"
                value={`${(rental.pickup_km ?? 0).toLocaleString("hr-HR")} km`}
                mono
              />
              {rental.return_km != null && (
                <>
                  <Row
                    label="Pri vraćanju"
                    value={`${rental.return_km.toLocaleString("hr-HR")} km`}
                    mono
                  />
                  <Row
                    label="Pređeno"
                    value={
                      <span className="text-emerald-700">
                        +{(rental.return_km - (rental.pickup_km ?? 0)).toLocaleString("hr-HR")} km
                      </span>
                    }
                    mono
                  />
                </>
              )}
            </div>
          </div>

          {/* Preuzimanje */}
          <div>
            <SectionLabel>Preuzimanje</SectionLabel>
            <div className="bg-slate-50 border border-[#E7E7E7] rounded-xl p-3 flex items-center gap-3">
              {rental.pickup_type === "airport" ? (
                <>
                  <div className="w-9 h-9 rounded-full bg-[#003580] flex items-center justify-center flex-shrink-0">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M17.8 19.2L16 11l3.5-3.5C21 6 21 4 20 3c-1-1-3-1-4.5.5L12 7 3.8 5.2c-.5-.1-.9.1-1.1.5l-.3.5c-.2.5-.1 1 .3 1.3L9 12l-2 3H4l-1 1 3 2 2 3 1-1v-3l3-2 3.5 5.3c.3.4.8.5 1.3.3l.5-.2c.4-.3.6-.7.5-1.2z"/>
                    </svg>
                  </div>
                  <div>
                    <div className="text-sm font-semibold text-slate-800">Aerodrom</div>
                    {rental.flight_number && (
                      <div className="text-xs text-slate-500 font-mono">Let {rental.flight_number}</div>
                    )}
                  </div>
                </>
              ) : (
                <>
                  <div className="w-9 h-9 rounded-full bg-emerald-500 flex items-center justify-center flex-shrink-0">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <circle cx="12" cy="4" r="1.5"/>
                      <path d="M9 8l-2 5h3l1 6M15 8l2 5h-3l-1 6"/>
                      <path d="M10 13h4"/>
                    </svg>
                  </div>
                  <div>
                    <div className="text-sm font-semibold text-slate-800">Walk-in</div>
                    <div className="text-xs text-slate-500">Klijent dolazi sam</div>
                  </div>
                </>
              )}
            </div>
          </div>

          {/* Oštećenja */}
          <div>
            <SectionLabel>Oštećenja</SectionLabel>
            {pickupCount === 0 && returnCount === 0 ? (
              <div className="text-xs text-slate-500 bg-slate-50 border border-slate-200 rounded-lg px-3 py-2">
                {rental.status === "completed"
                  ? "Vozilo vraćeno bez evidentiranih oštećenja"
                  : "Nema evidentiranih oštećenja"}
              </div>
            ) : (
              <div className="flex flex-wrap gap-2">
                {pickupCount > 0 && (
                  <span className="text-xs bg-orange-50 text-orange-700 border border-orange-200 px-2.5 py-1 rounded-full font-medium">
                    ↑ {pickupCount} pri preuzimanju
                  </span>
                )}
                {returnCount > 0 && (
                  <span className="text-xs bg-indigo-50 text-indigo-700 border border-indigo-200 px-2.5 py-1 rounded-full font-medium">
                    ↓ {returnCount} nova oštećenja pri vraćanju
                  </span>
                )}
                {rental.status === "completed" && returnCount === 0 && pickupCount > 0 && (
                  <span className="text-xs bg-emerald-50 text-emerald-700 border border-emerald-200 px-2.5 py-1 rounded-full font-medium">
                    ✓ Bez novih oštećenja pri vraćanju
                  </span>
                )}
              </div>
            )}
          </div>

          {/* Lokacija (GPS placeholder — wired in Commit 3) — only for active rentals */}
          {isActive && (
            <div>
              <SectionLabel>Lokacija (GPS)</SectionLabel>
              <div className="bg-slate-50 border border-dashed border-slate-300 rounded-xl p-6 flex flex-col items-center justify-center text-center">
                <div className="w-12 h-12 rounded-full bg-slate-200 flex items-center justify-center mb-2.5">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M12 2a8 8 0 00-8 8c0 5.5 8 12 8 12s8-6.5 8-12a8 8 0 00-8-8z"/>
                    <circle cx="12" cy="10" r="3"/>
                  </svg>
                </div>
                <p className="text-sm font-semibold text-slate-600">GPS karta uskoro</p>
                <p className="text-xs text-slate-400 mt-1">
                  Traccar integracija stiže u sljedećem koraku
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex flex-wrap gap-2 justify-end px-6 py-4 border-t border-[#E7E7E7] flex-shrink-0">
          <button onClick={onClose} className="btn-secondary">Zatvori</button>
          {isActive && (
            <button onClick={onCloseRental} className="btn-primary">
              Završi najam
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="9 18 15 12 9 6"/>
              </svg>
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
