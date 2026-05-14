import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { rateLimit, rejectLargeRequest, requireUser } from "@/lib/api/security";

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
const MAX_REQUEST_BYTES = 8 * 1024 * 1024;
const MAX_IMAGE_BASE64_LENGTH = 6 * 1024 * 1024;
const ALLOWED_MEDIA_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif"] as const;

export async function POST(req: NextRequest) {
  const tooLarge = rejectLargeRequest(req, MAX_REQUEST_BYTES);
  if (tooLarge) return tooLarge;

  const { user, response } = await requireUser();
  if (response) return response;

  const limited = rateLimit(req, `${user.id}:scan-license`, 30, 60 * 60 * 1000);
  if (limited) return limited;

  let body: { imageBase64?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { imageBase64 } = body;
  if (!imageBase64 || typeof imageBase64 !== "string") {
    return NextResponse.json({ error: "No image provided" }, { status: 400 });
  }

  // Strip data URL prefix, keep only base64 content
  const base64 = imageBase64.replace(/^data:image\/\w+;base64,/, "");
  const mediaType = imageBase64.match(/^data:(image\/\w+);base64,/)?.[1] ?? "image/jpeg";

  if (!ALLOWED_MEDIA_TYPES.includes(mediaType as (typeof ALLOWED_MEDIA_TYPES)[number])) {
    return NextResponse.json({ error: "Unsupported image type" }, { status: 415 });
  }

  if (base64.length > MAX_IMAGE_BASE64_LENGTH) {
    return NextResponse.json({ error: "Image too large" }, { status: 413 });
  }

  if (!/^[A-Za-z0-9+/=\r\n]+$/.test(base64)) {
    return NextResponse.json({ error: "Invalid image content" }, { status: 400 });
  }

  try {
    const message = await anthropic.messages.create({
      model: "claude-haiku-4-5",
      max_tokens: 256,
      messages: [
        {
          role: "user",
          content: [
            {
              type: "image",
              source: { type: "base64", media_type: mediaType as (typeof ALLOWED_MEDIA_TYPES)[number], data: base64 },
            },
            {
              type: "text",
              text: `This is a photo of a driving license. The card may be rotated or at an angle — read all text regardless of orientation.

IGNORE completely: country names, document type labels like "VOZAČKA DOZVOLA", "DRIVING LICENCE", "PERMIS DE CONDUIRE", "FÜHRERSCHEIN", flag symbols, and any decorative/header text.

STRATEGY 1 — EU/Balkan license (numbered fields, used by all EU countries + BiH, Serbia, Montenegro, Croatia, etc.):
Find the small number printed before each data field and read the value after it:
- "1." = SURNAME (single all-caps word, e.g. OSTOJIĆ, MÜLLER, ROSSI)
- "2." = FIRST NAME (single all-caps word, e.g. FILIP, ANNA, MARCO)
- "3." = DATE OF BIRTH (DD.MM.YYYY)
- "5." = LICENSE NUMBER (alphanumeric, e.g. 1E940T1E2, B1234567)

STRATEGY 2 — Non-EU license (UK, US, Turkish, etc.) if no numbered fields exist:
Look for labeled fields: Surname/Last Name, Given Name/First Name, Date of Birth/DOB, License No/DL Number.

Return ONLY this JSON, nothing else — use null for anything not found:
{
  "first_name": "...",
  "last_name": "...",
  "date_of_birth": "DD.MM.YYYY or as printed",
  "license_number": "...",
  "id_number": null
}`,
            },
          ],
        },
      ],
    });

    const raw = message.content[0].type === "text" ? message.content[0].text : "";

    const extracted = JSON.parse(raw.replace(/```json\n?|\n?```/g, "").trim());
    return NextResponse.json({ extracted });
  } catch {
    console.error("[scan-license] Failed to scan license");
    return NextResponse.json({ error: "Could not scan license" }, { status: 422 });
  }
}
