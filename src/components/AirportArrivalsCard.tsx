"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import {
  AlertTriangle,
  CalendarClock,
  Car,
  CheckCircle2,
  Clock3,
  ExternalLink,
  Loader2,
  MapPin,
  Navigation,
  Plane,
  RefreshCw,
  Route,
  Timer,
  User,
  X,
  XCircle,
} from "lucide-react";
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

type FlightLookupResult = {
  flight: FlightData | null;
  error?: string;
};

type FlightAirport = NonNullable<FlightData["arrival"]>["airport"];

const VTZ_ORIGIN_LABEL = "VTZ Car";
const VTZ_ORIGIN_COORDS = "43.2593632,17.7158091";
const VTZ_ORIGIN_MAP_URL = "https://maps.app.goo.gl/fcPPizzafQWQEV898";
const DRIVE_MINUTES = 30;

async function lookupFlight(rental: AirportRental): Promise<FlightLookupResult> {
  if (!rental.flight_number) return { flight: null };

  const today = new Date().toISOString().split("T")[0];
  const res = await fetch(
    `/api/flight-tracker?flight=${encodeURIComponent(rental.flight_number)}&date=${today}`
  );
  const json = await res.json();

  if (!res.ok) {
    return { flight: null, error: json.error ?? "Greška" };
  }

  return { flight: json.flight ?? null };
}

function getLocalTime(isoLocal?: string): string {
  if (!isoLocal) return "—";
  const match = isoLocal.match(/(\d{2}:\d{2})/);
  return match ? match[1] : "—";
}

function formatLocalDateTime(isoLocal?: string): string {
  if (!isoLocal) return "—";
  const parsed = new Date(isoLocal);
  if (Number.isNaN(parsed.getTime())) return getLocalTime(isoLocal);

  return parsed.toLocaleString("hr-HR", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function shiftIsoMinutes(isoLocal: string | undefined, minutes: number): string {
  if (!isoLocal) return "—";
  const parsed = new Date(isoLocal);
  if (Number.isNaN(parsed.getTime())) return "—";
  parsed.setMinutes(parsed.getMinutes() + minutes);

  return parsed.toLocaleTimeString("hr-HR", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

function getBestArrivalTime(flight: FlightData | null): string | undefined {
  return (
    flight?.arrival?.actualTime?.local ??
    flight?.arrival?.runwayTime?.local ??
    flight?.arrival?.revisedTime?.local ??
    flight?.arrival?.predictedTime?.local ??
    flight?.arrival?.scheduledTime?.local
  );
}

function getBestDepartureTime(flight: FlightData | null): string | undefined {
  return (
    flight?.departure?.actualTime?.local ??
    flight?.departure?.runwayTime?.local ??
    flight?.departure?.revisedTime?.local ??
    flight?.departure?.scheduledTime?.local
  );
}

function getAirportLabel(airport?: FlightAirport): string {
  if (!airport) return "Aerodrom";
  return [airport.name, airport.iata].filter(Boolean).join(" · ") || "Aerodrom";
}

function buildDirectionsUrl(flight: FlightData | null): string {
  const airport = flight?.arrival?.airport;
  const destination = airport?.name ?? (airport?.iata ? `${airport.iata} airport` : "Mostar Airport");
  const params = new URLSearchParams({
    api: "1",
    origin: VTZ_ORIGIN_COORDS,
    destination,
    travelmode: "driving",
  });

  return `https://www.google.com/maps/dir/?${params.toString()}`;
}

function getOperationalMessage(flight: FlightData, info: FlightStatusInfo): string {
  const status = (flight.status ?? "").toLowerCase();
  const departureTime = getLocalTime(getBestDepartureTime(flight));
  const arrivalTime = getLocalTime(getBestArrivalTime(flight));
  const delay = flight.arrival?.delay ?? flight.departure?.delay;

  if (status.includes("cancelled") || status.includes("canceled")) {
    return "Let je otkazan. Provjerite s klijentom prije slanja vozila.";
  }

  if (status.includes("arrived") || status.includes("landed")) {
    return `Let je sletio u ${arrivalTime}. Ako vozilo nije na aerodromu, krenuti odmah.`;
  }

  if (status.includes("delayed")) {
    return `Let kasni${delay ? ` ${delay} min` : ""}. Planirajte dolazak prema novom vremenu slijetanja.`;
  }

  if (
    status.includes("departed") ||
    status.includes("takeoff") ||
    status.includes("took off") ||
    status.includes("en route") ||
    status.includes("airborne") ||
    status.includes("active")
  ) {
    return `Let je poletio${departureTime !== "—" ? ` u ${departureTime}` : ""}. Pratiti dolazak i spremiti vozilo prije slijetanja.`;
  }

  if (status.includes("approaching") || status.includes("landing")) {
    return "Let prilazi aerodromu. Vozilo treba biti na lokaciji za preuzimanje.";
  }

  return info.detail;
}

export default function AirportArrivalsCard({ initialRentals }: Props) {
  const [flightMap, setFlightMap] = useState<Record<string, FlightData | null>>({});
  const [loadingMap, setLoadingMap] = useState<Record<string, boolean>>({});
  const [refreshing, setRefreshing] = useState(false);
  const [lastRefreshed, setLastRefreshed] = useState<Date | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [selectedRentalId, setSelectedRentalId] = useState<string | null>(null);
  const hasRefreshed = Object.keys(flightMap).length > 0 || lastRefreshed !== null;

  const selectedRental = useMemo(
    () => initialRentals.find((rental) => rental.id === selectedRentalId) ?? null,
    [initialRentals, selectedRentalId]
  );

  const refreshOne = useCallback(async (rental: AirportRental) => {
    setLoadingMap((current) => ({ ...current, [rental.id]: true }));

    try {
      const result = await lookupFlight(rental);

      setFlightMap((current) => ({ ...current, [rental.id]: result.flight }));
      setErrors((current) => {
        const next = { ...current };
        if (result.error) next[rental.id] = result.error;
        else delete next[rental.id];
        return next;
      });
      setLastRefreshed(new Date());
    } catch {
      setFlightMap((current) => ({ ...current, [rental.id]: null }));
      setErrors((current) => ({ ...current, [rental.id]: "Nema veze" }));
    } finally {
      setLoadingMap((current) => {
        const next = { ...current };
        delete next[rental.id];
        return next;
      });
    }
  }, []);

  const refresh = useCallback(async () => {
    setRefreshing(true);
    const results: Record<string, FlightData | null> = {};
    const errs: Record<string, string> = {};

    await Promise.all(
      initialRentals.map(async (rental) => {
        try {
          const result = await lookupFlight(rental);
          results[rental.id] = result.flight;
          if (result.error) errs[rental.id] = result.error;
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

  const openDetails = (rental: AirportRental) => {
    setSelectedRentalId(rental.id);

    if (rental.flight_number && flightMap[rental.id] === undefined && !errors[rental.id]) {
      void refreshOne(rental);
    }
  };

  const closeDetails = () => setSelectedRentalId(null);

  useEffect(() => {
    if (!selectedRentalId) return;

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") closeDetails();
    };

    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [selectedRentalId]);

  if (initialRentals.length === 0) return null;

  return (
    <>
      <div className="bg-white border border-[#E7E7E7] rounded-xl shadow-sm overflow-hidden">
        <div className="px-5 py-4 border-b border-[#E7E7E7] flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Plane className="w-4 h-4 text-[#003580]" />
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
            <RefreshCw className={`w-3 h-3 ${refreshing ? "animate-spin" : ""}`} />
            {refreshing ? "Osvježava..." : "Osvježi letove"}
          </button>
        </div>

        <div className="divide-y divide-slate-100">
          {initialRentals.map((rental) => {
            const flightData = flightMap[rental.id];
            const info: FlightStatusInfo | null = flightData ? getFlightStatusInfo(flightData) : null;
            const errMsg = errors[rental.id];
            const isLoading = loadingMap[rental.id];

            return (
              <div key={rental.id} className="px-5 py-4 hover:bg-slate-50 transition-colors">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap mb-0.5">
                      <span className="font-mono text-sm font-bold text-[#003580]">
                        {rental.flight_number ?? "—"}
                      </span>
                      {isLoading && (
                        <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-blue-50 text-blue-700">
                          <Loader2 className="w-3 h-3 animate-spin" />
                          Učitava
                        </span>
                      )}
                      {info && (
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${info.badgeColor}`}>
                          {info.badge}
                        </span>
                      )}
                      {!info && hasRefreshed && !errMsg && !isLoading && (
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

                    <p className="text-sm font-semibold text-slate-800">{rental.client_name}</p>
                    <p className="text-xs text-slate-400 mt-0.5">
                      {rental.vehicle_make} {rental.vehicle_model}
                      <span className="font-mono ml-1">· {rental.vehicle_registration}</span>
                    </p>

                    {info && (
                      <div className="mt-2 pl-2 border-l-2 border-[#003580]/20">
                        <p className="text-xs font-semibold text-slate-700">{info.headline}</p>
                        <p className="text-xs text-slate-500">{info.detail}</p>
                      </div>
                    )}

                    {!hasRefreshed && !isLoading && (
                      <p className="text-xs text-slate-400 mt-1.5 italic">
                        Pritisnite &quot;Osvježi letove&quot; za status
                      </p>
                    )}
                  </div>

                  <button
                    type="button"
                    onClick={() => openDetails(rental)}
                    className="text-[11px] font-semibold text-[#003580] hover:underline flex-shrink-0 mt-0.5"
                  >
                    Detalji →
                  </button>
                </div>
              </div>
            );
          })}
        </div>

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

      {selectedRental && (
        <FlightDetailsModal
          rental={selectedRental}
          flight={flightMap[selectedRental.id] ?? null}
          error={errors[selectedRental.id]}
          isLoading={Boolean(loadingMap[selectedRental.id])}
          onClose={closeDetails}
          onRefresh={() => refreshOne(selectedRental)}
        />
      )}
    </>
  );
}

interface FlightDetailsModalProps {
  rental: AirportRental;
  flight: FlightData | null;
  error?: string;
  isLoading: boolean;
  onClose: () => void;
  onRefresh: () => void;
}

function FlightDetailsModal({
  rental,
  flight,
  error,
  isLoading,
  onClose,
  onRefresh,
}: FlightDetailsModalProps) {
  const info = flight ? getFlightStatusInfo(flight) : null;
  const departureAirport = getAirportLabel(flight?.departure?.airport);
  const arrivalAirport = getAirportLabel(flight?.arrival?.airport);
  const arrivalTime = getBestArrivalTime(flight);
  const leaveBy = shiftIsoMinutes(arrivalTime, -DRIVE_MINUTES);
  const destinationMapsUrl = buildDirectionsUrl(flight);
  const message = flight && info ? getOperationalMessage(flight, info) : null;
  const status = (flight?.status ?? "").toLowerCase();
  const isCancelled = status.includes("cancelled") || status.includes("canceled");
  const airportMeta = [
    flight?.arrival?.terminal ? `Terminal ${flight.arrival.terminal}` : null,
    flight?.arrival?.gate ? `Gate ${flight.arrival.gate}` : null,
    flight?.arrival?.baggageBelt ? `Traka ${flight.arrival.baggageBelt}` : null,
  ].filter(Boolean);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm px-4 py-6 animate-fade-in"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div className="w-full max-w-3xl max-h-[92vh] overflow-hidden rounded-xl bg-white shadow-2xl animate-slide-up flex flex-col">
        <div className="px-5 py-4 border-b border-slate-200 flex items-start justify-between gap-4">
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <Plane className="w-5 h-5 text-[#003580]" />
              <h3 className="text-lg font-bold text-slate-900">Detalji leta</h3>
              {info && (
                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${info.badgeColor}`}>
                  {info.badge}
                </span>
              )}
            </div>
            <p className="mt-1 text-sm text-slate-500">
              {rental.flight_number ?? "Let bez broja"} · {rental.client_name}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-9 h-9 rounded-lg border border-slate-200 text-slate-500 hover:bg-slate-50 flex items-center justify-center flex-shrink-0"
            aria-label="Zatvori detalje leta"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="overflow-y-auto p-5 space-y-4">
          <div className="rounded-lg border border-slate-200 p-4">
            <div className="flex items-start gap-3">
              <div className={`w-10 h-10 rounded-full flex items-center justify-center ${isCancelled ? "bg-red-50 text-red-600" : "bg-[#003580]/10 text-[#003580]"}`}>
                {isCancelled ? <XCircle className="w-5 h-5" /> : <CheckCircle2 className="w-5 h-5" />}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-bold text-slate-900">
                  {info?.headline ?? (isLoading ? "Učitavanje statusa..." : "Status nije učitan")}
                </p>
                <p className="mt-1 text-sm text-slate-600">
                  {message ?? error ?? "Osvježite let za detaljan status, vremena i rutu."}
                </p>
              </div>
              <button
                type="button"
                onClick={onRefresh}
                disabled={isLoading}
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-[#003580] text-white text-xs font-semibold hover:bg-[#002a66] disabled:opacity-60"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? "animate-spin" : ""}`} />
                Osvježi
              </button>
            </div>
          </div>

          {error && (
            <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 flex items-start gap-2 text-sm text-red-700">
              <AlertTriangle className="w-4 h-4 mt-0.5 flex-shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <div className="grid md:grid-cols-2 gap-4">
            <div className="rounded-lg border border-slate-200 p-4">
              <div className="flex items-center gap-2 text-sm font-bold text-slate-900 mb-3">
                <CalendarClock className="w-4 h-4 text-[#003580]" />
                Informacije o letu
              </div>
              <div className="space-y-3">
                <DetailRow label="Let" value={flight?.number ?? rental.flight_number ?? "—"} mono />
                <DetailRow label="Aviokompanija" value={flight?.airline?.name ?? "—"} />
                <DetailRow label="Status API" value={flight?.status ?? "—"} />
                <DetailRow label="Polazak" value={departureAirport} />
                <DetailRow label="Dolazak" value={arrivalAirport} />
                {airportMeta.length > 0 && <DetailRow label="Aerodrom" value={airportMeta.join(" · ")} />}
              </div>
            </div>

            <div className="rounded-lg border border-slate-200 p-4">
              <div className="flex items-center gap-2 text-sm font-bold text-slate-900 mb-3">
                <Clock3 className="w-4 h-4 text-[#003580]" />
                Vremena
              </div>
              <div className="space-y-3">
                <DetailRow label="Planirani polazak" value={formatLocalDateTime(flight?.departure?.scheduledTime?.local)} />
                <DetailRow label="Stvarni polazak" value={formatLocalDateTime(getBestDepartureTime(flight))} />
                <DetailRow label="Planirani dolazak" value={formatLocalDateTime(flight?.arrival?.scheduledTime?.local)} />
                <DetailRow label="Ažurirani dolazak" value={formatLocalDateTime(arrivalTime)} />
                <DetailRow
                  label="Kašnjenje"
                  value={
                    flight?.arrival?.delay || flight?.departure?.delay
                      ? `${flight.arrival?.delay ?? flight.departure?.delay} min`
                      : "Nema potvrđenog kašnjenja"
                  }
                />
              </div>
            </div>
          </div>

          <div className="rounded-lg border border-slate-200 p-4">
            <div className="flex items-center gap-2 text-sm font-bold text-slate-900 mb-3">
              <Navigation className="w-4 h-4 text-[#003580]" />
              Dostava vozila do aerodroma
            </div>
            <div className="grid sm:grid-cols-3 gap-3">
              <RouteMetric
                icon={<MapPin className="w-4 h-4" />}
                label="Start"
                value={VTZ_ORIGIN_LABEL}
                href={VTZ_ORIGIN_MAP_URL}
              />
              <RouteMetric icon={<Route className="w-4 h-4" />} label="Cilj" value={arrivalAirport} href={destinationMapsUrl} />
              <RouteMetric icon={<Timer className="w-4 h-4" />} label="Vožnja" value={`~${DRIVE_MINUTES} min`} />
            </div>
            <div className="mt-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 rounded-lg bg-slate-50 border border-slate-100 px-4 py-3">
              <div>
                <p className="text-xs font-semibold uppercase text-slate-400">Preporuka</p>
                <p className="text-sm font-semibold text-slate-800">
                  {isCancelled
                    ? "Ne slati vozilo dok se ne potvrdi novi let."
                    : leaveBy !== "—"
                      ? `Krenuti iz VTZ Car najkasnije oko ${leaveBy}.`
                      : "Osvježite let za preporučeno vrijeme polaska."}
                </p>
              </div>
              <a
                href={destinationMapsUrl}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg bg-[#003580] text-white text-xs font-semibold hover:bg-[#002a66]"
              >
                Otvori rutu
                <ExternalLink className="w-3.5 h-3.5" />
              </a>
            </div>
          </div>

          <div className="rounded-lg border border-slate-200 p-4">
            <div className="flex items-center gap-2 text-sm font-bold text-slate-900 mb-3">
              <User className="w-4 h-4 text-[#003580]" />
              Rezervacija
            </div>
            <div className="grid sm:grid-cols-2 gap-3">
              <DetailRow label="Klijent" value={rental.client_name} />
              <DetailRow
                label="Vozilo"
                value={`${rental.vehicle_make} ${rental.vehicle_model}`}
                icon={<Car className="w-3.5 h-3.5" />}
              />
              <DetailRow label="Registracija" value={rental.vehicle_registration} mono />
              <DetailRow label="Početak najma" value={formatLocalDateTime(rental.start_date)} />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

interface DetailRowProps {
  label: string;
  value: string;
  mono?: boolean;
  icon?: ReactNode;
}

function DetailRow({ label, value, mono, icon }: DetailRowProps) {
  return (
    <div className="min-w-0">
      <p className="text-[11px] font-semibold uppercase text-slate-400">{label}</p>
      <p className={`mt-0.5 text-sm text-slate-800 break-words ${mono ? "font-mono" : "font-medium"}`}>
        {icon && <span className="inline-flex align-middle mr-1 text-slate-400">{icon}</span>}
        {value}
      </p>
    </div>
  );
}

interface RouteMetricProps {
  icon: ReactNode;
  label: string;
  value: string;
  href?: string;
}

function RouteMetric({ icon, label, value, href }: RouteMetricProps) {
  const content = (
    <>
      <span className="w-8 h-8 rounded-lg bg-[#003580]/10 text-[#003580] flex items-center justify-center flex-shrink-0">
        {icon}
      </span>
      <span className="min-w-0">
        <span className="block text-[11px] font-semibold uppercase text-slate-400">{label}</span>
        <span className="block text-sm font-semibold text-slate-800 truncate">{value}</span>
      </span>
    </>
  );

  if (href) {
    return (
      <a
        href={href}
        target="_blank"
        rel="noreferrer"
        className="flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 hover:bg-slate-50 min-w-0"
      >
        {content}
      </a>
    );
  }

  return <div className="flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 min-w-0">{content}</div>;
}
