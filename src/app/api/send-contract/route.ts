import { NextRequest, NextResponse } from "next/server";
import { Resend } from "resend";
import { escapeHtml, rateLimit, rejectLargeRequest, requireUser } from "@/lib/api/security";

const resend = new Resend(process.env.RESEND_API_KEY);
const MAX_REQUEST_BYTES = 12 * 1024 * 1024;
const MAX_PDF_BASE64_LENGTH = 10 * 1024 * 1024;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function POST(req: NextRequest) {
  const tooLarge = rejectLargeRequest(req, MAX_REQUEST_BYTES);
  if (tooLarge) return tooLarge;

  const { user, response } = await requireUser();
  if (response) return response;

  const limited = rateLimit(req, `${user.id}:send-contract`, 20, 60 * 60 * 1000);
  if (limited) return limited;

  let body: { to?: string; contractNumber?: string; clientName?: string; pdfBase64?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { to, contractNumber, clientName, pdfBase64 } = body;

  if (!to || !EMAIL_RE.test(to) || !pdfBase64) {
    return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
  }

  try {
    const pdfContent = pdfBase64.replace(/^data:application\/pdf;base64,/, "").replace(/\s/g, "");
    if (pdfContent.length > MAX_PDF_BASE64_LENGTH) {
      return NextResponse.json({ error: "PDF too large" }, { status: 413 });
    }
    if (!/^[A-Za-z0-9+/=]+$/.test(pdfContent)) {
      return NextResponse.json({ error: "Invalid PDF content" }, { status: 400 });
    }

    const safeClientName = escapeHtml(clientName || "klijente");
    const safeContractNumber = escapeHtml(contractNumber || "bez-broja");
    const subjectContractNumber = String(contractNumber || "bez-broja").replace(/[\r\n]/g, " ").slice(0, 120);
    const fileContractNumber = String(contractNumber || "bez-broja").replace(/[^a-zA-Z0-9-_]/g, "-").slice(0, 80);

    const { error } = await resend.emails.send({
      from: "VTZ Rent-a-Car <onboarding@resend.dev>",
      to: [to],
      subject: `Ugovor o najmu vozila — ${subjectContractNumber}`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <div style="background: #003580; padding: 24px 32px;">
            <h1 style="color: white; margin: 0; font-size: 22px; letter-spacing: 1px;">VTZ RENT-A-CAR</h1>
          </div>
          <div style="padding: 32px; background: #ffffff;">
            <p style="color: #475569; font-size: 15px;">Poštovani/a <strong style="color: #1e293b;">${safeClientName}</strong>,</p>
            <p style="color: #475569; font-size: 15px; line-height: 1.6;">
              U prilogu se nalazi vaš <strong>Ugovor o kratkoročnom najmu vozila</strong> br.
              <strong style="color: #003580;">${safeContractNumber}</strong>,
              potpisan od obje ugovorne strane.
            </p>
            <p style="color: #475569; font-size: 15px; line-height: 1.6;">
              Molimo vas da pohranite ovaj dokument kao dokaz najma.
            </p>
            <div style="border-top: 1px solid #e2e8f0; margin-top: 32px; padding-top: 24px;">
              <p style="color: #94a3b8; font-size: 13px; margin: 0;">
                S poštovanjem,<br/>
                <strong style="color: #475569;">VTZ Rent-a-Car d.o.o.</strong><br/>
                Bulevar Meše Selimovića 16, 71000 Sarajevo<br/>
                Tel: +387 33 123 456
              </p>
            </div>
          </div>
        </div>
      `,
      attachments: [
        {
          filename: `ugovor-${fileContractNumber}.pdf`,
          content: pdfContent,
        },
      ],
    });

    if (error) throw error;
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[send-contract] email error:", err);
    return NextResponse.json({ error: "Email send failed" }, { status: 500 });
  }
}
