"use client";

import { useState, useCallback } from "react";
import Link from "next/link";
import { getFlightStatusInfo } from "@/lib/flightStatus";
import type { FlightData, FlightStatusInfo } from "@/lib/flightStatus";

export interface AirportRental {
  id: string;
  flight_number: string | null;
  start_date: string;
  client_name: string;
  vehicle_make: string;
  vehicle_model: string;
  vehicle_registration: string;
}

interface Props {
  initialRentals: AirportRental[];
}

export default function AirportArrivalsCard({ initialRentals }: Props) {
  const [flightMap, setFlightMap] = useState<Record<string, FlightData | null>>({});
  const [refreshing, setRefreshing] = useState(false);
  const [lastRefreshed, setLastRefreshed] = useState<Date | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const hasRefreshed = Object.keys(flightMap).length > 0 || lastRefreshed !== null;

  const refresh = useCallback(async () => {
    setRefreshing(true);
    const today = new Date().toISOString().split("T")[0];
    const results: Record<string, FlightData | null> = {};
    const errs: Record<string, string> = {};

    await Promise.all(
      initialRentals.map(async (rental) => {
        if (!rental.flight_number) {
          results[rental.id] = null;
          return;
        }
        try {
          const res = await fetch(
            `/api/flight-tracker?flight=${encodeURIComponent(rental.flight_number)}&date=${today}`
          );
          const json = await res.json();
          if (!res.ok) {
            results[rental.id] = null;
            errs[rental.id] = json.error ?? "Greška";
          } else {
            results[rental.id] = json.flight ?? null;
          }
        } catch {
          results[rental.id] = null;
          errs[rental.id] = "Nema veze";
        }
      })
    );

    setFlightMap(results);
    setErrors(errs);
    setLastRefreshed(new Date());
    setRefreshing(false);
  }, [initialRentals]);

  if (initialRentals.length === 0) return null;

  return (
    <div className="bg-white border border-[#E7E7E7] rounded-xl shadow-sm overflow-hidden">
      {/* Header */}
      <div className="px-5 py-4 border-b border-[#E7E7E7] flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          {/* Airplane icon */}
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#003580" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M17.8 19.2L16 11l3.5-3.5C21 6 21 4 20 3c-1-1-3-1-4.5.5L12 7 3.8 5.2c-.5-.1-.9.1-1.1.5l-.3.5c-.2.5-.1 1 .3 1.3L9 12l-2 3H4l-1 1 3 2 2 3 1-1v-3l3-2 3.5 5.3c.3.4.8.5 1.3.3l.5-.2c.4-.3.6-.7.5-1.2z"/>
          </svg>
          <h2 className="text-base font-semibold text-[#003580]">Aerodromska preuzimanja</h2>
          <span className="w-5 h-5 bg-[#003580] text-white text-[10px] font-bold rounded-full flex items-center justify-center">
            {initialRentals.length}
          </span>
        </div>
        <button
          onClick={refresh}
          disabled={refreshing}
          className="flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg bg-[#003580]/10 text-[#003580] hover:bg-[#003580]/20 transition-colors disabled:opacity-50 flex-shrink-0"
        >
          <svg
            width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor"
            strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"
            className={refreshing ? "animate-spin" : ""}
          >
            <polyline points="23 4 23 10 17 10"/>
            <polyline points="1 20 1 14 7 14"/>
            <path d="M3.51 9a9 9 0 0114.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0020.49 15"/>
          </svg>
          {refreshing ? "Osvježava..." : "Osvježi letove"}
        </button>
      </div>

      {/* Rental rows */}
      <div className="divide-y divide-slate-100">
        {initialRentals.map((rental) => {
          const flightData = flightMap[rental.id];
          const info: FlightStatusInfo | null = flightData ? getFlightStatusInfo(flightData) : null;
          const errMsg = errors[rental.id];

          return (
            <div key={rental.id} className="px-5 py-4 hover:bg-slate-50 transition-colors">
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  {/* Flight number + status badge */}
                  <div className="flex items-center gap-2 flex-wrap mb-0.5">
                    <span className="font-mono text-sm font-bold text-[#003580]">
                      {rental.flight_number ?? "—"}
                    </span>
                    {info && (
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${info.badgeColor}`}>
                        {info.badge}
                      </span>
                    )}
                    {!info && hasRefreshed && !errMsg && (
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-100 text-slate-500">
                        Nema podataka
                      </span>
                    )}
                    {errMsg && (
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-red-100 text-red-600">
                        {errMsg}
                      </span>
                    )}
                  </div>

                  {/* Client + vehicle */}
                  <p className="text-sm font-semibold text-slate-800">{rental.client_name}</p>
                  <p className="text-xs text-slate-400 mt-0.5">
                    {rental.vehicle_make} {rental.vehicle_model}
                    <span className="font-mono ml-1">· {rental.vehicle_registration}</span>
                  </p>

                  {/* Flight status detail */}
                  {info && (
                    <div className="mt-2 pl-2 border-l-2 border-[#003580]/20">
                      <p className="text-xs font-semibold text-slate-700">{info.headline}</p>
                      <p className="text-xs text-slate-500">{info.detail}</p>
                    </div>
                  )}

                  {/* Prompt to refresh */}
                  {!hasRefreshed && (
                    <p className="text-xs text-slate-400 mt-1.5 italic">
                      Pritisnite &quot;Osvježi letove&quot; za status
                    </p>
                  )}
                </div>

                <Link
                  href="/dashboard/rentals"
                  className="text-[11px] font-semibold text-[#003580] hover:underline flex-shrink-0 mt-0.5"
                >
                  Detalji →
                </Link>
              </div>
            </div>
          );
        })}
      </div>

      {/* Footer: last refreshed timestamp */}
      {lastRefreshed && (
        <div className="px-5 py-2 bg-slate-50 border-t border-slate-100">
          <p className="text-[10px] text-slate-400">
            Osvježeno:{" "}
            {lastRefreshed.toLocaleTimeString("hr-HR", {
              hour: "2-digit",
              minute: "2-digit",
              second: "2-digit",
            })}
          </p>
        </div>
      )}
    </div>
  );
}
