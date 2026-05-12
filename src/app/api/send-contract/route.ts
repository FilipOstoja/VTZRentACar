import { NextRequest, NextResponse } from "next/server";
import { Resend } from "resend";

const resend = new Resend(process.env.RESEND_API_KEY);

export async function POST(req: NextRequest) {
  const { to, contractNumber, clientName, pdfBase64 } = await req.json();

  if (!to || !pdfBase64) {
    return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
  }

  try {
    const { error } = await resend.emails.send({
      from: "VTZ Rent-a-Car <onboarding@resend.dev>",
      to: [to],
      subject: `Ugovor o najmu vozila — ${contractNumber}`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <div style="background: #003580; padding: 24px 32px;">
            <h1 style="color: white; margin: 0; font-size: 22px; letter-spacing: 1px;">VTZ RENT-A-CAR</h1>
          </div>
          <div style="padding: 32px; background: #ffffff;">
            <p style="color: #475569; font-size: 15px;">Poštovani/a <strong style="color: #1e293b;">${clientName}</strong>,</p>
            <p style="color: #475569; font-size: 15px; line-height: 1.6;">
              U prilogu se nalazi vaš <strong>Ugovor o kratkoročnom najmu vozila</strong> br.
              <strong style="color: #003580;">${contractNumber}</strong>,
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
          filename: `ugovor-${contractNumber}.pdf`,
          content: pdfBase64,
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
