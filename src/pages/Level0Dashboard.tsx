import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Layout } from "@/components/Layout";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Building, Calendar, Bell, CheckCircle, XCircle, Clock } from "lucide-react";
import { toast } from "sonner";
import { BookingDialog } from "@/components/BookingDialog";
import { BookingManagement } from "@/components/BookingManagement";

interface Project {
  id: string;
  name: string;
  description: string | null;
  created_at: string;
}

interface MyBooking {
  id: string;
  supplier_name: string;
  start_time: string;
  end_time: string;
  status: string;
  gates: {
    name: string;
  };
  elevators?: {
    name: string;
  };
  project_id: string;
  project?: {
    address?: string;
    project_number?: string;
  };
  created_by: string;
  elevator_id?: string;
  gate_id?: string;
  type?: string;
  contact_name?: string;
  contact_phone?: string;
  contact_email?: string;
}

const Level0Dashboard = () => {
  const { user, isLoading: authLoading } = useAuth();
  const [projects, setProjects] = useState<Project[]>([]);
  const [myBookings, setMyBookings] = useState<MyBooking[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [notifications, setNotifications] = useState<number>(0);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isManagementOpen, setIsManagementOpen] = useState(false);
  const [editBooking, setEditBooking] = useState<MyBooking | null>(null);
  const [selectedBooking, setSelectedBooking] = useState<MyBooking | null>(null);
  const navigate = useNavigate();

  useEffect(() => {
    if (!authLoading && !user) {
      navigate("/auth");
    }
  }, [user, authLoading, navigate]);

  useEffect(() => {
    if (user) {
      fetchProjects();
      fetchMyBookings();
      fetchNotifications();
    }
  }, [user]);

  const fetchProjects = async () => {
    try {
      const { data, error } = await supabase
        .from("projects")
        .select(`
          id,
          name,
          description,
          created_at
        `)
        .order("created_at", { ascending: false });

      if (error) throw error;
      setProjects(data || []);
    } catch (error: any) {
      console.error("Error fetching projects:", error);
      toast.error("Kunne ikke hente prosjekter");
    } finally {
      setIsLoading(false);
    }
  };

  const fetchMyBookings = async () => {
    try {
      const { data, error } = await supabase
        .from("bookings")
        .select(`
          id,
          supplier_name,
          start_time,
          end_time,
          status,
          gates (
            name
          ),
          project_id,
          created_by,
          gate_id,
          projects (
            address,
            project_number
          )
        `)
        .eq("created_by", user?.id)
        .order("start_time", { ascending: false })
        .limit(10);

      if (error) throw error;

      // Also fetch elevator bookings
      const { data: elevatorBookings, error: elevatorError } = await supabase
        .from("elevator_bookings")
        .select(`
          id,
          supplier_name,
          start_time,
          end_time,
          status,
          elevators (
            name
          ),
          project_id,
          created_by,
          elevator_id,
          projects (
            address,
            project_number
          )
        `)
        .eq("created_by", user?.id)
        .order("start_time", { ascending: false })
        .limit(10);

      if (elevatorError) throw elevatorError;

      // Combine and format data
      const combinedBookings = [
        ...(data || []).map(booking => ({ 
          ...booking, 
          type: 'gate', 
          project_id: booking.project_id, 
          created_by: booking.created_by, 
          gate_id: booking.gate_id,
          project: booking.projects
        })),
        ...(elevatorBookings || []).map(booking => ({
          ...booking,
          type: 'elevator',
          gates: booking.elevators ? { name: booking.elevators.name } : null,
          project_id: booking.project_id,
          created_by: booking.created_by,
          elevator_id: booking.elevator_id,
          project: booking.projects
        }))
      ];

      setMyBookings(combinedBookings);
    } catch (error: any) {
      console.error("Error fetching my bookings:", error);
    }
  };

  const fetchNotifications = async () => {
    try {
      const { count, error } = await supabase
        .from("notifications")
        .select("*", { count: "exact", head: true })
        .eq("recipient_id", user?.id)
        .eq("read", false);

      if (error) throw error;
      setNotifications(count || 0);
    } catch (error: any) {
      console.error("Error fetching notifications:", error);
    }
  };

  const handleEditBooking = (booking: MyBooking) => {
    setEditBooking(booking);
    setIsDialogOpen(true);
  };

  const handleBookingClick = (booking: MyBooking) => {
    setSelectedBooking(booking);
    setIsManagementOpen(true);
  };

  if (authLoading || isLoading) {
    return (
      <Layout>
        <div className="flex items-center justify-center min-h-[60vh]">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
            <p className="text-muted-foreground">Laster inn...</p>
          </div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-3xl font-bold tracking-tight">Leverandør Dashboard</h2>
            <p className="text-muted-foreground">
              Se dine bookinger og leveranser
            </p>
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Aktive prosjekter</CardTitle>
              <Building className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{projects.length}</div>
              <p className="text-xs text-muted-foreground">
                Prosjekter du har tilgang til
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Mine bookinger</CardTitle>
              <Calendar className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{myBookings.length}</div>
              <p className="text-xs text-muted-foreground">
                Bookinger du har opprettet
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Godkjente</CardTitle>
              <CheckCircle className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {myBookings.filter(b => b.status === "approved").length}
              </div>
              <p className="text-xs text-muted-foreground">
                Godkjente bookinger
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Varsler</CardTitle>
              <Bell className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{notifications}</div>
              <p className="text-xs text-muted-foreground">
                Uleste varsler
              </p>
            </CardContent>
          </Card>
        </div>

        {/* My Bookings */}
        <Card>
          <CardHeader>
            <CardTitle>Mine bookinger</CardTitle>
            <CardDescription>
              Oversikt over dine leveransebookinger
            </CardDescription>
          </CardHeader>
          <CardContent>
            {myBookings.length === 0 ? (
              <div className="text-center py-8">
                <Calendar className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                <h4 className="text-lg font-semibold mb-2">Ingen bookinger ennå</h4>
                <p className="text-muted-foreground">
                  Du har ikke opprettet noen bookinger ennå.
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                {myBookings.map((booking) => (
                  <div 
                    key={booking.id} 
                    className="flex items-center justify-between p-4 border rounded-lg cursor-pointer hover:bg-accent/50 transition-colors"
                    onClick={() => handleBookingClick(booking)}
                  >
                    <div>
                      <p className="font-medium">{booking.supplier_name}</p>
                      <p className="text-sm text-muted-foreground">
                        {booking.gates?.name} •{" "}
                        {new Date(booking.start_time).toLocaleDateString("no-NO")} kl.{" "}
                        {new Date(booking.start_time).toLocaleTimeString("no-NO", {
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </p>
                      {booking.project && (
                        <p className="text-xs text-muted-foreground">
                          {booking.project.address && `${booking.project.address}`}
                          {booking.project.project_number && ` • Prosjekt ${booking.project.project_number}`}
                        </p>
                      )}
                    </div>
                    <div className="text-right">
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                        booking.status === "approved"
                          ? "bg-green-100 text-green-800"
                          : booking.status === "rejected"
                          ? "bg-red-100 text-red-800"
                          : "bg-yellow-100 text-yellow-800"
                      }`}>
                        {booking.status === "approved" ? "Godkjent" :
                         booking.status === "rejected" ? "Avvist" : "Venter"}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Projects Section */}
        <div>
          <h3 className="text-xl font-semibold mb-4">Tilgjengelige prosjekter</h3>
          {projects.length === 0 ? (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-12">
                <Building className="h-12 w-12 text-muted-foreground mb-4" />
                <h4 className="text-lg font-semibold mb-2">Ingen prosjekter tilgjengelig</h4>
                <p className="text-muted-foreground text-center">
                  Du har ikke tilgang til noen prosjekter ennå. Kontakt en koordinator for å få tilgang.
                </p>
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {projects.map((project) => (
                <Card
                  key={project.id}
                  className="cursor-pointer hover:shadow-lg transition-shadow"
                  onClick={() => navigate(`/projects/${project.id}`)}
                >
                  <CardHeader>
                    <CardTitle>{project.name}</CardTitle>
                    <CardDescription>
                      {project.description || "Ingen beskrivelse"}
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm text-muted-foreground">
                      Opprettet {new Date(project.created_at).toLocaleDateString("no-NO")}
                    </p>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Booking Management Dialog */}
      {selectedBooking && (
        <BookingManagement
          booking={selectedBooking as any}
          open={isManagementOpen}
          onOpenChange={setIsManagementOpen}
          onSuccess={fetchMyBookings}
          canManage={false}
          canEdit={user?.id === selectedBooking.created_by}
          canDelete={user?.id === selectedBooking.created_by}
          onEdit={() => handleEditBooking(selectedBooking)}
          currentUser={user?.id}
          userRole="level0"
        />
      )}

      {/* Edit Booking Dialog */}
      {editBooking && (
        <BookingDialog
          open={isDialogOpen}
          onOpenChange={(open) => {
            setIsDialogOpen(open);
            if (!open) {
              setEditBooking(null);
            }
          }}
          projectId={editBooking.project_id}
          gateId={editBooking.gate_id || editBooking.elevator_id || ''}
          startTime={new Date(editBooking.start_time)}
          endTime={new Date(editBooking.end_time)}
          workingHours={{ start: '07:00', end: '15:30', enabled: true }}
          userRole="level0"
          onSuccess={fetchMyBookings}
          isElevator={!!editBooking.elevator_id}
          editBooking={editBooking}
        />
      )}
    </Layout>
  );
};

export default Level0Dashboard;