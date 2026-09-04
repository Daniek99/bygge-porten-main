import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
import { Trash2, Edit, UserCheck, UserX } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface ProjectMember {
  id: string;
  user_id: string;
  role: "owner" | "level2" | "level1" | "level0";
  created_at: string;
  profiles: {
    full_name: string;
    email: string | null;
    phone: string | null;
    company: string | null;
  };
}

interface ProjectUserManagementProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projectId: string;
  currentUserRole: "owner" | "level2" | "level1" | "level0" | null;
  isAdmin?: boolean;
  onUserUpdate?: () => void;
}

export const ProjectUserManagement = ({
  open,
  onOpenChange,
  projectId,
  currentUserRole,
  isAdmin = false,
  onUserUpdate
}: ProjectUserManagementProps) => {
  const [members, setMembers] = useState<ProjectMember[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [editingProfile, setEditingProfile] = useState<string | null>(null);
  const [profileForm, setProfileForm] = useState({
    full_name: "",
    email: "",
    phone: "",
    company: ""
  });

  const canManageUsers = currentUserRole === "owner" || currentUserRole === "level2" || isAdmin;

  useEffect(() => {
    if (canManageUsers) {
      fetchProjectMembers();
    }
  }, [projectId, canManageUsers]);

  const fetchProjectMembers = async () => {
    try {
      console.log("Fetching project members for projectId:", projectId);
      console.log("Current user role:", currentUserRole);
      console.log("Is admin:", isAdmin);

      const { data, error } = await supabase
        .from("project_members")
        .select(`
          id,
          user_id,
          role,
          created_at,
          profiles (
            full_name,
            email,
            phone,
            company
          )
        `)
        .eq("project_id", projectId)
        .order("created_at");

      if (error) {
        console.error("Supabase error:", error);
        throw error;
      }

      console.log("Raw data from Supabase:", data);
      const processedMembers = (data || []).map(member => ({
        ...member,
        profiles: {
          full_name: member.profiles?.full_name || "",
          email: member.profiles?.email || null,
          phone: member.profiles?.phone || null,
          company: member.profiles?.company || null
        }
      }));
      console.log("Processed members:", processedMembers);
      setMembers(processedMembers);
    } catch (error: any) {
      console.error("Error fetching project members:", error);
      toast.error("Kunne ikke hente prosjektmedlemmer");
    } finally {
      setIsLoading(false);
    }
  };

  const updateUserRole = async (memberId: string, newRole: "owner" | "level2" | "level1" | "level0") => {
    try {
      const { error } = await supabase
        .from("project_members")
        .update({ role: newRole })
        .eq("id", memberId);

      if (error) throw error;

      toast.success("Brukerrolle oppdatert");
      fetchProjectMembers();
      onUserUpdate?.();
    } catch (error: any) {
      console.error("Error updating user role:", error);
      toast.error("Kunne ikke oppdatere brukerrolle");
    }
  };

  const removeUserFromProject = async (memberId: string, userName: string) => {
    try {
      const { error } = await supabase
        .from("project_members")
        .delete()
        .eq("id", memberId);

      if (error) throw error;

      toast.success(`${userName} fjernet fra prosjektet`);
      fetchProjectMembers();
    } catch (error: any) {
      console.error("Error removing user:", error);
      toast.error("Kunne ikke fjerne bruker");
    }
  };

  const startEditProfile = async (member: ProjectMember) => {
    setEditingProfile(member.user_id);
    setProfileForm({
      full_name: member.profiles.full_name,
      email: member.profiles.email || "",
      phone: member.profiles.phone || "",
      company: member.profiles.company || ""
    });
  };

  const saveProfile = async () => {
    if (!editingProfile) return;
    
    try {
      const { error } = await supabase
        .from("profiles")
        .update({
          full_name: profileForm.full_name,
          email: profileForm.email,
          phone: profileForm.phone,
          company: profileForm.company
        })
        .eq("id", editingProfile);

      if (error) throw error;

      toast.success("Profil oppdatert");
      setEditingProfile(null);
      fetchProjectMembers();
    } catch (error: any) {
      console.error("Error updating profile:", error);
      toast.error("Kunne ikke oppdatere profil");
    }
  };

  const cancelEditProfile = () => {
    setEditingProfile(null);
    setProfileForm({
      full_name: "",
      email: "",
      phone: "",
      company: ""
    });
  };

  const getRoleBadge = (role: string) => {
    const variants: Record<string, { label: string; className: string }> = {
      owner: { label: "Eier", className: "bg-purple-500" },
      level2: { label: "Administrator", className: "bg-blue-500" },
      level1: { label: "UE", className: "bg-green-500" },
      level0: { label: "Leverandør", className: "bg-orange-500" },
    };
    const variant = variants[role] || { label: role, className: "bg-gray-500" };
    return <Badge className={variant.className}>{variant.label}</Badge>;
  };

  const getRoleSectionTitle = (role: string) => {
    const titles: Record<string, string> = {
      owner: "Eiere",
      level2: "Administratorer",
      level1: "UE",
      level0: "Leverandører",
    };
    return titles[role] || "Ukjent rolle";
  };

  const getRoleOptions = () => {
    if (currentUserRole === "owner") {
      return [
        { value: "level2", label: "Administrator" },
        { value: "level1", label: "UE" },
        { value: "level0", label: "Leverandør" },
      ];
    } else if (currentUserRole === "level2") {
      return [
        { value: "level1", label: "UE" },
        { value: "level0", label: "Leverandør" },
      ];
    }
    return [];
  };

  const visibleRoles = currentUserRole === "owner"
    ? ["owner", "level2", "level1", "level0"]
    : currentUserRole === "level2"
    ? ["owner", "level2", "level1", "level0"]
    : currentUserRole === "level1"
    ? ["level1"]
    : [];

  if (!canManageUsers) {
    return null;
  }

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-[700px] max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Administrer prosjektbrukere</DialogTitle>
            <DialogDescription>
              Se og administrer alle brukere med tilgang til prosjektet
            </DialogDescription>
          </DialogHeader>

          {isLoading ? (
            <div className="text-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
            </div>
          ) : (
            <div className="space-y-6">
              {members.length === 0 ? (
                <p className="text-muted-foreground text-center py-8">
                  Ingen medlemmer i prosjektet ennå
                </p>
              ) : (
                <div className="space-y-6">
                  {/* Group members by company */}
                  {(() => {
                    // Group members by company
                    const companyGroups = members.reduce((groups, member) => {
                      const company = member.profiles.company || "Uten firma";
                      if (!groups[company]) {
                        groups[company] = [];
                      }
                      groups[company].push(member);
                      return groups;
                    }, {} as Record<string, typeof members>);

                    return Object.entries(companyGroups).map(([company, companyMembers]) => (
                      <div key={company} className="space-y-4">
                        <div className="flex items-center gap-2">
                          <h3 className="text-lg font-semibold">{company}</h3>
                          <Badge variant="outline">{companyMembers.length}</Badge>
                        </div>

                        {/* Group members by role within each company */}
                        {visibleRoles.map((role) => {
                          const roleMembers = companyMembers.filter(member => member.role === role);
                          if (roleMembers.length === 0) return null;

                          return (
                            <div key={role} className="space-y-2 ml-4">
                              <div className="flex items-center gap-2">
                                <h4 className="text-md font-medium">{getRoleSectionTitle(role)}</h4>
                                <Badge variant="secondary" className="text-xs">{roleMembers.length}</Badge>
                              </div>

                              <div className="space-y-2">
                                {roleMembers.map((member) => (
                                  <div key={member.id} className="flex items-center justify-between p-4 border rounded-lg ml-4">
                                    <div className="flex-1">
                                      <div className="flex items-center gap-3">
                                        <div>
                                          <p className="font-medium">{member.profiles.full_name}</p>
                                          {member.profiles.email && (
                                            <p className="text-sm text-muted-foreground">{member.profiles.email}</p>
                                          )}
                                          {member.profiles.phone && (
                                            <p className="text-sm text-muted-foreground">{member.profiles.phone}</p>
                                          )}
                                        </div>
                                        {getRoleBadge(member.role)}
                                      </div>
                                    </div>

                                    <div className="flex items-center gap-2">
                                      {currentUserRole === "owner" && member.role !== "owner" && (
                                        <Select
                                          value={member.role}
                                          onValueChange={(value) => updateUserRole(member.id, value as any)}
                                        >
                                          <SelectTrigger className="w-32">
                                            <SelectValue />
                                          </SelectTrigger>
                                          <SelectContent>
                                            {getRoleOptions().map((option) => (
                                              <SelectItem key={option.value} value={option.value}>
                                                {option.label}
                                              </SelectItem>
                                            ))}
                                          </SelectContent>
                                        </Select>
                                      )}

                                      {currentUserRole === "level2" && member.role !== "owner" && member.role !== "level2" && (
                                        <Select
                                          value={member.role}
                                          onValueChange={(value) => updateUserRole(member.id, value as any)}
                                        >
                                          <SelectTrigger className="w-32">
                                            <SelectValue />
                                          </SelectTrigger>
                                          <SelectContent>
                                            {getRoleOptions().map((option) => (
                                              <SelectItem key={option.value} value={option.value}>
                                                {option.label}
                                              </SelectItem>
                                            ))}
                                          </SelectContent>
                                        </Select>
                                      )}

                                      {currentUserRole === "level2" && (member.role === "level1" || member.role === "level0") && (
                                        <Button
                                          variant="outline"
                                          size="icon"
                                          onClick={() => startEditProfile(member)}
                                        >
                                          <Edit className="h-4 w-4" />
                                        </Button>
                                      )}

                                      {((currentUserRole === "owner") || (currentUserRole === "level2" && member.role === "level1") || (currentUserRole === "level2" && member.role === "level0")) && (
                                        <AlertDialog>
                                          <AlertDialogTrigger asChild>
                                            <Button variant="outline" size="icon">
                                              <Trash2 className="h-4 w-4" />
                                            </Button>
                                          </AlertDialogTrigger>
                                          <AlertDialogContent>
                                            <AlertDialogHeader>
                                              <AlertDialogTitle>Fjern bruker fra prosjekt?</AlertDialogTitle>
                                              <AlertDialogDescription>
                                                Dette vil fjerne {member.profiles.full_name} fra prosjektet.
                                                De vil miste all tilgang til prosjektets bookinger og informasjon.
                                              </AlertDialogDescription>
                                            </AlertDialogHeader>
                                            <AlertDialogFooter>
                                              <AlertDialogCancel>Avbryt</AlertDialogCancel>
                                              <AlertDialogAction
                                                onClick={() => removeUserFromProject(member.id, member.profiles.full_name)}
                                                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                              >
                                                Fjern bruker
                                              </AlertDialogAction>
                                            </AlertDialogFooter>
                                          </AlertDialogContent>
                                        </AlertDialog>
                                      )}
                                    </div>
                                  </div>
                                ))}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    ));
                  })()}
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Profile editing dialog */}
      {editingProfile && (
        <Dialog open={true} onOpenChange={() => setEditingProfile(null)}>
          <DialogContent className="sm:max-w-[500px]">
            <DialogHeader>
              <DialogTitle>Rediger profil</DialogTitle>
              <DialogDescription>
                Endre navn, e-post, telefon og firma for brukeren
              </DialogDescription>
            </DialogHeader>
          
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="full_name">Fullt navn</Label>
                <Input
                  id="full_name"
                  value={profileForm.full_name}
                  onChange={(e) => setProfileForm(prev => ({ ...prev, full_name: e.target.value }))}
                  placeholder="Skriv inn navn"
                />
              </div>
            
              <div className="space-y-2">
                <Label htmlFor="email">E-post</Label>
                <Input
                  id="email"
                  type="email"
                  value={profileForm.email}
                  onChange={(e) => setProfileForm(prev => ({ ...prev, email: e.target.value }))}
                  placeholder="Skriv inn e-post"
                />
              </div>
            
              <div className="space-y-2">
                <Label htmlFor="phone">Telefon</Label>
                <Input
                  id="phone"
                  value={profileForm.phone}
                  onChange={(e) => setProfileForm(prev => ({ ...prev, phone: e.target.value }))}
                  placeholder="Skriv inn telefon"
                />
              </div>
            
              <div className="space-y-2">
                <Label htmlFor="company">Firma</Label>
                <Input
                  id="company"
                  value={profileForm.company}
                  onChange={(e) => setProfileForm(prev => ({ ...prev, company: e.target.value }))}
                  placeholder="Skriv inn firma"
                />
              </div>
            </div>
          
            <div className="flex justify-end gap-2 pt-4">
              <Button variant="outline" onClick={cancelEditProfile}>
                Avbryt
              </Button>
              <Button onClick={saveProfile}>
                Lagre
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      )}
    </>
  );
};