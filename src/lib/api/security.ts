import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

type RateBucket = { count: number; resetAt: number };

const buckets = new Map<string, RateBucket>();

export async function requireUser() {
  const supabase = await createClient();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error || !user) {
    return { user: null, response: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  }

  return { user, response: null };
}

export function rejectLargeRequest(req: NextRequest, maxBytes: number) {
  const length = Number(req.headers.get("content-length") || 0);
  if (length > maxBytes) {
    return NextResponse.json({ error: "Request too large" }, { status: 413 });
  }
  return null;
}

export function rateLimit(req: NextRequest, key: string, limit: number, windowMs: number) {
  const forwardedFor = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  const realIp = req.headers.get("x-real-ip");
  const identity = `${key}:${forwardedFor || realIp || "unknown"}`;
  const now = Date.now();
  const bucket = buckets.get(identity);

  if (!bucket || bucket.resetAt <= now) {
    buckets.set(identity, { count: 1, resetAt: now + windowMs });
    return null;
  }

  if (bucket.count >= limit) {
    const retryAfter = Math.ceil((bucket.resetAt - now) / 1000);
    return NextResponse.json(
      { error: "Too many requests" },
      { status: 429, headers: { "Retry-After": String(retryAfter) } }
    );
  }

  bucket.count += 1;
  return null;
}

export function escapeHtml(value: unknown) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
