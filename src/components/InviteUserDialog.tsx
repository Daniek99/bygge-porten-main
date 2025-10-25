import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { UserPlus, Copy, Check } from "lucide-react";
import { validateCompany } from "@/lib/companyValidation";
import { CompanyInput } from "@/components/CompanyInput";

interface InviteUserDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projectId: string;
  projectName: string;
  userRole: "owner" | "level2" | "level1" | "level0" | null;
  isAdmin?: boolean;
}

interface InvitationData {
  code: string;
  role: "level2" | "level1" | "level0";
  company?: string;
  project_company_id?: string;
  expires_at: string;
  project_id: string;
  created_by: string;
}

export const InviteUserDialog = ({
  open,
  onOpenChange,
  projectId,
  projectName,
  userRole,
  isAdmin = false
}: InviteUserDialogProps) => {
  const [role, setRole] = useState<"level2" | "level1" | "level0">("level1");
  const [isLoading, setIsLoading] = useState(false);
  const [generatedCode, setGeneratedCode] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [expiryDays, setExpiryDays] = useState("7");
  const [recipientEmail, setRecipientEmail] = useState("");
  const [selectedCompanyId, setSelectedCompanyId] = useState<string>("");
  const [projectCompanies, setProjectCompanies] = useState<Array<{id: string, company_name: string}>>([]);
  const [customRole, setCustomRole] = useState("");
  const [suppliers, setSuppliers] = useState<Array<{id: string, name: string, contact_person: string, email: string, phone: string}>>([]);
  const [selectedSupplierId, setSelectedSupplierId] = useState<string>("");
  const [customSupplierName, setCustomSupplierName] = useState("");

  useEffect(() => {
    if (open && projectId) {
      fetchProjectCompanies();
      if (userRole === "level1") {
        fetchSuppliers();
      }
    }
  }, [open, projectId, userRole]);

  const fetchProjectCompanies = async () => {
    try {
      const { data, error } = await supabase
        .from("project_companies")
        .select("id, company_name")
        .eq("project_id", projectId)
        .order("company_name");

      if (error) {
        console.log("Project companies table doesn't exist yet, using fallback"); // Debug log
        setProjectCompanies([]);
        return;
      }
      console.log("Project companies fetched:", data); // Debug log
      setProjectCompanies(data || []);
    } catch (error) {
      console.error("Error fetching project companies:", error);
      setProjectCompanies([]);
    }
  };

  const fetchSuppliers = async () => {
    try {
      // Get the current user's company
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) return;

      const { data: profile } = await supabase
        .from("profiles")
        .select("company")
        .eq("id", userData.user.id)
        .single();

      if (!profile?.company) {
        setSuppliers([]);
        return;
      }

      // Fetch suppliers for the user's company
      const { data, error } = await supabase
        .from("suppliers")
        .select("*")
        .eq("company_name", profile.company)
        .order("name");

      if (error) {
        console.log("Suppliers table doesn't exist yet, using fallback");
        setSuppliers([]);
        return;
      }
      setSuppliers(data || []);
    } catch (error) {
      console.error("Error fetching suppliers:", error);
      setSuppliers([]);
    }
  };

  const canInviteLevel2 = userRole === "owner" || userRole === "level2";
  const canInviteLevel1 = userRole === "owner" || userRole === "level2" || userRole === "level1";
  const canInviteLevel0 = userRole === "owner" || userRole === "level2" || userRole === "level1";
  const shouldPromptCompany = isAdmin || userRole === "owner" || userRole === "level2";

  const generateCode = () => {
    const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
    let code = "";
    for (let i = 0; i < 8; i++) {
      code += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return code;
  };

  const handleGenerateInvite = async () => {
    if (!recipientEmail || !recipientEmail.includes("@")) {
      toast.error("Vennligst skriv inn en gyldig e-postadresse");
      return;
    }

    // For level 1 users inviting level 1 users, automatically assign same company
    if (userRole === "level1" && role === "level1") {
      try {
        const { data: invitingUser } = await supabase.auth.getUser();
        if (invitingUser.user) {
          const { data: invitingProfile } = await supabase
            .from("profiles")
            .select("company")
            .eq("id", invitingUser.user.id)
            .single();

          if (invitingProfile?.company) {
            // Set company to inviting user's company
            setSelectedCompanyId(invitingProfile.company);
          }
        }
      } catch (error) {
        console.error("Error fetching inviting user's company:", error);
      }
    }

    if (shouldPromptCompany && !selectedCompanyId && projectCompanies.length > 0) {
      toast.error("Vennligst velg et firma");
      return;
    }

    setIsLoading(true);
    try {
      // Check if user already exists
      const { data: existingProfile } = await supabase
        .from("profiles")
        .select("id")
        .eq("email", recipientEmail)
        .single();

      if (existingProfile) {
        // Add existing user directly to project
        const { error: addError } = await supabase
          .from("project_members")
          .insert({
            project_id: projectId,
            user_id: existingProfile.id,
            role: role,
          });

        if (addError) {
          toast.error("Kunne ikke legge til bruker");
          return;
        }

        // Update company if provided
        if (shouldPromptCompany && selectedCompanyId) {
          const selectedCompany = projectCompanies.find(c => c.id === selectedCompanyId);
          if (selectedCompany) {
            await supabase
              .from("profiles")
              .update({ company: selectedCompany.company_name })
              .eq("id", existingProfile.id);
          }
        }

        // For level 1 users inviting level 0 users, set supplier company
        if (userRole === "level1" && role === "level0") {
          const supplierName = selectedSupplierId
            ? suppliers.find(s => s.id === selectedSupplierId)?.name
            : customSupplierName.trim() || "Leverandør";

          if (supplierName) {
            await supabase
              .from("profiles")
              .update({ company: supplierName })
              .eq("id", existingProfile.id);
          }
        }

        toast.success("Bruker lagt til prosjektet!");
        onOpenChange(false);
        return;
      }

      // For new users, create invitation code
      const code = generateCode();
      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + parseInt(expiryDays));

      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) throw new Error("Ikke innlogget");

      // Get sender profile
      const { data: profile } = await supabase
        .from("profiles")
        .select("full_name")
        .eq("id", userData.user.id)
        .single();

      // Create invitation code
      const invitationData: InvitationData = {
        project_id: projectId,
        code,
        role,
        created_by: userData.user.id,
        expires_at: expiresAt.toISOString(),
      };

      // For now, store company name in the existing company field until project_companies migration is applied
      if (shouldPromptCompany && selectedCompanyId) {
        // Find the company name from the selected company
        const selectedCompany = projectCompanies.find(c => c.id === selectedCompanyId);
        if (selectedCompany) {
          invitationData.company = selectedCompany.company_name;
        }
      }

      // For level 1 users inviting level 0 users, set supplier company
      if (userRole === "level1" && role === "level0") {
        const supplierName = selectedSupplierId
          ? suppliers.find(s => s.id === selectedSupplierId)?.name
          : customSupplierName.trim() || "Leverandør";
        invitationData.company = supplierName;
      }

      const { error } = await supabase.from("invitation_codes").insert(invitationData);

      if (error) throw error;

      // Send invitation email
      const { error: emailError } = await supabase.functions.invoke("send-invitation-email", {
        body: {
          email: recipientEmail,
          invitationCode: code,
          projectName,
          role,
          expiryDays: parseInt(expiryDays),
          senderName: profile?.full_name || userData.user.email || "En prosjektadministrator",
          customRole: customRole.trim() || undefined,
        },
      });

      if (emailError) throw emailError;

      setGeneratedCode(code);
      toast.success("Invitasjon sendt på e-post!");
    } catch (error: any) {
      console.error("Error creating invitation:", error);
      toast.error("Kunne ikke sende invitasjon");
    } finally {
      setIsLoading(false);
    }
  };

  const copyToClipboard = () => {
    if (generatedCode) {
      navigator.clipboard.writeText(generatedCode);
      setCopied(true);
      toast.success("Kode kopiert!");
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleClose = () => {
    onOpenChange(false);
    setGeneratedCode(null);
    setCopied(false);
    setRole("level1");
    setExpiryDays("7");
    setRecipientEmail("");
    setSelectedCompanyId("");
    setCustomRole("");
  };

  return (
    <Dialog open={open} onOpenChange={(isOpen) => (isOpen ? onOpenChange(isOpen) : handleClose())}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Inviter bruker til {projectName}</DialogTitle>
          <DialogDescription>
            Inviter en bruker til prosjektet. Eksisterende brukere legges til direkte, nye brukere mottar en invitasjonskode på e-post.
          </DialogDescription>
        </DialogHeader>

        {!generatedCode ? (
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="email">E-post til mottaker *</Label>
              <Input
                id="email"
                type="email"
                placeholder="eksempel@firma.no"
                value={recipientEmail}
                onChange={(e) => setRecipientEmail(e.target.value)}
                required
              />
              <p className="text-xs text-muted-foreground">
                Invitasjonen vil bli sendt til denne e-postadressen
              </p>
            </div>

            <div className="grid gap-2">
              <Label htmlFor="role">Tilgangsnivå</Label>
              <Select value={role} onValueChange={(v) => setRole(v as "level2" | "level1")}>
                <SelectTrigger id="role">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {canInviteLevel0 && (
                    <SelectItem value="level0">Nivå 0 - Leverandør</SelectItem>
                  )}
                  {canInviteLevel1 && (
                    <SelectItem value="level1">Nivå 1 - Bestiller</SelectItem>
                  )}
                  {canInviteLevel2 && (
                    <SelectItem value="level2">Nivå 2 - Koordinator</SelectItem>
                  )}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                {role === "level0"
                  ? "Kan kun se bookinger for sitt eget firma"
                  : role === "level1"
                  ? "Kan opprette bookinger og invitere andre brukere"
                  : "Kan godkjenne/avvise bookinger og invitere andre brukere"}
              </p>
            </div>

            {shouldPromptCompany && (
              <div className="grid gap-2">
                <Label htmlFor="company">Firma *</Label>
                {projectCompanies.length > 0 ? (
                  <Select value={selectedCompanyId} onValueChange={setSelectedCompanyId}>
                    <SelectTrigger>
                      <SelectValue placeholder="Velg firma" />
                    </SelectTrigger>
                    <SelectContent>
                      {projectCompanies.map((company) => (
                        <SelectItem key={company.id} value={company.id}>
                          {company.company_name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                ) : (
                  <div className="p-2 border rounded-md bg-muted/50">
                    <p className="text-sm text-muted-foreground">
                      Ingen foretak er lagt til prosjektet ennå. Kontakt administrator for å legge til foretak.
                    </p>
                  </div>
                )}
                <p className="text-xs text-muted-foreground">
                  Velg firma fra prosjektets godkjente firmaliste
                </p>
              </div>
            )}

            {/* Supplier selection for level 1 users inviting level 0 users */}
            {userRole === "level1" && role === "level0" && (
              <div className="grid gap-2">
                <Label htmlFor="supplier">Leverandør *</Label>
                <Select value={selectedSupplierId} onValueChange={setSelectedSupplierId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Velg leverandør" />
                  </SelectTrigger>
                  <SelectContent>
                    {suppliers.map((supplier) => (
                      <SelectItem key={supplier.id} value={supplier.id}>
                        {supplier.name} - {supplier.contact_person}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">
                  Velg leverandør fra listen eller skriv inn navn nedenfor
                </p>
              </div>
            )}

            {/* Custom supplier name input for level 1 users inviting level 0 users */}
            {userRole === "level1" && role === "level0" && (
              <div className="grid gap-2">
                <Label htmlFor="customSupplier">Eller skriv inn leverandørnavn</Label>
                <Input
                  id="customSupplier"
                  placeholder="f.eks. ByggPartner AS"
                  value={customSupplierName}
                  onChange={(e) => setCustomSupplierName(e.target.value)}
                />
                <p className="text-xs text-muted-foreground">
                  Valgfritt: Skriv inn leverandørnavn hvis ikke i listen over
                </p>
              </div>
            )}

            <div className="grid gap-2">
              <Label htmlFor="customRole">Rolle</Label>
              <Input
                id="customRole"
                placeholder="f.eks. Prosjektleder, Elektriker"
                value={customRole}
                onChange={(e) => setCustomRole(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">
                Valgfri rollebeskrivelse for brukeren
              </p>
            </div>

            <div className="grid gap-2">
              <Label htmlFor="expiry">Utløper om (dager)</Label>
              <Input
                id="expiry"
                type="number"
                min="1"
                max="90"
                value={expiryDays}
                onChange={(e) => setExpiryDays(e.target.value)}
              />
            </div>
          </div>
        ) : (
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label>Din invitasjonskode</Label>
              <div className="flex items-center gap-2">
                <Input
                  value={generatedCode}
                  readOnly
                  className="font-mono text-lg text-center tracking-wider"
                />
                <Button
                  size="icon"
                  variant="outline"
                  onClick={copyToClipboard}
                >
                  {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                </Button>
              </div>
              <p className="text-sm text-muted-foreground">
                Invitasjonen har blitt sendt til <strong>{recipientEmail}</strong>. 
                Koden utløper om {expiryDays} dager.
              </p>
            </div>
          </div>
        )}

        <DialogFooter>
          {!generatedCode ? (
            <>
              <Button variant="outline" onClick={handleClose}>
                Avbryt
              </Button>
              <Button onClick={handleGenerateInvite} disabled={isLoading || !recipientEmail || (shouldPromptCompany && !selectedCompanyId && projectCompanies.length > 0)}>
                Send invitasjon
              </Button>
            </>
          ) : (
            <Button onClick={handleClose}>Ferdig</Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
