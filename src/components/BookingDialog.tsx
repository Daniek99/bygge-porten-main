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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { format, isWithinInterval, setHours, setMinutes, parse, isValid } from "date-fns";
import { nb } from "date-fns/locale";
import { AlertCircle } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";

interface WorkingHours {
  start: string;
  end: string;
  enabled: boolean;
}

interface BookingDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projectId: string;
  gateId: string;
  startTime: Date;
  endTime: Date;
  workingHours: WorkingHours;
  userRole?: "owner" | "level2" | "level1" | "level0" | null;
  onSuccess: () => void;
  isElevator?: boolean;
  editBooking?: any; // For editing existing booking
}

export const BookingDialog = ({
  open,
  onOpenChange,
  projectId,
  gateId,
  startTime,
  endTime,
  workingHours,
  userRole,
  onSuccess,
  isElevator = false,
  editBooking,
}: BookingDialogProps) => {
  const [isLoading, setIsLoading] = useState(false);
  const [supplierName, setSupplierName] = useState("");
  const [contactName, setContactName] = useState("");
  const [contactPhone, setContactPhone] = useState("");
  const [contactEmail, setContactEmail] = useState("");
  const [vehicleType, setVehicleType] = useState("");
  const [notes, setNotes] = useState("");
  const [floors, setFloors] = useState("");
  const [purpose, setPurpose] = useState("");
  const [loadWeight, setLoadWeight] = useState("");
  const [customStartTime, setCustomStartTime] = useState("");
  const [customEndTime, setCustomEndTime] = useState("");
  const [selectedSupplierId, setSelectedSupplierId] = useState<string>("");
  const [suppliers, setSuppliers] = useState<Array<{id: string, name: string, contact_person: string, email: string, phone: string}>>([]);
  const [userProfile, setUserProfile] = useState<{
    company: string;
    full_name: string;
    phone: string;
    email: string;
  } | null>(null);

  useEffect(() => {
    if (open) {
      if (editBooking) {
        // Populate fields for editing
        setSupplierName(editBooking.supplier_name || "");
        setContactName(editBooking.contact_name || "");
        setContactPhone(editBooking.contact_phone || "");
        setContactEmail(editBooking.contact_email || "");
        setVehicleType(editBooking.vehicle_type || "");
        setNotes(editBooking.notes || "");
        setFloors(editBooking.floors || "");
        setPurpose(editBooking.purpose || "");
        setLoadWeight(editBooking.load_weight ? editBooking.load_weight.toString() : "");
        setCustomStartTime(format(new Date(editBooking.start_time), "HH:mm"));
        setCustomEndTime(format(new Date(editBooking.end_time), "HH:mm"));
        setSelectedSupplierId(editBooking.supplier_id || "");
      } else {
        // New booking
        setCustomStartTime(format(startTime, "HH:mm"));
        setCustomEndTime(format(endTime, "HH:mm"));
        fetchUserProfile();
        fetchSuppliers();
      }
    }
  }, [open, startTime, endTime, editBooking]);

  const fetchUserProfile = async () => {
    try {
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) return;

      const { data: profile, error } = await supabase
        .from("profiles")
        .select("company, full_name, phone, email")
        .eq("id", userData.user.id)
        .single();

      if (error) throw error;

      setUserProfile(profile);
      // Auto-populate fields from user profile
      setSupplierName(profile.company || "");
      setContactName(profile.full_name || "");
      setContactPhone(profile.phone || "");
      setContactEmail(profile.email || userData.user.email || "");
    } catch (error) {
      console.error("Error fetching user profile:", error);
    }
  };

  const fetchSuppliers = async () => {
    try {
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
        console.log("Suppliers table doesn't exist yet or error fetching:", error);
        setSuppliers([]);
        return;
      }
      setSuppliers(data || []);
    } catch (error) {
      console.error("Error fetching suppliers:", error);
      setSuppliers([]);
    }
  };

  const getActualTimes = () => {
    const dateStr = format(startTime, "yyyy-MM-dd");
    const startDateTime = parse(`${dateStr} ${customStartTime}`, "yyyy-MM-dd HH:mm", new Date());
    const endDateTime = parse(`${dateStr} ${customEndTime}`, "yyyy-MM-dd HH:mm", new Date());

    if (!isValid(startDateTime) || !isValid(endDateTime)) {
      return { start: startTime, end: endTime };
    }

    return { start: startDateTime, end: endDateTime };
  };

  const isOutsideWorkingHours = () => {
    if (!workingHours.enabled) return true;

    const { start: actualStart, end: actualEnd } = getActualTimes();

    const [startHour, startMin] = workingHours.start.split(':').map(Number);
    const [endHour, endMin] = workingHours.end.split(':').map(Number);

    const workStart = setMinutes(setHours(actualStart, startHour), startMin);
    const workEnd = setMinutes(setHours(actualStart, endHour), endMin);

    return !(
      isWithinInterval(actualStart, { start: workStart, end: workEnd }) &&
      isWithinInterval(actualEnd, { start: workStart, end: workEnd })
    );
  };

  const requiresApproval = isOutsideWorkingHours();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!supplierName || !contactName || !contactPhone) {
      toast.error("Vennligst fyll ut alle påkrevde felt");
      return;
    }

    if (isElevator && !floors) {
      toast.error("Vennligst oppgi hvilke etasjer som skal brukes");
      return;
    }

    const { start: actualStart, end: actualEnd } = getActualTimes();

    if (actualStart >= actualEnd) {
      toast.error("Starttid må være før sluttid");
      return;
    }

    const duration = (actualEnd.getTime() - actualStart.getTime()) / (1000 * 60);
    if (duration < 15) {
      toast.error("Minimum bookinglengde er 15 minutter");
      return;
    }

    setIsLoading(true);

    try {
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) throw new Error("Ikke innlogget");

      const updateData: any = {
        start_time: actualStart.toISOString(),
        end_time: actualEnd.toISOString(),
        supplier_name: supplierName,
        contact_name: contactName,
        contact_phone: contactPhone,
        contact_email: contactEmail || null,
        vehicle_type: vehicleType || null,
        notes: notes || null,
      };

      if (isElevator) {
        updateData.floors = floors || null;
        updateData.purpose = purpose || null;
        updateData.load_weight = loadWeight ? parseFloat(loadWeight) : null;

        if (editBooking) {
          const { error } = await supabase
            .from("elevator_bookings")
            .update(updateData)
            .eq("id", editBooking.id);

          if (error) throw error;
        } else {
          updateData.project_id = projectId;
          updateData.elevator_id = gateId;
          updateData.created_by = userData.user.id;
          updateData.status = requiresApproval ? "pending" : "approved";
          updateData.requires_approval = requiresApproval;

          const { error } = await supabase.from("elevator_bookings").insert(updateData);
          if (error) throw error;
        }
      } else {
        if (editBooking) {
          const { error } = await supabase
            .from("bookings")
            .update(updateData)
            .eq("id", editBooking.id);

          if (error) throw error;
        } else {
          updateData.project_id = projectId;
          updateData.gate_id = gateId;
          updateData.created_by = userData.user.id;
          updateData.status = requiresApproval ? "pending" : "approved";
          updateData.requires_approval = requiresApproval;
          updateData.approval_requested_at = requiresApproval ? new Date().toISOString() : null;

          const { error } = await supabase.from("bookings").insert(updateData);
          if (error) throw error;
        }
      }

      if (editBooking) {
        toast.success("Booking oppdatert!");
      } else if (requiresApproval) {
        toast.success("Booking opprettet! Venter på ekstra godkjenning (utenfor arbeidstid).");
      } else {
        toast.success("Booking opprettet og godkjent!");
      }
      onSuccess();
      onOpenChange(false);
    } catch (error: any) {
      console.error("Error saving booking:", error);
      if (error.code === "23P01") {
        toast.error("Dette tidsrommet er allerede booket. Vennligst velg et annet tidspunkt.");
      } else {
        toast.error(editBooking ? "Kunne ikke oppdatere booking" : "Kunne ikke opprette booking");
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleClose = () => {
    setSupplierName("");
    setContactName("");
    setContactPhone("");
    setContactEmail("");
    setVehicleType("");
    setNotes("");
    setFloors("");
    setPurpose("");
    setLoadWeight("");
    setCustomStartTime("");
    setCustomEndTime("");
    setSelectedSupplierId("");
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {editBooking ? "Rediger booking" : (isElevator ? "Ny heisbooking" : "Ny leveransebooking")}
          </DialogTitle>
          <DialogDescription>
            {editBooking
              ? `${format(new Date(editBooking.start_time), "d. MMMM yyyy 'kl.' HH:mm", { locale: nb })} - ${format(new Date(editBooking.end_time), "HH:mm", { locale: nb })}`
              : `${format(startTime, "d. MMMM yyyy 'kl.' HH:mm", { locale: nb })} - ${format(endTime, "HH:mm", { locale: nb })}`
            }
          </DialogDescription>
        </DialogHeader>

        {requiresApproval && (
          <Alert>
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              Denne bookingen er utenfor ordinær arbeidstid og vil kreve godkjenning fra koordinator.
            </AlertDescription>
          </Alert>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid gap-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label htmlFor="startTime">Starttid</Label>
                <Input
                  id="startTime"
                  type="time"
                  step="60"
                  pattern="[0-9]{2}:[0-9]{2}"
                  value={customStartTime}
                  onChange={(e) => setCustomStartTime(e.target.value)}
                  required
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="endTime">Sluttid</Label>
                <Input
                  id="endTime"
                  type="time"
                  step="60"
                  pattern="[0-9]{2}:[0-9]{2}"
                  value={customEndTime}
                  onChange={(e) => setCustomEndTime(e.target.value)}
                  required
                />
              </div>
            </div>

            <div className="grid gap-2">
              <Label htmlFor="supplier">Ansvarlig firma *</Label>
              <Input
                id="supplier"
                placeholder="Nordmann Bygg AS"
                value={supplierName}
                readOnly
                required
                className="bg-muted/50 cursor-not-allowed"
              />
              <p className="text-xs text-muted-foreground">
                Automatisk fylt ut fra din profil (kan ikke endres)
              </p>
            </div>

            <div className="grid gap-2">
              <Label htmlFor="supplierSelect">Leverandør</Label>
              <Select value={selectedSupplierId} onValueChange={setSelectedSupplierId}>
                <SelectTrigger>
                  <SelectValue placeholder="Velg leverandør (valgfritt)" />
                </SelectTrigger>
                <SelectContent>
                  {suppliers.map((supplier) => (
                    <SelectItem key={supplier.id} value={supplier.id}>
                      {supplier.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                Velg fra dine registrerte leverandører
              </p>
            </div>

            <div className="grid gap-2">
              <Label htmlFor="contactName">Kontaktperson *</Label>
              <Input
                id="contactName"
                placeholder="Ola Nordmann"
                value={contactName}
                onChange={(e) => setContactName(e.target.value)}
                required
                className="bg-muted/50"
              />
              <p className="text-xs text-muted-foreground">
                Automatisk fylt ut fra din profil
              </p>
            </div>

            <div className="grid gap-2">
              <Label htmlFor="contactPhone">Telefon *</Label>
              <Input
                id="contactPhone"
                type="tel"
                placeholder="+47 123 45 678"
                value={contactPhone}
                onChange={(e) => setContactPhone(e.target.value)}
                required
                className="bg-muted/50"
              />
              <p className="text-xs text-muted-foreground">
                Automatisk fylt ut fra din profil
              </p>
            </div>

            <div className="grid gap-2">
              <Label htmlFor="contactEmail">E-post</Label>
              <Input
                id="contactEmail"
                type="email"
                placeholder="ola@eksempel.no"
                value={contactEmail}
                onChange={(e) => setContactEmail(e.target.value)}
                className="bg-muted/50"
              />
              <p className="text-xs text-muted-foreground">
                Automatisk fylt ut fra din profil
              </p>
            </div>

            {!isElevator && (
              <div className="grid gap-2">
                <Label htmlFor="vehicleType">Kjøretøytype</Label>
                <Input
                  id="vehicleType"
                  placeholder="Lastebil, varebil, osv."
                  value={vehicleType}
                  onChange={(e) => setVehicleType(e.target.value)}
                />
              </div>
            )}

            {isElevator && (
              <>
                <div className="grid gap-2">
                  <Label htmlFor="floors">Etasjer *</Label>
                  <Input
                    id="floors"
                    placeholder="f.eks. 1-5, 10, 15"
                    value={floors}
                    onChange={(e) => setFloors(e.target.value)}
                    required
                  />
                </div>

                <div className="grid gap-2">
                  <Label htmlFor="purpose">Formål</Label>
                  <Input
                    id="purpose"
                    placeholder="Materiallevering, persontransport, osv."
                    value={purpose}
                    onChange={(e) => setPurpose(e.target.value)}
                  />
                </div>

                <div className="grid gap-2">
                  <Label htmlFor="loadWeight">Lastvekt (kg)</Label>
                  <Input
                    id="loadWeight"
                    type="number"
                    placeholder="f.eks. 500"
                    value={loadWeight}
                    onChange={(e) => setLoadWeight(e.target.value)}
                  />
                </div>
              </>
            )}

            <div className="grid gap-2">
              <Label htmlFor="notes">Merknad</Label>
              <Textarea
                id="notes"
                placeholder="Ytterligere informasjon..."
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={3}
              />
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={handleClose}>
              Avbryt
            </Button>
            <Button type="submit" disabled={isLoading}>
              {isLoading ? (editBooking ? "Oppdaterer..." : "Oppretter...") : (editBooking ? "Oppdater booking" : "Opprett booking")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};