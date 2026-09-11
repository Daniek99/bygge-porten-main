import { serve } from "https://deno.land/std@0.190.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface InvitationEmailRequest {
  email: string;
  invitationCode: string;
  projectName: string;
  role: string;
  expiryDays: number;
  senderName: string;
  customRole?: string;
}

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const resendApiKey = Deno.env.get("RESEND_API_KEY");
    const fromEmail = Deno.env.get("RESEND_FROM_EMAIL");

    if (!resendApiKey || !fromEmail) {
      console.error("Missing RESEND_API_KEY or RESEND_FROM_EMAIL environment variables");
      return new Response(
        JSON.stringify({ error: "Server configuration error: missing email credentials" }),
        {
          status: 500,
          headers: { "Content-Type": "application/json", ...corsHeaders },
        }
      );
    }

    const {
      email,
      invitationCode,
      projectName,
      role,
      expiryDays = 7,
      senderName = "Prosjekt Admin",
      customRole,
    }: InvitationEmailRequest = await req.json();

    if (!email || !invitationCode || !projectName || !role) {
      return new Response(JSON.stringify({ error: "Missing required fields" }), {
        status: 400,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    const roleText =
      role === "level2"
        ? "Koordinator"
        : role === "level0"
        ? "Leverandør"
        : "Bestiller";

    const registrationUrl = "https://byggeporten.no/auth";
    const siteUrl = "https://byggeporten.no";
    const roleDescription = customRole ? `${roleText} (${customRole})` : roleText;

    const html = `<!DOCTYPE html>
<html lang="no">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background-color:#f1f5f9;">
  <!-- Preheader (hidden preview text) -->
  <div style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent;">
    ${senderName} har invitert deg til ${projectName} som ${roleDescription} &mdash; koden din utløper om ${expiryDays} dager.
  </div>

  <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="background-color:#f1f5f9;padding:32px 16px;">
    <tr><td align="center">
      <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="600" style="max-width:600px;width:100%;">
        <!-- Header -->
        <tr>
          <td style="background: linear-gradient(135deg, #0f172a 0%, #1e3a5f 50%, #2563eb 100%); border-radius:12px 12px 0 0; padding:28px 32px; text-align:center;">
            <div style="font-family:'Segoe UI',Arial,sans-serif; font-size:11px; font-weight:700; letter-spacing:3px; color:#93c5fd; text-transform:uppercase; margin-bottom:8px;">BYGGEPORTEN</div>
            <div style="font-family:'Segoe UI',Arial,sans-serif; font-size:22px; font-weight:800; color:#ffffff; line-height:1.2;">Du har fått en invitasjon &nbsp;🎉</div>
            <div style="font-family:'Segoe UI',Arial,sans-serif; font-size:13px; color:#bfdbfe; margin-top:6px; opacity:0.9;">${projectName}</div>
          </td>
        </tr>
        <!-- Card -->
        <tr>
          <td style="background-color:#ffffff; padding:32px; border-radius:0 0 12px 12px; box-shadow:0 4px 24px rgba(15,23,42,0.08);">
            <p style="margin:0 0 6px 0; font-family:'Segoe UI',Arial,sans-serif; font-size:15px; color:#334155; line-height:1.7;">
              Hei!
            </p>
            <p style="margin:0 0 20px 0; font-family:'Segoe UI',Arial,sans-serif; font-size:15px; color:#334155; line-height:1.7;">
              <strong style="color:#0f172a;">${senderName}</strong> har invitert deg til å bli med i prosjektet
              <strong style="color:#0f172a;">${projectName}</strong> som
              <span style="display:inline-block; background-color:#eff6ff; color:#1d4ed8; font-weight:700; font-size:13px; padding:3px 10px; border-radius:9999px; border:1px solid #bfdbfe; vertical-align:middle;">${roleDescription}</span>.
            </p>

            <!-- Invitation code -->
            <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="margin:24px 0 8px 0;">
              <tr>
                <td style="background-color:#f8fafc; border:2px dashed #cbd5e1; border-radius:10px; padding:20px 24px; text-align:center;">
                  <div style="font-family:'Segoe UI',Arial,sans-serif; font-size:11px; font-weight:700; letter-spacing:2px; text-transform:uppercase; color:#64748b; margin-bottom:10px;">Din invitasjonskode</div>
                  <div style="font-family:'Courier New',Courier,monospace; font-size:28px; font-weight:800; letter-spacing:6px; color:#0f172a; line-height:1;">${invitationCode}</div>
                  <div style="margin-top:12px;">
                    <span style="display:inline-block; font-family:'Segoe UI',Arial,sans-serif; font-size:12px; font-weight:600; color:#475569; background-color:#e2e8f0; padding:4px 12px; border-radius:9999px;">⏱ Utløper om ${expiryDays} dager</span>
                  </div>
                </td>
              </tr>
            </table>

            <p style="margin:4px 0 28px 0; text-align:center; font-family:'Segoe UI',Arial,sans-serif; font-size:12px; color:#94a3b8; line-height:1.5;">
              Kopier koden og lim den inn når du registrerer deg.
            </p>

            <!-- CTA button (only clickable element) -->
            <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%">
              <tr><td align="center" style="padding:4px 0 6px 0;">
                <a href="${registrationUrl}"
                   style="display:inline-block; background-color:#2563eb; color:#ffffff; font-family:'Segoe UI',Arial,sans-serif; font-size:15px; font-weight:700; letter-spacing:0.3px; text-decoration:none; padding:14px 36px; border-radius:8px; box-shadow:0 4px 12px rgba(37,99,235,0.35);">
                  Registrer deg nå &rarr;
                </a>
              </td></tr>
              <tr><td align="center" style="padding-top:10px;">
                <span style="font-family:'Segoe UI',Arial,sans-serif; font-size:12px; color:#94a3b8;">Knappen tar deg til <strong style="color:#64748b; font-weight:600;">${siteUrl}</strong></span>
              </td></tr>
            </table>

            <!-- Divider -->
            <hr style="border:none; border-top:1px solid #e2e8f0; margin:32px 0 20px 0;" />

            <!-- Help box -->
            <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="background-color:#f8fafc; border-radius:8px; border:1px solid #e2e8f0;">
              <tr>
                <td style="padding:14px 18px;">
                  <div style="font-family:'Segoe UI',Arial,sans-serif; font-size:12px; font-weight:700; color:#334155; margin-bottom:4px;">👀 Slik kommer du i gang</div>
                  <div style="font-family:'Segoe UI',Arial,sans-serif; font-size:12px; color:#64748b; line-height:1.6;">
                    1. Klikk på knappen over &nbsp;&middot;&nbsp; 2. Opprett konto med e-posten din &nbsp;&middot;&nbsp; 3. Lim inn invitasjonskoden når du blir spurt.
                  </div>
                </td>
              </tr>
            </table>

            <p style="margin:20px 0 0 0; font-family:'Segoe UI',Arial,sans-serif; font-size:11px; color:#94a3b8; line-height:1.6; text-align:center;">
              Hvis du ikke forventet denne invitasjonen, kan du se bort fra denne e-posten.<br />
              Trenger du hjelp? Svar på denne e-posten så hjelper vi deg.
            </p>
          </td>
        </tr>
        <!-- Footer -->
        <tr>
          <td style="padding:20px 8px 0 8px; text-align:center;">
            <div style="font-family:'Segoe UI',Arial,sans-serif; font-size:11px; color:#94a3b8; line-height:1.6;">
              Sendt via <strong style="color:#64748b;">Byggeporten</strong> &middot; <a href="${siteUrl}" style="color:#64748b; text-decoration:none;">${siteUrl}</a>
            </div>
            <div style="font-family:'Segoe UI',Arial,sans-serif; font-size:11px; color:#cbd5e1; margin-top:4px;">
              Sikker logistikk for byggeplassen
            </div>
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>
    `;

    const text = `Du har fått en invitasjon! 🎉

${senderName} har invitert deg til prosjektet ${projectName} som ${roleDescription}.

Din invitasjonskode: ${invitationCode}
Koden utløper om ${expiryDays} dager.

Registrer deg her: ${registrationUrl}

Slik kommer du i gang: 1) Klikk på lenken over 2) Opprett konto 3) Lim inn koden.

Hvis du ikke forventet denne invitasjonen, kan du ignorere denne e-posten.
--
Byggeporten · ${siteUrl}
`;

    const resendResponse = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${resendApiKey}`,
      },
      body: JSON.stringify({
        from: fromEmail,
        to: [email],
        subject: `Invitasjon til prosjekt: ${projectName}`,
        html,
        text,
      }),
    });

    if (!resendResponse.ok) {
      const errorBody = await resendResponse.text();
      console.error("Resend API error:", resendResponse.status, errorBody);
      return new Response(
        JSON.stringify({ error: `Failed to send email: ${resendResponse.status}` }),
        {
          status: 500,
          headers: { "Content-Type": "application/json", ...corsHeaders },
        }
      );
    }

    const result = await resendResponse.json();
    console.log("Invitation email sent via Resend:", result.id);

    return new Response(JSON.stringify({ success: true, id: result.id }), {
      status: 200,
      headers: {
        "Content-Type": "application/json",
        ...corsHeaders,
      },
    });
  } catch (error: any) {
    console.error("Error in send-invitation-email function:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  }
};

serve(handler);
