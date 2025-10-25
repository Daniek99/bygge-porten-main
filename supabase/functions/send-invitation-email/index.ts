import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

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
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!supabaseUrl || !supabaseServiceKey) {
      console.error("Missing Supabase environment variables");
      return new Response(JSON.stringify({ error: "Server configuration error" }), {
        status: 500,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const {
      email,
      invitationCode,
      projectName,
      role,
      expiryDays = 7,
      senderName = "Prosjekt Admin",
      customRole
    }: InvitationEmailRequest = await req.json();

    if (!email || !invitationCode || !projectName || !role) {
      return new Response(JSON.stringify({ error: "Missing required fields" }), {
        status: 400,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    const roleText = role === "level2" ? "Koordinator (Nivå 2)" : role === "level0" ? "Leverandør (Nivå 0)" : "Bestiller (Nivå 1)";
    const registrationUrl = `${req.headers.get("origin") || "http://127.0.0.1:8081"}/auth`;

    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #f9fafb;">
        <div style="background-color: white; padding: 30px; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
          <h1 style="color: #1f2937; margin-top: 0;">Du har fått en invitasjon!</h1>

          <p style="color: #4b5563; font-size: 16px; line-height: 1.6;">
            ${senderName} har invitert deg til å bli med i prosjektet <strong>${projectName}</strong>
            som <strong>${roleText}</strong>${customRole ? ` (${customRole})` : ''}.
          </p>

          <div style="background-color: #f3f4f6; padding: 20px; border-radius: 6px; margin: 25px 0;">
            <p style="margin: 0 0 10px 0; color: #6b7280; font-size: 14px;">Din invitasjonskode:</p>
            <p style="margin: 0; font-size: 24px; font-weight: bold; letter-spacing: 4px; color: #1f2937; font-family: 'Courier New', monospace;">
              ${invitationCode}
            </p>
          </div>

          <p style="color: #6b7280; font-size: 14px;">
            Koden utløper om <strong>${expiryDays} dager</strong>.
          </p>

          <div style="margin: 30px 0;">
            <a href="${registrationUrl}"
               style="display: inline-block; background-color: #2563eb; color: white; padding: 12px 30px; text-decoration: none; border-radius: 6px; font-weight: 500;">
              Registrer deg nå
            </a>
          </div>

          <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 30px 0;" />

          <p style="color: #9ca3af; font-size: 12px; line-height: 1.5;">
            Hvis du ikke forventet denne invitasjonen, kan du ignorere denne e-posten.
          </p>
        </div>
      </div>
    `;

    // For development: Just log the email and return success
    console.log("=== INVITATION EMAIL SIMULATED ===");
    console.log("To:", email);
    console.log("Subject:", `Invitasjon til prosjekt: ${projectName}`);
    console.log("Role:", role);
    console.log("Custom Role:", customRole);
    console.log("Project:", projectName);
    console.log("Invitation Code:", invitationCode);
    console.log("HTML Preview:", html.substring(0, 200) + "...");
    console.log("=================================");

    // Return success without actually sending email
    console.log("Email simulation completed successfully");

    return new Response(JSON.stringify({ success: true }), {
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