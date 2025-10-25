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
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { Plus, Trash2, Edit } from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

interface Supplier {
  id: string;
  company_name: string;
  name: string;
  contact_person: string;
  email: string;
  phone: string;
  address: string;
  created_by: string;
  created_at: string;
}

interface SupplierManagementProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projectId: string;
  currentUserRole: "owner" | "level2" | "level1" | "level0" | null;
}

export const SupplierManagement = ({
  open,
  onOpenChange,
  projectId,
  currentUserRole,
}: SupplierManagementProps) => {
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isAddingSupplier, setIsAddingSupplier] = useState(false);
  const [editingSupplier, setEditingSupplier] = useState<Supplier | null>(null);
  const [userCompany, setUserCompany] = useState<string>("");

  // Form state
  const [supplierName, setSupplierName] = useState("");
  const [contactPerson, setContactPerson] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [address, setAddress] = useState("");

  useEffect(() => {
    if (open) {
      fetchUserCompany();
      fetchSuppliers();
    }
  }, [open]);

  const fetchUserCompany = async () => {
    try {
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) return;

      const { data: profile } = await supabase
        .from("profiles")
        .select("company")
        .eq("id", userData.user.id)
        .single();

      if (profile?.company) {
        setUserCompany(profile.company);
      }
    } catch (error) {
      console.error("Error fetching user company:", error);
    }
  };

  const fetchSuppliers = async () => {
    try {
      setIsLoading(true);

      if (!userCompany) {
        setSuppliers([]);
        return;
      }

      const { data, error } = await supabase
        .from("suppliers")
        .select("*")
        .eq("company_name", userCompany)
        .order("name");

      if (error) {
        console.log("Error fetching suppliers:", error);
        setSuppliers([]);
        return;
      }

      setSuppliers(data || []);
    } catch (error) {
      console.error("Error fetching suppliers:", error);
      setSuppliers([]);
    } finally {
      setIsLoading(false);
    }
  };

  const resetForm = () => {
    setSupplierName("");
    setContactPerson("");
    setEmail("");
    setPhone("");
    setAddress("");
    setEditingSupplier(null);
  };

  const handleAddSupplier = () => {
    setIsAddingSupplier(true);
    resetForm();
  };

  const handleEditSupplier = (supplier: Supplier) => {
    setEditingSupplier(supplier);
    setSupplierName(supplier.name);
    setContactPerson(supplier.contact_person || "");
    setEmail(supplier.email || "");
    setPhone(supplier.phone || "");
    setAddress(supplier.address || "");
  };

  const handleSaveSupplier = async () => {
    if (!supplierName.trim()) {
      toast.error("Leverandørnavn er påkrevd");
      return;
    }

    if (!userCompany) {
      toast.error("Kunne ikke identifisere ditt firma");
      return;
    }

    try {
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) throw new Error("Ikke innlogget");

      const supplierData = {
        company_name: userCompany,
        name: supplierName.trim(),
        contact_person: contactPerson.trim() || null,
        email: email.trim() || null,
        phone: phone.trim() || null,
        address: address.trim() || null,
        created_by: userData.user.id,
      };

      if (editingSupplier) {
        // Update existing supplier
        const { error } = await supabase
          .from("suppliers")
          .update(supplierData)
          .eq("id", editingSupplier.id);

        if (error) throw error;
        toast.success("Leverandør oppdatert!");
      } else {
        // Add new supplier
        const { error } = await supabase
          .from("suppliers")
          .insert(supplierData);

        if (error) throw error;
        toast.success("Leverandør lagt til!");
      }

      fetchSuppliers();
      setIsAddingSupplier(false);
      resetForm();
    } catch (error: any) {
      console.error("Error saving supplier:", error);
      if (error.code === "23505") {
        toast.error("En leverandør med dette navnet finnes allerede");
      } else {
        toast.error("Kunne ikke lagre leverandør");
      }
    }
  };

  const handleDeleteSupplier = async (supplierId: string, supplierName: string) => {
    try {
      const { error } = await supabase
        .from("suppliers")
        .delete()
        .eq("id", supplierId);

      if (error) throw error;

      toast.success(`${supplierName} fjernet fra leverandørliste`);
      fetchSuppliers();
    } catch (error: any) {
      console.error("Error deleting supplier:", error);
      toast.error("Kunne ikke fjerne leverandør");
    }
  };

  const handleCancel = () => {
    setIsAddingSupplier(false);
    resetForm();
  };

  if (currentUserRole !== "level1") {
    return null;
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px] max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Administrer leverandører</DialogTitle>
          <DialogDescription>
            Legg til, rediger og fjern leverandører for {userCompany}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Add Supplier Button */}
          <div className="flex justify-end">
            <Button onClick={handleAddSupplier} size="sm">
              <Plus className="mr-2 h-4 w-4" />
              Legg til leverandør
            </Button>
          </div>

          {/* Add/Edit Supplier Form */}
          {(isAddingSupplier || editingSupplier) && (
            <div className="border rounded-lg p-4 space-y-4 bg-muted/50">
              <h4 className="font-semibold">
                {editingSupplier ? "Rediger leverandør" : "Legg til ny leverandør"}
              </h4>

              <div className="grid gap-4">
                <div className="grid gap-2">
                  <Label htmlFor="supplierName">Leverandørnavn *</Label>
                  <Input
                    id="supplierName"
                    placeholder="f.eks. ByggPartner AS"
                    value={supplierName}
                    onChange={(e) => setSupplierName(e.target.value)}
                    required
                  />
                </div>

                <div className="grid gap-2">
                  <Label htmlFor="contactPerson">Kontaktperson</Label>
                  <Input
                    id="contactPerson"
                    placeholder="f.eks. Ole Hansen"
                    value={contactPerson}
                    onChange={(e) => setContactPerson(e.target.value)}
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="grid gap-2">
                    <Label htmlFor="email">E-post</Label>
                    <Input
                      id="email"
                      type="email"
                      placeholder="ole@byggpartner.no"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                    />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="phone">Telefon</Label>
                    <Input
                      id="phone"
                      placeholder="+47 123 45 678"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                    />
                  </div>
                </div>

                <div className="grid gap-2">
                  <Label htmlFor="address">Adresse</Label>
                  <Textarea
                    id="address"
                    placeholder="Gateadresse, postnummer, sted"
                    value={address}
                    onChange={(e) => setAddress(e.target.value)}
                    rows={2}
                  />
                </div>
              </div>

              <div className="flex gap-2 justify-end">
                <Button variant="outline" onClick={handleCancel}>
                  Avbryt
                </Button>
                <Button onClick={handleSaveSupplier}>
                  {editingSupplier ? "Oppdater" : "Lagre"}
                </Button>
              </div>
            </div>
          )}

          {/* Suppliers List */}
          <div className="space-y-2">
            <h4 className="font-semibold">Leverandører ({suppliers.length})</h4>

            {isLoading ? (
              <div className="text-center py-8">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
                <p className="text-muted-foreground mt-2">Laster leverandører...</p>
              </div>
            ) : suppliers.length === 0 ? (
              <div className="text-center py-8 border rounded-lg">
                <p className="text-muted-foreground">Ingen leverandører registrert ennå</p>
                <Button onClick={handleAddSupplier} variant="outline" size="sm" className="mt-2">
                  <Plus className="mr-2 h-4 w-4" />
                  Legg til første leverandør
                </Button>
              </div>
            ) : (
              <div className="space-y-2 max-h-60 overflow-y-auto">
                {suppliers.map((supplier) => (
                  <div key={supplier.id} className="flex items-center justify-between p-3 border rounded-lg">
                    <div className="flex-1">
                      <p className="font-medium">{supplier.name}</p>
                      {supplier.contact_person && (
                        <p className="text-sm text-muted-foreground">{supplier.contact_person}</p>
                      )}
                      {(supplier.email || supplier.phone) && (
                        <p className="text-sm text-muted-foreground">
                          {supplier.email && supplier.phone
                            ? `${supplier.email} • ${supplier.phone}`
                            : supplier.email || supplier.phone}
                        </p>
                      )}
                    </div>
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        size="icon"
                        onClick={() => handleEditSupplier(supplier)}
                      >
                        <Edit className="h-4 w-4" />
                      </Button>
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button variant="outline" size="icon">
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Fjern leverandør?</AlertDialogTitle>
                            <AlertDialogDescription>
                              Dette vil fjerne {supplier.name} fra leverandørlisten.
                              Leverandøren vil fortsatt være tilgjengelig for eksisterende bookinger.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Avbryt</AlertDialogCancel>
                            <AlertDialogAction
                              onClick={() => handleDeleteSupplier(supplier.id, supplier.name)}
                              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                            >
                              Fjern
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Lukk
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};