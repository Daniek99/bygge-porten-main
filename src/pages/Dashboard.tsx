import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Layout } from "@/components/Layout";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import Level2Dashboard from "./Level2Dashboard";
import Level1Dashboard from "./Level1Dashboard";
import Level0Dashboard from "./Level0Dashboard";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Plus, Building, Calendar, Bell, Shield } from "lucide-react";
import { toast } from "sonner";

interface Project {
  id: string;
  name: string;
  description: string | null;
  created_at: string;
}

const Dashboard = () => {
  const { user, isLoading: authLoading } = useAuth();
  const [projects, setProjects] = useState<Project[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [notifications, setNotifications] = useState<number>(0);
  const [isAdmin, setIsAdmin] = useState(false);
  const [userRole, setUserRole] = useState<"owner" | "level2" | "level1" | "level0" | null>(null);
  const navigate = useNavigate();

  useEffect(() => {
    if (!authLoading && !user) {
      navigate("/auth");
    }
  }, [user, authLoading, navigate]);

  useEffect(() => {
    if (user) {
      checkAdminStatus();
      fetchUserRole();
      fetchProjects();
      fetchNotifications();
    }
  }, [user]);

  const fetchUserRole = async () => {
    try {
      // Check if user is admin first
      const { data: adminData } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", user.id)
        .eq("role", "admin")
        .maybeSingle();

      if (adminData) {
        setUserRole("owner");
        return;
      }

      // Check project-specific roles
      const { data: roleData } = await supabase
        .from("project_members")
        .select("role")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (roleData) {
        setUserRole(roleData.role as "owner" | "level2" | "level1" | "level0");
      }
    } catch (error: any) {
      console.error("Error fetching user role:", error);
    }
  };

  const checkAdminStatus = async () => {
    if (!user) return;
    
    const { data } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id)
      .eq("role", "admin")
      .maybeSingle();
    
    setIsAdmin(!!data);
  };

  const handleCreateProject = () => {
    if (!isAdmin) {
      toast.error("Kun administratorer kan opprette prosjekter");
      return;
    }
    navigate("/projects/new");
  };

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

  // Route to appropriate dashboard based on user role
  if (userRole === "level2") {
    return <Level2Dashboard />;
  } else if (userRole === "level1") {
    return <Level1Dashboard />;
  } else if (userRole === "level0") {
    return <Level0Dashboard />;
  }

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
            <h2 className="text-3xl font-bold tracking-tight">Dashboard</h2>
            <p className="text-muted-foreground">
              Oversikt over dine prosjekter og leveranser
            </p>
          </div>
          <Button onClick={handleCreateProject} disabled={!isAdmin}>
            <Plus className="mr-2 h-4 w-4" />
            Nytt prosjekt
            {isAdmin && <Shield className="ml-2 h-4 w-4" />}
          </Button>
        </div>

        <div className="grid gap-4 md:grid-cols-3">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Aktive prosjekter</CardTitle>
              <Building className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{projects.length}</div>
              <p className="text-xs text-muted-foreground">
                Totalt antall prosjekter
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Dagens bookinger</CardTitle>
              <Calendar className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">0</div>
              <p className="text-xs text-muted-foreground">
                Leveranser i dag
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

        <div>
          <h3 className="text-xl font-semibold mb-4">Dine prosjekter</h3>
          {projects.length === 0 ? (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-12">
                <Building className="h-12 w-12 text-muted-foreground mb-4" />
                <h4 className="text-lg font-semibold mb-2">Ingen prosjekter ennå</h4>
                <p className="text-muted-foreground text-center mb-4 max-w-md">
                  Kom i gang ved å opprette ditt første prosjekt for å administrere
                  leveranser til byggeplassen.
                </p>
                <Button onClick={handleCreateProject} disabled={!isAdmin}>
                  <Plus className="mr-2 h-4 w-4" />
                  Opprett prosjekt
                  {isAdmin && <Shield className="ml-2 h-4 w-4" />}
                </Button>
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

export default Dashboard;