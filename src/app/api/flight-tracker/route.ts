import { NextRequest, NextResponse } from "next/server";

export async function GET(req: NextRequest) {
  const flight = req.nextUrl.searchParams.get("flight")?.replace(/\s/g, "").toUpperCase();
  const date = req.nextUrl.searchParams.get("date") ?? new Date().toISOString().split("T")[0];

  if (!flight) return NextResponse.json({ error: "Missing flight" }, { status: 400 });

  const apiKey = process.env.AERODATABOX_API_KEY;
  if (!apiKey) return NextResponse.json({ error: "API key not configured" }, { status: 500 });

  const res = await fetch(
    `https://aerodatabox.p.rapidapi.com/flights/number/${encodeURIComponent(flight)}/${date}`,
    {
      headers: {
        "x-rapidapi-key": apiKey,
        "x-rapidapi-host": process.env.AERODATABOX_HOST ?? "aerodatabox.p.rapidapi.com",
      },
      cache: "no-store",
    }
  );

  if (!res.ok) {
    if (res.status === 404) return NextResponse.json({ error: "Flight not found" }, { status: 404 });
    return NextResponse.json({ error: `AeroDataBox error ${res.status}` }, { status: res.status });
  }

  const data = await res.json();
  const flightData = Array.isArray(data) ? data[0] : data;
  return NextResponse.json({ flight: flightData ?? null });
}
