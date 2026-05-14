import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { rateLimit, rejectLargeRequest, requireUser } from "@/lib/api/security";

type DamagePinInput = {
  id?: string;
  x?: number;
  y?: number;
  view?: string;
  note?: string;
  photo?: string | null;
};

const MAX_REQUEST_BYTES = 256 * 1024;
// Shape-only UUID check. Postgres `uuid` accepts any hex UUID regardless of
// version/variant bits, and existing seed data uses non-RFC patterns.
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function isIsoDate(value: unknown): value is string {
  return typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value);
}

function daysInclusive(start: string, end: string) {
  const diff = new Date(end).getTime() - new Date(start).getTime();
  return Math.max(1, Math.ceil(diff / 86400000));
}

function cleanText(value: unknown, max = 200) {
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}

function cleanOptionalEmail(value: unknown) {
  const email = cleanText(value, 254);
  return email && EMAIL_RE.test(email) ? email : null;
}

function sanitizeDamagePins(value: unknown) {
  if (!Array.isArray(value)) return null;
  const pins = value.slice(0, 50).map((pin: DamagePinInput) => ({
    id: cleanText(pin.id, 80) || crypto.randomUUID(),
    x: Number.isFinite(Number(pin.x)) ? Number(pin.x) : 0,
    y: Number.isFinite(Number(pin.y)) ? Number(pin.y) : 0,
    view: cleanText(pin.view, 40) || "front",
    note: cleanText(pin.note, 500),
    photo: typeof pin.photo === "string" && pin.photo.length < 200_000 ? pin.photo : null,
  }));
  return pins.length > 0 ? { pins } : null;
}

export async function POST(req: NextRequest) {
  const tooLarge = rejectLargeRequest(req, MAX_REQUEST_BYTES);
  if (tooLarge) return tooLarge;

  const { user, response } = await requireUser();
  if (response) return response;

  const limited = rateLimit(req, `${user.id}:create-rental`, 60, 60 * 60 * 1000);
  if (limited) return limited;

  let body: any;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const form = body?.form ?? {};
  const vehicleId = cleanText(form.vehicle_id, 80);
  const existingClientId = cleanText(form.client_id, 80);
  const startDate = form.start_date;
  const endDate = form.end_date;
  const pickupType = cleanText(form.pickup_type, 20) === "airport" ? "airport" : "walk_in";
  const flightNumber = cleanText(form.flight_number, 40);
  const depositAmount = Math.max(0, Math.min(10000, Number(form.deposit_amount) || 0));

  if (!UUID_RE.test(vehicleId) || !isIsoDate(startDate) || !isIsoDate(endDate) || endDate < startDate) {
    return NextResponse.json({ error: "Invalid rental data" }, { status: 400 });
  }
  if (pickupType === "airport" && !flightNumber) {
    return NextResponse.json({ error: "Flight number is required" }, { status: 400 });
  }

  const supabase = await createClient();
  const { data: vehicle, error: vehicleError } = await supabase
    .from("vehicles")
    .select("id, status, daily_rate, current_km")
    .eq("id", vehicleId)
    .single();

  if (vehicleError || !vehicle) {
    return NextResponse.json({ error: "Vehicle not found" }, { status: 404 });
  }
  if (["service", "washing", "inactive"].includes(vehicle.status)) {
    return NextResponse.json({ error: "Vehicle is not available" }, { status: 409 });
  }

  const { data: overlapping } = await supabase
    .from("rentals")
    .select("id")
    .eq("vehicle_id", vehicleId)
    .eq("status", "active")
    .lte("start_date", endDate)
    .gte("end_date", startDate)
    .limit(1);

  if ((overlapping?.length ?? 0) > 0) {
    return NextResponse.json({ error: "Vehicle is already booked for this period" }, { status: 409 });
  }

  let clientId = existingClientId;
  if (body?.clientMode === "new") {
    const newClient = body?.newClient ?? {};
    const firstName = cleanText(newClient.first_name, 80);
    const lastName = cleanText(newClient.last_name, 80);
    if (!firstName || !lastName) {
      return NextResponse.json({ error: "Client name is required" }, { status: 400 });
    }

    const { data: insertedClient, error: clientError } = await supabase
      .from("clients")
      .insert({
        client_type: "individual",
        full_name: `${firstName} ${lastName}`,
        email: cleanOptionalEmail(newClient.email),
        phone: cleanText(newClient.phone, 80) || null,
        id_number: cleanText(newClient.id_number, 80) || null,
        drivers_license: cleanText(newClient.drivers_license, 80) || null,
        is_blacklisted: false,
      })
      .select("id")
      .single();

    if (clientError || !insertedClient) {
      return NextResponse.json({ error: "Could not create client" }, { status: 400 });
    }
    clientId = insertedClient.id;
  }

  if (!UUID_RE.test(clientId)) {
    return NextResponse.json({ error: "Invalid client" }, { status: 400 });
  }

  const { data: client } = await supabase
    .from("clients")
    .select("id, is_blacklisted")
    .eq("id", clientId)
    .single();

  if (!client || client.is_blacklisted) {
    return NextResponse.json({ error: "Client is not eligible for rental" }, { status: 403 });
  }

  const totalDays = daysInclusive(startDate, endDate);
  const dailyRate = Number(vehicle.daily_rate) || 0;
  const totalAmount = totalDays * dailyRate;

  const { data: rental, error: rentalError } = await supabase
    .from("rentals")
    .insert({
      vehicle_id: vehicleId,
      client_id: clientId,
      start_date: startDate,
      end_date: endDate,
      pickup_km: Number(vehicle.current_km) || 0,
      daily_rate: dailyRate,
      total_days: totalDays,
      total_amount: totalAmount,
      deposit_amount: depositAmount,
      pickup_type: pickupType,
      flight_number: pickupType === "airport" ? flightNumber : null,
      status: "active",
      damage_report_out: sanitizeDamagePins(body?.damages),
      created_by: user.id,
    })
    .select()
    .single();

  if (rentalError || !rental) {
    return NextResponse.json({ error: "Could not create rental" }, { status: 400 });
  }

  await supabase.from("vehicles").update({ status: "rented" }).eq("id", vehicleId);

  return NextResponse.json({ rental, clientId, totalAmount, totalDays, dailyRate });
}
