export interface FlightData {
  number: string;
  status: string;
  airline?: { name: string; iata?: string; icao?: string };
  aircraft?: { reg?: string; model?: string };
  departure?: {
    airport?: { iata?: string; icao?: string; name?: string };
    scheduledTime?: { local?: string; utc?: string };
    actualTime?: { local?: string; utc?: string };
    revisedTime?: { local?: string; utc?: string };
    runwayTime?: { local?: string; utc?: string };
    terminal?: string;
    gate?: string;
    delay?: number;
  };
  arrival?: {
    airport?: { iata?: string; icao?: string; name?: string };
    scheduledTime?: { local?: string; utc?: string };
    actualTime?: { local?: string; utc?: string };
    revisedTime?: { local?: string; utc?: string };
    predictedTime?: { local?: string; utc?: string };
    runwayTime?: { local?: string; utc?: string };
    terminal?: string;
    gate?: string;
    baggageBelt?: string;
    delay?: number;
  };
}

export interface FlightStatusInfo {
  badge: string;
  badgeColor: string;
  headline: string;
  detail: string;
  isArrived: boolean;
}

const DRIVE_MINUTES = 30;

function extractTime(isoLocal?: string): string {
  if (!isoLocal) return "—";
  const match = isoLocal.match(/(\d{2}:\d{2})/);
  return match ? match[1] : "—";
}

function addMins(timeStr: string, mins: number): string {
  const match = timeStr.match(/(\d{2}):(\d{2})/);
  if (!match) return "—";
  const total = parseInt(match[1], 10) * 60 + parseInt(match[2], 10) + mins;
  return `${String(Math.floor(total / 60) % 24).padStart(2, "0")}:${String(total % 60).padStart(2, "0")}`;
}

export function getFlightStatusInfo(flight: FlightData): FlightStatusInfo {
  const status = (flight.status ?? "").toLowerCase();
  const arrSched = extractTime(flight.arrival?.scheduledTime?.local);
  const arrActual = extractTime(flight.arrival?.actualTime?.local);
  const depFrom = flight.departure?.airport?.iata ?? flight.departure?.airport?.name ?? "?";
  const delay = flight.arrival?.delay;

  if (status.includes("arrived") || status.includes("landed")) {
    const pickup = arrActual !== "—" ? addMins(arrActual, DRIVE_MINUTES) : null;
    return {
      badge: "Sletio",
      badgeColor: "bg-emerald-100 text-emerald-700",
      headline: `Sletio u ${arrActual}`,
      detail: pickup ? `Preuzimanje ~${pickup}` : "Preuzimanje uskoro",
      isArrived: true,
    };
  }

  if (status.includes("approaching") || status.includes("landing")) {
    const pickup = arrSched !== "—" ? addMins(arrSched, DRIVE_MINUTES) : null;
    return {
      badge: "Prilazi",
      badgeColor: "bg-blue-100 text-blue-700",
      headline: `Slijeće ~${arrSched}`,
      detail: pickup ? `Preuzimanje ~${pickup}` : "Uskoro",
      isArrived: false,
    };
  }

  if (
    status.includes("en route") ||
    status.includes("airborne") ||
    status.includes("active") ||
    status === "active"
  ) {
    return {
      badge: "U letu",
      badgeColor: "bg-sky-100 text-sky-700",
      headline: `Planirani dolazak ${arrSched}${delay ? ` (+${delay} min)` : ""}`,
      detail: `Iz ${depFrom}${delay ? ` · Kašnjenje ${delay} min` : ""}`,
      isArrived: false,
    };
  }

  if (status.includes("delayed")) {
    return {
      badge: "Kasni",
      badgeColor: "bg-amber-100 text-amber-700",
      headline: `Planirani dolazak ${arrSched}`,
      detail: `Kašnjenje ${delay ?? "?"} min · Iz ${depFrom}`,
      isArrived: false,
    };
  }

  if (status.includes("cancelled")) {
    return {
      badge: "Otkazan",
      badgeColor: "bg-red-100 text-red-700",
      headline: "Let otkazan",
      detail: "Kontaktirajte klijenta",
      isArrived: false,
    };
  }

  if (status.includes("scheduled")) {
    return {
      badge: "Zakazano",
      badgeColor: "bg-slate-100 text-slate-600",
      headline: `Planirani dolazak ${arrSched}`,
      detail: `Iz ${depFrom}`,
      isArrived: false,
    };
  }

  return {
    badge: "?",
    badgeColor: "bg-slate-100 text-slate-500",
    headline: `Planirani dolazak ${arrSched}`,
    detail: `Let ${flight.number}`,
    isArrived: false,
  };
}
