import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import { Loader2, Building2 } from "lucide-react";
import { validateCompany } from "@/lib/companyValidation";
import { CompanyInput } from "@/components/CompanyInput";

const Auth = () => {
  const [isLoading, setIsLoading] = useState(false);
  const [isSignUp, setIsSignUp] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [company, setCompany] = useState("");
  const [phone, setPhone] = useState("");
  const [invitationCode, setInvitationCode] = useState("");
  const [step, setStep] = useState<"code" | "register">("code");
  const navigate = useNavigate();

  // Check if user is admin email - they don't need invitation code
  const isAdminEmail = (email: string) => email === "daniel-ekman@hotmail.com";

  const handleVerifyCode = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!invitationCode) {
      toast.error("Vennligst skriv inn invitasjonskode");
      return;
    }

    setIsLoading(true);

    try {
      const { data, error } = await supabase
        .from("invitation_codes")
        .select("*")
        .eq("code", invitationCode.toUpperCase())
        .eq("is_active", true)
        .is("used_by", null)
        .single();

      if (error || !data) {
        toast.error("Ugyldig eller utløpt invitasjonskode");
        return;
      }

      const expiresAt = new Date(data.expires_at);
      if (expiresAt < new Date()) {
        toast.error("Invitasjonskoden har utløpt");
        return;
      }

      toast.success("Invitasjonskode godkjent! Fyll ut registreringsskjema.");
      setStep("register");
    } catch (error: any) {
      console.error("Verification error:", error);
      toast.error("Kunne ikke verifisere koden");
    } finally {
      setIsLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!email || !password) {
      toast.error("Vennligst fyll ut alle påkrevde felt");
      return;
    }

    if (isSignUp && !fullName) {
      toast.error("Vennligst fyll ut navn");
      return;
    }

    if (isSignUp && !company) {
      toast.error("Vennligst fyll ut firma");
      return;
    }

    if (isSignUp && !phone) {
      toast.error("Vennligst fyll ut telefonnummer");
      return;
    }

    // Validate company against Brønnøysundregisteret
    if (isSignUp && company) {
      const isValidCompany = await validateCompany(company);
      if (!isValidCompany) {
        toast.error("Firmaet kunne ikke valideres mot Brønnøysundregisteret. Vennligst sjekk at navnet er korrekt.");
        return;
      }
    }

    setIsLoading(true);

    try {
      if (isSignUp) {
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            data: {
              full_name: fullName,
              company,
              phone,
            },
            emailRedirectTo: `${window.location.origin}/auth`,
          },
        });

        if (error) throw error;

        if (data.user) {
          // Only use invitation code if user is not admin
          if (!isAdminEmail(email)) {
            try {
              const { data: result, error: codeError } = await supabase.rpc("use_invitation_code", {
                _code: invitationCode.toUpperCase(),
                _user_id: data.user.id,
              });

              if (codeError) {
                console.error("Invitation code error:", codeError);
                toast.error("Kunne ikke aktivere invitasjonskode. Du kan fortsatt logge inn.");
              }
            } catch (codeError) {
              console.error("Error using invitation code:", codeError);
              toast.error("Kunne ikke aktivere invitasjonskode. Du kan fortsatt logge inn.");
            }
          }

          toast.success("Registrering vellykket! En bekreftelses-e-post er sendt til din adresse.");
          setIsSignUp(false);
          setStep("code");
          setInvitationCode("");
        }
      } else {
        const { data, error } = await supabase.auth.signInWithPassword({
          email,
          password,
        });

        if (error) throw error;

        if (data.session) {
          toast.success("Innlogging vellykket!");
          navigate("/");
        }
      }
    } catch (error: any) {
      console.error("Auth error:", error);
      toast.error(error.message || "Det oppstod en feil");
    } finally {
      setIsLoading(false);
    }
  };

  // Skip invitation code step for admin email
  if (isSignUp && step === "code" && !isAdminEmail(email)) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-muted via-background to-muted p-4">
        <Card className="w-full max-w-md">
          <CardHeader className="space-y-1 flex flex-col items-center">
            <div className="w-12 h-12 bg-primary rounded-lg flex items-center justify-center mb-2">
              <Building2 className="w-6 h-6 text-primary-foreground" />
            </div>
            <CardTitle className="text-2xl font-bold text-center">
              Invitasjonskode
            </CardTitle>
            <CardDescription className="text-center">
              Skriv inn invitasjonskoden du har mottatt for å registrere deg
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleVerifyCode} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="code">Invitasjonskode *</Label>
                <Input
                  id="code"
                  placeholder="XXXXXXXX"
                  value={invitationCode}
                  onChange={(e) => setInvitationCode(e.target.value.toUpperCase())}
                  disabled={isLoading}
                  required
                  className="font-mono text-center tracking-wider uppercase"
                  maxLength={8}
                />
              </div>
              <Button type="submit" className="w-full" disabled={isLoading}>
                {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Verifiser kode
              </Button>
              <Button
                type="button"
                variant="ghost"
                className="w-full"
                onClick={() => setIsSignUp(false)}
                disabled={isLoading}
              >
                Har du allerede en konto? Logg inn
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-muted via-background to-muted p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="space-y-1 flex flex-col items-center">
          <div className="w-12 h-12 bg-primary rounded-lg flex items-center justify-center mb-2">
            <Building2 className="w-6 h-6 text-primary-foreground" />
          </div>
          <CardTitle className="text-2xl font-bold text-center">
            {isSignUp ? "Opprett konto" : "Logg inn"}
          </CardTitle>
          <CardDescription className="text-center">
            {isSignUp
              ? "Fyll ut informasjonen din for å fullføre registreringen"
              : "Logg inn for å administrere dine leveranser"}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            {isSignUp && (
              <>
                <div className="space-y-2">
                  <Label htmlFor="fullName">Fullt navn *</Label>
                  <Input
                    id="fullName"
                    placeholder="Ola Nordmann"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    disabled={isLoading}
                    required={isSignUp}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="company">Firma *</Label>
                  <CompanyInput
                    value={company}
                    onChange={setCompany}
                    placeholder="Nordmann Bygg AS"
                    required
                    disabled={isLoading}
                  />
                  <p className="text-xs text-muted-foreground">
                    Firmaet må være registrert i Brønnøysundregisteret
                  </p>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="phone">Telefon *</Label>
                  <Input
                    id="phone"
                    type="tel"
                    placeholder="+47 123 45 678"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    disabled={isLoading}
                    required
                  />
                </div>
              </>
            )}
            <div className="space-y-2">
              <Label htmlFor="email">E-post *</Label>
              <Input
                id="email"
                type="email"
                placeholder="ola@eksempel.no"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                disabled={isLoading}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Passord *</Label>
              <Input
                id="password"
                type="password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                disabled={isLoading}
                required
                minLength={6}
              />
            </div>
            <Button type="submit" className="w-full" disabled={isLoading}>
              {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {isSignUp ? "Registrer" : "Logg inn"}
            </Button>
            <Button
              type="button"
              variant="ghost"
              className="w-full"
              onClick={() => setIsSignUp(!isSignUp)}
              disabled={isLoading}
            >
              {isSignUp ? "Har du allerede en konto? Logg inn" : "Har du ikke konto? Registrer deg"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
};

export default Auth;