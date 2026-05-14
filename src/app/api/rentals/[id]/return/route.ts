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
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function cleanText(value: unknown, max = 200) {
  return typeof value === "string" ? value.trim().slice(0, max) : "";
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

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const tooLarge = rejectLargeRequest(req, MAX_REQUEST_BYTES);
  if (tooLarge) return tooLarge;

  const { user, response } = await requireUser();
  if (response) return response;

  const { id: rentalId } = await params;
  if (!UUID_RE.test(rentalId)) {
    return NextResponse.json({ error: "Invalid rental" }, { status: 400 });
  }

  const limited = rateLimit(req, `${user.id}:return-rental:${rentalId}`, 30, 60 * 60 * 1000);
  if (limited) return limited;

  let body: any;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const supabase = await createClient();
  const { data: rental, error: rentalError } = await supabase
    .from("rentals")
    .select("id, vehicle_id, pickup_km, status")
    .eq("id", rentalId)
    .single();

  if (rentalError || !rental) {
    return NextResponse.json({ error: "Rental not found" }, { status: 404 });
  }
  if (rental.status !== "active") {
    return NextResponse.json({ error: "Rental is not active" }, { status: 409 });
  }

  const returnKm = Number(body?.returnKm);
  const pickupKm = Number(rental.pickup_km) || 0;
  if (!Number.isFinite(returnKm) || returnKm < pickupKm) {
    return NextResponse.json({ error: "Invalid return kilometers" }, { status: 400 });
  }

  const returnDamageReport = sanitizeDamagePins(body?.returnDamages);
  const { error: updateRentalError } = await supabase
    .from("rentals")
    .update({
      status: "completed",
      return_km: returnKm,
      damage_report_in: returnDamageReport,
    })
    .eq("id", rentalId);

  if (updateRentalError) {
    return NextResponse.json({ error: "Could not complete rental" }, { status: 400 });
  }

  if (body?.syncDamagesToVehicle && returnDamageReport?.pins?.length) {
    const { data: vehicle } = await supabase
      .from("vehicles")
      .select("persistent_damage")
      .eq("id", rental.vehicle_id)
      .single();
    const existing = (vehicle?.persistent_damage as { pins?: unknown[] } | null)?.pins ?? [];

    await supabase
      .from("vehicles")
      .update({
        status: "free",
        current_km: returnKm,
        persistent_damage: { pins: [...existing, ...returnDamageReport.pins] },
      })
      .eq("id", rental.vehicle_id);
  } else {
    await supabase
      .from("vehicles")
      .update({
        status: "free",
        current_km: returnKm,
      })
      .eq("id", rental.vehicle_id);
  }

  return NextResponse.json({ ok: true });
}
