import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Layout } from "@/components/Layout";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Building, Calendar, Bell, CheckCircle, XCircle, Clock, Plus } from "lucide-react";
import { toast } from "sonner";
import { BookingDialog } from "@/components/BookingDialog";
import { BookingManagement } from "@/components/BookingManagement";
import { Badge } from "@/components/ui/badge";
import { format, startOfWeek, endOfWeek, eachDayOfInterval, isSameDay, addWeeks, subWeeks, getWeek, startOfDay, endOfDay } from "date-fns";
import { nb } from "date-fns/locale";
import { ChevronLeft, ChevronRight } from "lucide-react";

interface Project {
  id: string;
  name: string;
  description: string | null;
  created_at: string;
}

interface WeeklyBooking {
  id: string;
  supplier_name: string;
  start_time: string;
  end_time: string;
  status: string;
  gates?: { name: string };
  elevators?: { name: string };
  project_id: string;
  project_name: string;
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

const DailyDeliveriesOverview = ({ projects }: { projects: Project[] }) => {
  const [todayBookings, setTodayBookings] = useState<WeeklyBooking[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (projects.length > 0) {
      fetchTodayBookings();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projects]);

  const fetchTodayBookings = async () => {
    try {
      setIsLoading(true);
      const todayStart = startOfDay(new Date());
      const todayEnd = endOfDay(new Date());
      const projectIds = projects.map(p => p.id);

      // Gate bookings for today
      const { data: gateBookings, error: gateError } = await supabase
        .from("bookings")
        .select(`
          id,
          supplier_name,
          start_time,
          end_time,
          status,
          gates (name),
          project_id,
          projects (name)
        `)
        .in("project_id", projectIds)
        .gte("start_time", todayStart.toISOString())
        .lte("start_time", todayEnd.toISOString())
        .order("start_time");

      if (gateError) throw gateError;

      // Elevator bookings for today
      const { data: elevatorBookings, error: elevatorError } = await supabase
        .from("elevator_bookings")
        .select(`
          id,
          supplier_name,
          start_time,
          end_time,
          status,
          elevators (name),
          project_id,
          projects (name)
        `)
        .in("project_id", projectIds)
        .gte("start_time", todayStart.toISOString())
        .lte("start_time", todayEnd.toISOString())
        .order("start_time");

      if (elevatorError) throw elevatorError;

      const combinedBookings: WeeklyBooking[] = [
        ...(gateBookings || []).map(booking => ({
          ...booking,
          project_name: (booking.projects as any)?.name || 'Unknown Project'
        })),
        ...(elevatorBookings || []).map(booking => ({
          ...booking,
          gates: booking.elevators ? { name: booking.elevators.name } : null,
          project_name: (booking.projects as any)?.name || 'Unknown Project'
        }))
      ];

      setTodayBookings(combinedBookings);
    } catch (e) {
      console.error("Error fetching today's bookings:", e);
    } finally {
      setIsLoading(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-6">
        <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary"></div>
      </div>
    );
  }

  // Group by project
  const byProject = projects.map(project => ({
    project,
    bookings: todayBookings.filter(b => b.project_id === project.id)
  })).filter(g => g.bookings.length > 0);

  return (
    <div className="space-y-4">
      {byProject.length === 0 ? (
        <div className="text-sm text-muted-foreground">Ingen leveranser i dag</div>
      ) : (
        byProject.map(({ project, bookings }) => (
          <div key={project.id} className="border rounded-lg p-3">
            <div className="font-semibold mb-2">{project.name}</div>
            <div className="space-y-1">
              {bookings.map(b => (
                <div key={b.id} className="text-xs p-2 rounded bg-primary/10 border border-primary/20">
                  <div className="font-medium truncate">{b.supplier_name}</div>
                  <div className="text-muted-foreground">
                    {new Date(b.start_time).toLocaleTimeString("no-NO", { hour: "2-digit", minute: "2-digit" })} • {b.gates?.name || 'N/A'}
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))
      )}
    </div>
  );
};

const WeeklyDeliveriesCalendar = ({ projects }: { projects: Project[] }) => {
  const [weeklyBookings, setWeeklyBookings] = useState<WeeklyBooking[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [currentWeek, setCurrentWeek] = useState<Date>(startOfWeek(new Date(), { weekStartsOn: 1 }));

  useEffect(() => {
    if (projects.length > 0) {
      fetchWeeklyBookings();
    }
  }, [projects, currentWeek]);

  const fetchWeeklyBookings = async () => {
    try {
      setIsLoading(true);
      const weekStart = startOfWeek(currentWeek, { weekStartsOn: 1 }); // Monday
      const weekEnd = endOfWeek(currentWeek, { weekStartsOn: 1 }); // Sunday

      const projectIds = projects.map(p => p.id);

      // Fetch gate bookings
      const { data: gateBookings, error: gateError } = await supabase
        .from("bookings")
        .select(`
          id,
          supplier_name,
          start_time,
          end_time,
          status,
          gates (name),
          project_id,
          projects (name)
        `)
        .in("project_id", projectIds)
        .gte("start_time", weekStart.toISOString())
        .lte("start_time", weekEnd.toISOString())
        .order("start_time");

      if (gateError) throw gateError;

      // Fetch elevator bookings
      const { data: elevatorBookings, error: elevatorError } = await supabase
        .from("elevator_bookings")
        .select(`
          id,
          supplier_name,
          start_time,
          end_time,
          status,
          elevators (name),
          project_id,
          projects (name)
        `)
        .in("project_id", projectIds)
        .gte("start_time", weekStart.toISOString())
        .lte("start_time", weekEnd.toISOString())
        .order("start_time");

      if (elevatorError) throw elevatorError;

      // Combine and format bookings
      const combinedBookings: WeeklyBooking[] = [
        ...(gateBookings || []).map(booking => ({
          ...booking,
          project_name: (booking.projects as any)?.name || 'Unknown Project'
        })),
        ...(elevatorBookings || []).map(booking => ({
          ...booking,
          gates: booking.elevators ? { name: booking.elevators.name } : null,
          project_name: (booking.projects as any)?.name || 'Unknown Project'
        }))
      ];

      setWeeklyBookings(combinedBookings);
    } catch (error: any) {
      console.error("Error fetching weekly bookings:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const navigateWeek = (direction: 'prev' | 'next') => {
    const newWeek = direction === 'next' ? addWeeks(currentWeek, 1) : subWeeks(currentWeek, 1);
    setCurrentWeek(newWeek);
  };

  const weekDays = eachDayOfInterval({
    start: startOfWeek(currentWeek, { weekStartsOn: 1 }),
    end: endOfWeek(currentWeek, { weekStartsOn: 1 })
  });

  const getBookingsForDay = (date: Date) => {
    return weeklyBookings.filter(booking =>
      isSameDay(new Date(booking.start_time), date)
    );
  };

  const getBookingsForProject = (projectId: string) => {
    return weeklyBookings.filter(booking => booking.project_id === projectId);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  const weekNumber = getWeek(currentWeek);

  return (
    <div className="space-y-6">
      {/* Week Navigation */}
      <div className="flex items-center justify-between">
        <h4 className="text-lg font-semibold">Ukens leveranser</h4>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => navigateWeek('prev')}
            className="h-8 w-8 p-0"
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <div className="text-sm font-medium min-w-[140px] text-center">
            {format(currentWeek, 'MMMM yyyy', { locale: nb })} - Uke {weekNumber}
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => navigateWeek('next')}
            className="h-8 w-8 p-0"
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {projects.map((project) => {
        const projectBookings = getBookingsForProject(project.id);
        if (projectBookings.length === 0) return null;

        return (
          <div key={project.id} className="border rounded-lg p-4">
            <h4 className="font-semibold text-lg mb-3">{project.name}</h4>
            <div className="grid grid-cols-5 gap-2">
              {weekDays.slice(0, 5).map((day, index) => { // Monday to Friday only
                const dayBookings = getBookingsForDay(day);
                const projectDayBookings = dayBookings.filter(b => b.project_id === project.id);

                return (
                  <div key={index} className="border rounded p-2 min-h-[80px]">
                    <div className="text-xs font-medium text-muted-foreground mb-1">
                      {format(day, 'EEE dd.MM', { locale: nb })}
                    </div>
                    <div className="space-y-1">
                      {projectDayBookings.map((booking) => (
                        <div
                          key={booking.id}
                          className="text-xs p-1 rounded bg-primary/10 border border-primary/20"
                          title={`${booking.supplier_name} - ${booking.gates?.name || 'N/A'}`}
                        >
                          <div className="font-medium truncate">{booking.supplier_name}</div>
                          <div className="text-muted-foreground">
                            {format(new Date(booking.start_time), 'HH:mm')} - {booking.gates?.name || 'N/A'}
                          </div>
                        </div>
                      ))}
                      {projectDayBookings.length === 0 && (
                        <div className="text-xs text-muted-foreground italic">Ingen leveranser</div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}
      {projects.every(project => getBookingsForProject(project.id).length === 0) && (
        <div className="text-center py-8 text-muted-foreground">
          Ingen leveranser planlagt denne uken
        </div>
      )}
    </div>
  );
};

const Level2Dashboard = () => {
  const { user, isLoading: authLoading } = useAuth();
  const [projects, setProjects] = useState<Project[]>([]);
  const [myBookings, setMyBookings] = useState<MyBooking[]>([]);
  const [pendingBookings, setPendingBookings] = useState<MyBooking[]>([]);
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
      fetchPendingBookings();
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

  const fetchPendingBookings = async () => {
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
        .eq("status", "pending")
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
        .eq("status", "pending")
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

      setPendingBookings(combinedBookings);
    } catch (error: any) {
      console.error("Error fetching pending bookings:", error);
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

  const handleBookingAction = async (bookingId: string, action: "approved" | "rejected") => {
    try {
      const booking = pendingBookings.find(b => b.id === bookingId);
      if (!booking) return;

      const tableName = booking.type === 'elevator' ? "elevator_bookings" : "bookings";
      const { error } = await supabase
        .from(tableName)
        .update({ 
          status: action,
          approved_by: user?.id,
          approved_at: new Date().toISOString()
        })
        .eq("id", bookingId);

      if (error) throw error;

      toast.success(`Booking ${action === "approved" ? "godkjent" : "avvist"}`);
      fetchPendingBookings();
    } catch (error: any) {
      console.error("Error updating booking:", error);
      toast.error(`Kunne ikke ${action === "approved" ? "godkjenne" : "avvise"} booking`);
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
        <div>
          <div>
            <h2 className="text-3xl font-bold tracking-tight">Koordinator Dashboard</h2>
            <p className="text-muted-foreground">
              Administrer bookinger og prosjekter
            </p>
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-4">
          <Card className="h-20">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-1">
              <CardTitle className="text-sm font-medium">Aktive prosjekter</CardTitle>
              <Building className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent className="pt-0">
              <div className="text-xl font-bold">{projects.length}</div>
              <p className="text-xs text-muted-foreground">
                Prosjekter du administrerer
              </p>
            </CardContent>
          </Card>

          <Card className="h-20">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-1">
              <CardTitle className="text-sm font-medium">Venter godkjenning</CardTitle>
              <Clock className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent className="pt-0">
              <div className="text-xl font-bold">{pendingBookings.length}</div>
              <p className="text-xs text-muted-foreground">
                Bookinger som trenger godkjenning
              </p>
            </CardContent>
          </Card>

          <Card className="h-20">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-1">
              <CardTitle className="text-sm font-medium">Godkjente i dag</CardTitle>
              <CheckCircle className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent className="pt-0">
              <div className="text-xl font-bold">0</div>
              <p className="text-xs text-muted-foreground">
                Bookinger godkjent i dag
              </p>
            </CardContent>
          </Card>

          <Card className="h-20">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-1">
              <CardTitle className="text-sm font-medium">Varsler</CardTitle>
              <Bell className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent className="pt-0">
              <div className="text-xl font-bold">{notifications}</div>
              <p className="text-xs text-muted-foreground">
                Uleste varsler
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Pending Bookings Section */}
        {pendingBookings.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle>Bookinger som venter godkjenning</CardTitle>
              <CardDescription>
                Bookinger som trenger din godkjenning før de kan gjennomføres
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {pendingBookings.map((booking) => (
                  <div key={booking.id} className="flex items-center justify-between p-4 border rounded-lg">
                    <div className="flex-1">
                      <div className="flex items-center gap-3">
                        <div>
                          <p className="font-medium">{booking.supplier_name}</p>
                          <p className="text-sm text-muted-foreground">
                            {booking.contact_name} • {booking.gates?.name || booking.elevators?.name}
                          </p>
                          <p className="text-sm text-muted-foreground">
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
                        <Badge variant="outline">Venter</Badge>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleBookingAction(booking.id, "rejected")}
                      >
                        <XCircle className="mr-1 h-4 w-4" />
                        Avvis
                      </Button>
                      <Button
                        size="sm"
                        onClick={() => handleBookingAction(booking.id, "approved")}
                      >
                        <CheckCircle className="mr-1 h-4 w-4" />
                        Godkjenn
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Projects Section */}
        <div>
          <h3 className="text-xl font-semibold mb-4">Dine prosjekter</h3>
          {projects.length === 0 ? (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-12">
                <Building className="h-12 w-12 text-muted-foreground mb-4" />
                <h4 className="text-lg font-semibold mb-2">Ingen prosjekter ennå</h4>
                <p className="text-muted-foreground text-center mb-4 max-w-md">
                  Du har ikke tilgang til noen prosjekter ennå. Kontakt en administrator for å få tilgang.
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

        {/* Gruppért oversikt: Dagens og Ukens leveranser */}
        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Dagens leveranser</CardTitle>
              <CardDescription>Oversikt over dagens bookinger per prosjekt</CardDescription>
            </CardHeader>
            <CardContent className="pt-2">
              <DailyDeliveriesOverview projects={projects} />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Ukens leveranser</CardTitle>
              <CardDescription>Ukeoversikt per prosjekt</CardDescription>
            </CardHeader>
            <CardContent className="pt-2">
              <WeeklyDeliveriesCalendar projects={projects} />
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Booking Management Dialog */}
      {selectedBooking && (
        <BookingManagement
          booking={selectedBooking as any}
          open={isManagementOpen}
          onOpenChange={setIsManagementOpen}
          onSuccess={() => {
            fetchMyBookings();
            fetchPendingBookings();
          }}
          canManage={true}
          canEdit={user?.id === selectedBooking.created_by}
          canDelete={user?.id === selectedBooking.created_by}
          onEdit={() => handleEditBooking(selectedBooking)}
          currentUser={user?.id}
          userRole="level2"
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
          userRole="level2"
          onSuccess={() => {
            fetchMyBookings();
            fetchPendingBookings();
          }}
          isElevator={!!editBooking.elevator_id}
          editBooking={editBooking}
        />
      )}
    </Layout>
  );
};

export default Level2Dashboard;