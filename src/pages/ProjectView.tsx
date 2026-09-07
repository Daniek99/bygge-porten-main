import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Layout } from "@/components/Layout";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { BookingCalendar } from "@/components/BookingCalendar";
import { InviteUserDialog } from "@/components/InviteUserDialog";
import { EditProjectDialog } from "@/components/EditProjectDialog";
import { ProjectUserManagement } from "@/components/ProjectUserManagement";
import { CompanyManagement } from "@/components/CompanyManagement";
import { SupplierManagement } from "@/components/SupplierManagement";
import ProjectMap from "@/components/ProjectMap";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ArrowLeft, Settings, UserPlus, Users, Menu, Building2 } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import { nb } from "date-fns/locale";

interface Project {
  id: string;
  name: string;
  description: string | null;
  address: string | null;
  site_image_url: string | null;
  project_number: string | null;
}

interface Gate {
  id: string;
  name: string;
  display_order: number;
  position_x: number | null;
  position_y: number | null;
}

interface Elevator {
  id: string;
  name: string;
  display_order: number;
  position_x: number | null;
  position_y: number | null;
}

const ProjectView = () => {
  const { projectId } = useParams();
  const { user, isLoading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [project, setProject] = useState<Project | null>(null);
  const [userRole, setUserRole] = useState<"owner" | "level2" | "level1" | "level0" | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isInviteDialogOpen, setIsInviteDialogOpen] = useState(false);
  const [isUserManagementOpen, setIsUserManagementOpen] = useState(false);
  const [isCompanyManagementOpen, setIsCompanyManagementOpen] = useState(false);
  const [isSupplierManagementOpen, setIsSupplierManagementOpen] = useState(false);
  const [gates, setGates] = useState<Gate[]>([]);
  const [elevators, setElevators] = useState<Elevator[]>([]);
  const [selectedGate, setSelectedGate] = useState<string | null>(null);
  const [calendarRefreshKey, setCalendarRefreshKey] = useState(0);

  useEffect(() => {
    if (!authLoading && !user) {
      navigate("/auth");
    }
  }, [user, authLoading, navigate]);

  useEffect(() => {
    if (user && projectId) {
      fetchProject();
      fetchUserRole();
      checkAdminStatus();
      fetchGates();
      fetchElevators();
    }
  }, [user, projectId]);

  const checkAdminStatus = async () => {
    try {
      const { data, error } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", user?.id)
        .eq("role", "admin")
        .single();

      if (error) {
        console.error("Error checking admin status:", error);
        setIsAdmin(false);
        return;
      }

      setIsAdmin(!!data);
      console.log("Admin status:", !!data); // Debug log
    } catch (error) {
      console.error("Error checking admin status:", error);
      setIsAdmin(false);
    }
  };

  const fetchProject = async () => {
    try {
      const { data, error } = await supabase
        .from("projects")
        .select("*")
        .eq("id", projectId)
        .single();

      if (error) throw error;
      setProject(data);
    } catch (error: any) {
      console.error("Error fetching project:", error);
      toast.error("Kunne ikke hente prosjekt");
      navigate("/");
    } finally {
      setIsLoading(false);
    }
  };

  const fetchUserRole = async () => {
    try {
      const { data, error } = await supabase
        .from("project_members")
        .select("role")
        .eq("project_id", projectId)
        .eq("user_id", user?.id)
        .single();

      if (error) {
        console.error("Error fetching user role:", error);
        setUserRole(null);
        return;
      }

      if (data) {
        setUserRole(data.role as "owner" | "level2" | "level1" | "level0");
        console.log("User role fetched:", data.role); // Debug log
      } else {
        setUserRole(null);
        console.log("No role found for user in this project");
      }
    } catch (error: any) {
      console.error("Error fetching user role:", error);
      setUserRole(null);
    }
  };

  const fetchGates = async () => {
    try {
      const { data, error } = await supabase
        .from("gates")
        .select("*")
        .eq("project_id", projectId)
        .eq("is_active", true)
        .order("display_order");

      if (error) throw error;
      setGates(data || []);
      // Set initial selected gate when gates are first loaded
      if (data && data.length > 0 && selectedGate === null) {
        setSelectedGate(data[0].id);
      }
    } catch (error: any) {
      console.error("Error fetching gates:", error);
    }
  };

  const fetchElevators = async () => {
    try {
      const { data, error } = await supabase
        .from("elevators")
        .select("*")
        .eq("project_id", projectId)
        .eq("is_active", true)
        .order("display_order");

      if (error) throw error;
      setElevators(data || []);
    } catch (error: any) {
      console.error("Error fetching elevators:", error);
    }
  };

  const handleProjectUpdateSuccess = async () => {
    await Promise.all([fetchProject(), fetchGates(), fetchElevators()]);
    setCalendarRefreshKey((key) => key + 1);
  };

  const getGatePosition = (gateId: string) => {
    const gate = gates.find(g => g.id === gateId);
    if (!gate || gate.position_x === null || gate.position_y === null) return null;
    return { x: gate.position_x, y: gate.position_y };
  };

  const getElevatorPosition = (elevatorId: string) => {
    const elevator = elevators.find(e => e.id === elevatorId);
    if (!elevator || elevator.position_x === null || elevator.position_y === null) return null;
    return { x: elevator.position_x, y: elevator.position_y };
  };

  const handleGateClick = (gateId: string) => {
    const gate = gates.find(g => g.id === gateId);
    if (gate) {
      setSelectedGate(gateId);
      toast.info(`Valgt port: ${gate.name}`);
    }
  };

  const handleElevatorClick = (elevatorId: string) => {
    const elevator = elevators.find(e => e.id === elevatorId);
    if (elevator) {
      setSelectedGate(elevatorId); // Reuse the same state for simplicity
      toast.info(`Valgt heis: ${elevator.name}`);
    }
  };

  if (authLoading || isLoading || !project) {
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
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" onClick={() => navigate("/")}>
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div>
              <h2 className="text-3xl font-bold tracking-tight">
                {project.name}
                {project.project_number && (
                  <span className="ml-2 text-xl font-normal text-muted-foreground">
                    #{project.project_number}
                  </span>
                )}
              </h2>
              {project.description && (
                <p className="text-muted-foreground">{project.description}</p>
              )}
            </div>
          </div>
          <div className="flex gap-2">
            {/* Project Management Dropdown - Only for level 2+ users */}
            {(userRole === "owner" || userRole === "level2" || isAdmin) && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline">
                    <Menu className="mr-2 h-4 w-4" />
                    Prosjekt
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onClick={() => setIsEditDialogOpen(true)}>
                    <Settings className="mr-2 h-4 w-4" />
                    Rediger prosjekt
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => setIsUserManagementOpen(true)}>
                    <Users className="mr-2 h-4 w-4" />
                    Administrer brukere
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => setIsCompanyManagementOpen(true)}>
                    <Building2 className="mr-2 h-4 w-4" />
                    Administrer foretak
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            )}

            {/* Supplier Management Menu - Only for level 1 users */}
            {userRole === "level1" && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline">
                    <Building2 className="mr-2 h-4 w-4" />
                    Leverandører
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onClick={() => setIsSupplierManagementOpen(true)}>
                    <Building2 className="mr-2 h-4 w-4" />
                    Administrer leverandører
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            )}

            {/* Invite User Button - For level 1+ users */}
            {(isAdmin || userRole === "owner" || userRole === "level2" || userRole === "level1") && (
              <Button onClick={() => setIsInviteDialogOpen(true)}>
                <UserPlus className="mr-2 h-4 w-4" />
                Inviter bruker
              </Button>
            )}
          </div>
        </div>

        {/* Top section: Location and Building site */}
        <div className="grid gap-6 md:grid-cols-2">
          <ProjectMap
            address={project.address}
            projectName={project.name}
          />

          {project.site_image_url && (
            <Card>
              <CardHeader>
                <CardTitle>Riggplan/oversikt</CardTitle>
                <CardDescription>
                  Klikk på portene og heisene for å administrere bookinger
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="relative border rounded-lg overflow-hidden">
                  <img
                    src={project.site_image_url}
                    alt="Byggeplass"
                    className="w-full h-auto"
                  />
                  {gates.map((gate) => {
                    const position = getGatePosition(gate.id);
                    if (!position) return null;

                    return (
                      <div
                        key={gate.id}
                        className="absolute -translate-x-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center shadow-lg border-2 border-white cursor-pointer hover:scale-110 transition-transform"
                        style={{
                          left: `${position.x * 100}%`,
                          top: `${position.y * 100}%`,
                        }}
                        onClick={() => handleGateClick(gate.id)}
                      >
                        {gate.display_order + 1}
                      </div>
                    );
                  })}

                  {elevators.map((elevator) => {
                    const position = getElevatorPosition(elevator.id);
                    if (!position) return null;

                    return (
                      <div
                        key={elevator.id}
                        className="absolute -translate-x-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-red-500 text-white flex items-center justify-center shadow-lg border-2 border-white cursor-pointer hover:scale-110 transition-transform"
                        style={{
                          left: `${position.x * 100}%`,
                          top: `${position.y * 100}%`,
                        }}
                        onClick={() => handleElevatorClick(elevator.id)}
                      >
                        H{elevator.display_order + 1}
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Project User Management Dialog */}
        <ProjectUserManagement
          open={isUserManagementOpen}
          onOpenChange={setIsUserManagementOpen}
          projectId={project.id}
          currentUserRole={userRole}
          isAdmin={isAdmin}
        />

        {/* Full width calendar booking section */}
        <Card>
          <CardHeader>
            <CardTitle>Velg dato</CardTitle>
            <CardDescription>
              Book leveranser til de ulike portene og heisene på byggeplassen
            </CardDescription>
          </CardHeader>
          <CardContent>
            <BookingCalendar
              projectId={project.id}
              userRole={userRole}
              selectedGate={selectedGate}
              onGateChange={setSelectedGate}
              resourcesRefreshKey={calendarRefreshKey}
            />
          </CardContent>
        </Card>
      </div>

      <EditProjectDialog
        open={isEditDialogOpen}
        onOpenChange={setIsEditDialogOpen}
        projectId={project.id}
        projectName={project.name}
        projectDescription={project.description}
        projectAddress={project.address}
        projectNumber={project.project_number}
        onSuccess={handleProjectUpdateSuccess}
      />

      <InviteUserDialog
        open={isInviteDialogOpen}
        onOpenChange={setIsInviteDialogOpen}
        projectId={project.id}
        projectName={project.name}
        userRole={userRole || "level1"}
        isAdmin={isAdmin}
      />

      <CompanyManagement
        open={isCompanyManagementOpen}
        onOpenChange={setIsCompanyManagementOpen}
        projectId={project.id}
        currentUserRole={userRole}
        isAdmin={isAdmin}
      />

      <SupplierManagement
        open={isSupplierManagementOpen}
        onOpenChange={setIsSupplierManagementOpen}
        projectId={project.id}
        currentUserRole={userRole}
      />
    </Layout>
  );
};

export default ProjectView;
