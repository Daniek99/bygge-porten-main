import { useState } from "react";
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
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { format } from "date-fns";
import { nb } from "date-fns/locale";
import { Check, X, Clock, User, Phone, Mail, Truck, FileText, Edit, Trash2 } from "lucide-react";

interface Booking {
  id: string;
  status: string;
  supplier_name: string;
  contact_name: string;
  contact_phone: string;
  contact_email: string | null;
  vehicle_type?: string | null;
  notes?: string | null;
  start_time: string;
  end_time: string;
  created_by: string;
  project_id: string;
  gates?: {
    name: string;
  };
  elevator_id?: string;
  floors?: string | null;
  purpose?: string | null;
  load_weight?: number | null;
  elevators?: {
    name: string;
  };
}

interface BookingManagementProps {
  booking: Booking;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
  canManage: boolean;
  canEdit?: boolean;
  canDelete?: boolean;
  onEdit?: () => void;
  onDelete?: () => void;
  currentUser?: string | null;
  userRole?: "owner" | "level2" | "level1" | "level0" | null;
}

export const BookingManagement = ({
  booking,
  open,
  onOpenChange,
  onSuccess,
  canManage,
  canEdit = false,
  canDelete = false,
  onEdit,
  onDelete,
  currentUser,
  userRole,
}: BookingManagementProps) => {
  const [isLoading, setIsLoading] = useState(false);
  const [rejectionReason, setRejectionReason] = useState("");

  const handleApprove = async () => {
    setIsLoading(true);
    try {
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) throw new Error("Ikke innlogget");

      const tableName = booking.elevator_id ? "elevator_bookings" : "bookings";
      const updateData: any = {
        status: "approved",
        approved_by: userData.user.id,
        approved_at: new Date().toISOString(),
      };

      const { error } = await supabase
        .from(tableName)
        .update(updateData)
        .eq("id", booking.id);

      if (error) throw error;

      toast.success("Booking godkjent!");
      onSuccess();
      onOpenChange(false);
    } catch (error: any) {
      console.error("Error approving booking:", error);
      toast.error("Kunne ikke godkjenne booking");
    } finally {
      setIsLoading(false);
    }
  };

  const handleReject = async () => {
    if (!rejectionReason.trim()) {
      toast.error("Vennligst oppgi en grunn for avvisning");
      return;
    }

    setIsLoading(true);
    try {
      const tableName = booking.elevator_id ? "elevator_bookings" : "bookings";
      const { error } = await supabase
        .from(tableName)
        .update({
          status: "rejected",
          rejection_reason: rejectionReason,
        })
        .eq("id", booking.id);

      if (error) throw error;

      toast.success("Booking avvist");
      onSuccess();
      onOpenChange(false);
      setRejectionReason("");
    } catch (error: any) {
      console.error("Error rejecting booking:", error);
      toast.error("Kunne ikke avvise booking");
    } finally {
      setIsLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!window.confirm("Er du sikker på at du vil slette denne bookingen?")) {
      return;
    }

    setIsLoading(true);
    try {
      const tableName = booking.elevator_id ? "elevator_bookings" : "bookings";
      const { error } = await supabase
        .from(tableName)
        .delete()
        .eq("id", booking.id);

      if (error) throw error;

      // Notify the booking creator if deleted by admin (level2 or owner) and not the creator
      if ((userRole === "level2" || userRole === "owner") && currentUser !== booking.created_by) {
        const { error: notifyError } = await supabase
          .from("notifications")
          .insert({
            project_id: booking.project_id,
            booking_id: booking.elevator_id ? undefined : booking.id,
            elevator_booking_id: booking.elevator_id ? booking.id : undefined,
            recipient_id: booking.created_by,
            type: "booking_cancelled",
            title: booking.elevator_id ? "Heisbooking kansellert" : "Booking kansellert",
            message: `Din ${booking.elevator_id ? 'heisbooking' : 'booking'} har blitt kansellert av en administrator.`
          });

        if (notifyError) {
          console.error("Error sending notification:", notifyError);
        }
      }

      toast.success("Booking slettet");
      onSuccess();
      onOpenChange(false);
    } catch (error: any) {
      console.error("Error deleting booking:", error);
      toast.error("Kunne ikke slette booking");
    } finally {
      setIsLoading(false);
    }
  };

  const getStatusBadge = (status: string) => {
    const variants: Record<string, { label: string; className: string }> = {
      pending: { label: "Venter godkjenning", className: "bg-warning" },
      approved: { label: "Godkjent", className: "bg-success" },
      rejected: { label: "Avvist", className: "bg-destructive" },
      completed: { label: "Fullført", className: "bg-muted" },
    };
    const variant = variants[status] || { label: status, className: "" };
    return <Badge className={variant.className}>{variant.label}</Badge>;
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px]">
        <DialogHeader>
          <DialogTitle>Bookingdetaljer</DialogTitle>
          <DialogDescription>
            {format(new Date(booking.start_time), "d. MMMM yyyy 'kl.' HH:mm", { locale: nb })} -{" "}
            {format(new Date(booking.end_time), "HH:mm", { locale: nb })}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium">Status:</span>
            {getStatusBadge(booking.status)}
          </div>

          <div className="grid gap-4">
            <div className="flex items-start gap-3">
              <User className="h-5 w-5 text-muted-foreground mt-0.5" />
              <div>
                <p className="text-sm font-medium">Leverandør</p>
                <p className="text-sm text-muted-foreground">{booking.supplier_name}</p>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <User className="h-5 w-5 text-muted-foreground mt-0.5" />
              <div>
                <p className="text-sm font-medium">Kontaktperson</p>
                <p className="text-sm text-muted-foreground">{booking.contact_name}</p>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <Phone className="h-5 w-5 text-muted-foreground mt-0.5" />
              <div>
                <p className="text-sm font-medium">Telefon</p>
                <p className="text-sm text-muted-foreground">{booking.contact_phone}</p>
              </div>
            </div>

            {booking.contact_email && (
              <div className="flex items-start gap-3">
                <Mail className="h-5 w-5 text-muted-foreground mt-0.5" />
                <div>
                  <p className="text-sm font-medium">E-post</p>
                  <p className="text-sm text-muted-foreground">{booking.contact_email}</p>
                </div>
              </div>
            )}

            {booking.vehicle_type && (
              <div className="flex items-start gap-3">
                <Truck className="h-5 w-5 text-muted-foreground mt-0.5" />
                <div>
                  <p className="text-sm font-medium">Kjøretøytype</p>
                  <p className="text-sm text-muted-foreground">{booking.vehicle_type}</p>
                </div>
              </div>
            )}

            {booking.floors && (
              <div className="flex items-start gap-3">
                <Clock className="h-5 w-5 text-muted-foreground mt-0.5" />
                <div>
                  <p className="text-sm font-medium">Etasjer</p>
                  <p className="text-sm text-muted-foreground">{booking.floors}</p>
                </div>
              </div>
            )}

            {booking.purpose && (
              <div className="flex items-start gap-3">
                <FileText className="h-5 w-5 text-muted-foreground mt-0.5" />
                <div>
                  <p className="text-sm font-medium">Formål</p>
                  <p className="text-sm text-muted-foreground">{booking.purpose}</p>
                </div>
              </div>
            )}

            {booking.load_weight && (
              <div className="flex items-start gap-3">
                <Truck className="h-5 w-5 text-muted-foreground mt-0.5" />
                <div>
                  <p className="text-sm font-medium">Lastvekt (kg)</p>
                  <p className="text-sm text-muted-foreground">{booking.load_weight}</p>
                </div>
              </div>
            )}

            {booking.notes && (
              <div className="flex items-start gap-3">
                <FileText className="h-5 w-5 text-muted-foreground mt-0.5" />
                <div>
                  <p className="text-sm font-medium">Merknad</p>
                  <p className="text-sm text-muted-foreground">{booking.notes}</p>
                </div>
              </div>
            )}

            {booking.gates && (
              <div className="flex items-start gap-3">
                <Clock className="h-5 w-5 text-muted-foreground mt-0.5" />
                <div>
                  <p className="text-sm font-medium">Port</p>
                  <p className="text-sm text-muted-foreground">{booking.gates.name}</p>
                </div>
              </div>
            )}

            {booking.elevators && (
              <div className="flex items-start gap-3">
                <Clock className="h-5 w-5 text-muted-foreground mt-0.5" />
                <div>
                  <p className="text-sm font-medium">Heis</p>
                  <p className="text-sm text-muted-foreground">{booking.elevators.name}</p>
                </div>
              </div>
            )}
          </div>

          {canManage && booking.status === "pending" && (
            <div className="space-y-4 pt-4 border-t">
              <div className="space-y-2">
                <Label htmlFor="rejection">Grunn for avvisning (hvis relevant)</Label>
                <Textarea
                  id="rejection"
                  placeholder="Skriv inn grunn hvis du avviser bookingen..."
                  value={rejectionReason}
                  onChange={(e) => setRejectionReason(e.target.value)}
                  rows={3}
                />
              </div>
            </div>
          )}
        </div>

        <DialogFooter>
          {canManage && booking.status === "pending" ? (
            <>
              <Button
                variant="outline"
                onClick={handleReject}
                disabled={isLoading}
              >
                <X className="mr-2 h-4 w-4" />
                Avvis
              </Button>
              <Button onClick={handleApprove} disabled={isLoading}>
                <Check className="mr-2 h-4 w-4" />
                Godkjenn
              </Button>
            </>
          ) : canEdit || canDelete ? (
            <div className="flex gap-2">
              {canEdit && (
                <Button
                  variant="outline"
                  onClick={onEdit}
                  disabled={isLoading}
                >
                  <Edit className="mr-2 h-4 w-4" />
                  Rediger
                </Button>
              )}
              {canDelete && (
                <Button
                  variant="destructive"
                  onClick={handleDelete}
                  disabled={isLoading}
                >
                  <Trash2 className="mr-2 h-4 w-4" />
                  Slett
                </Button>
              )}
              <Button variant="outline" onClick={() => onOpenChange(false)}>
                Lukk
              </Button>
            </div>
          ) : (
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Lukk
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};