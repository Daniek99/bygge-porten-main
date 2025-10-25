import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Layout } from "@/components/Layout";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Building, Calendar, Bell, UserPlus, Plus } from "lucide-react";
import { toast } from "sonner";

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
}

const Level1Dashboard = () => {
  const { user, isLoading: authLoading } = useAuth();
  const [projects, setProjects] = useState<Project[]>([]);
  const [myBookings, setMyBookings] = useState<MyBooking[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [notifications, setNotifications] = useState<number>(0);
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
          )
        `)
        .eq("created_by", user?.id)
        .order("start_time", { ascending: false })
        .limit(10);

      if (elevatorError) throw elevatorError;

      // Combine and format the data
      const combinedBookings = [
        ...(data || []).map(booking => ({ ...booking, type: 'gate' })),
        ...(elevatorBookings || []).map(booking => ({
          ...booking,
          type: 'elevator',
          gates: booking.elevators ? { name: booking.elevators.name } : null
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
            <h2 className="text-3xl font-bold tracking-tight">Bestiller Dashboard</h2>
            <p className="text-muted-foreground">
              Opprett og administrer dine leveransebookinger
            </p>
          </div>
          {/* Removed invite button as level 1 users can't create projects and should invite from project pages */}
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
              <CardTitle className="text-sm font-medium">Venter godkjenning</CardTitle>
              <Calendar className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {myBookings.filter(b => b.status === "pending").length}
              </div>
              <p className="text-xs text-muted-foreground">
                Bookinger som venter godkjenning
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

        {/* My Recent Bookings */}
        <Card>
          <CardHeader>
            <CardTitle>Mine leveranser</CardTitle>
            <CardDescription>
              Oversikt over dine nylig opprettede bookinger
            </CardDescription>
          </CardHeader>
          <CardContent>
            {myBookings.length === 0 ? (
              <div className="text-center py-8">
                <Calendar className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                <h4 className="text-lg font-semibold mb-2">Ingen bookinger ennå</h4>
                <p className="text-muted-foreground mb-4">
                  Du har ikke opprettet noen bookinger ennå. Gå til et prosjekt for å opprette din første booking.
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                {myBookings.map((booking) => (
                  <div key={booking.id} className="flex items-center justify-between p-4 border rounded-lg">
                    <div>
                      <p className="font-medium">{booking.supplier_name}</p>
                      <p className="text-sm text-muted-foreground">
                        {booking.gates?.name || booking.elevators?.name} •{" "}
                        {new Date(booking.start_time).toLocaleDateString("no-NO")} kl.{" "}
                        {new Date(booking.start_time).toLocaleTimeString("no-NO", {
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </p>
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
    </Layout>
  );
};

export default Level1Dashboard;