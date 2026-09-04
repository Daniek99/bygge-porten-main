import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
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
import { Plus, Search, Trash2, Building2 } from "lucide-react";

interface Company {
  id: string;
  company_name: string;
  organization_number: string | null;
  created_at: string;
}

interface CompanyManagementProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projectId: string;
  currentUserRole: "owner" | "level2" | "level1" | "level0" | null;
  isAdmin?: boolean;
}

export const CompanyManagement = ({
  open,
  onOpenChange,
  projectId,
  currentUserRole,
  isAdmin = false
}: CompanyManagementProps) => {
  const [companies, setCompanies] = useState<Company[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [isSearching, setIsSearching] = useState(false);
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [debounceTimer, setDebounceTimer] = useState<NodeJS.Timeout | null>(null);

  const canManageCompanies = currentUserRole === "owner" || currentUserRole === "level2" || isAdmin;

  useEffect(() => {
    if (open && canManageCompanies) {
      fetchCompanies();
    }
  }, [open, projectId, canManageCompanies]);

  // Cleanup timer on unmount
  useEffect(() => {
    return () => {
      if (debounceTimer) {
        clearTimeout(debounceTimer);
      }
    };
  }, [debounceTimer]);

  // Debounced search effect
  useEffect(() => {
    if (searchTerm.trim().length >= 2) {
      // Clear existing timer
      if (debounceTimer) {
        clearTimeout(debounceTimer);
      }

      // Set new timer for debounced search
      const timer = setTimeout(() => {
        searchBrønnøysund(searchTerm);
      }, 500); // 500ms delay

      setDebounceTimer(timer);

      // Cleanup timer on unmount or searchTerm change
      return () => {
        if (timer) {
          clearTimeout(timer);
        }
      };
    } else {
      // Clear results if search term is too short
      setSearchResults([]);
    }
  }, [searchTerm]);

  const fetchCompanies = async () => {
    try {
      const { data, error } = await supabase
        .from("project_companies")
        .select("*")
        .eq("project_id", projectId)
        .order("company_name");

      if (error) throw error;
      setCompanies(data || []);
    } catch (error: any) {
      console.error("Error fetching companies:", error);
      toast.error("Kunne ikke hente foretak");
    } finally {
      setIsLoading(false);
    }
  };

  const searchBrønnøysund = useCallback(async (query: string) => {
    if (!query.trim() || query.trim().length < 2) {
      setSearchResults([]);
      return;
    }

    setIsSearching(true);
    try {
      console.log("Searching Brønnøysund for:", query);
      // Using the Brønnøysund API endpoint
      const response = await fetch(`https://data.brreg.no/enhetsregisteret/api/enheter?navn=${encodeURIComponent(query)}`, {
        headers: {
          'Accept': 'application/json',
        }
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      const companies = data._embedded?.enheter || [];
      console.log("Search results:", companies.length, "companies found");
      setSearchResults(companies.slice(0, 10)); // Limit to 10 results for performance
    } catch (error: any) {
      console.error("Error searching Brønnøysund:", error);
      toast.error("Kunne ikke søke i Brønnøysundregisteret");
      setSearchResults([]);
    } finally {
      setIsSearching(false);
    }
  }, []);

  const addCompany = async (companyData: any) => {
    try {
      const { error } = await supabase
        .from("project_companies")
        .insert({
          project_id: projectId,
          company_name: companyData.navn,
          organization_number: companyData.organisasjonsnummer,
          created_by: (await supabase.auth.getUser()).data.user?.id
        });

      if (error) throw error;

      toast.success(`${companyData.navn} lagt til prosjektet`);
      fetchCompanies();
      setSearchResults([]);
      setSearchTerm("");
    } catch (error: any) {
      console.error("Error adding company:", error);
      toast.error("Kunne ikke legge til foretak");
    }
  };

  const removeCompany = async (companyId: string, companyName: string) => {
    try {
      const { error } = await supabase
        .from("project_companies")
        .delete()
        .eq("id", companyId);

      if (error) throw error;

      toast.success(`${companyName} fjernet fra prosjektet`);
      fetchCompanies();
    } catch (error: any) {
      console.error("Error removing company:", error);
      toast.error("Kunne ikke fjerne foretak");
    }
  };

  if (!canManageCompanies) {
    return null;
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[800px] max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Administrer foretak</DialogTitle>
          <DialogDescription>
            Legg til og administrer godkjente foretak for dette prosjektet
          </DialogDescription>
        </DialogHeader>

        {isLoading ? (
          <div className="text-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
          </div>
        ) : (
          <div className="space-y-6">
            {/* Search Section */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Finn foretak</CardTitle>
                <CardDescription>
                  Søk etter norske foretak som skal ha tilgang til prosjektet
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex gap-2">
                  <div className="flex-1">
                    <Label htmlFor="company-search">Foretaksnavn</Label>
                    <div className="relative">
                      <Input
                        id="company-search"
                        placeholder="Søk..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className={isSearching ? "pr-10" : ""}
                      />
                      {isSearching && (
                        <div className="absolute right-3 top-1/2 transform -translate-y-1/2">
                          <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-primary"></div>
                        </div>
                      )}
                    </div>
                    {searchTerm.length > 0 && searchTerm.length < 2 && (
                      <p className="text-xs text-muted-foreground mt-1">
                        Skriv minst 2 tegn for å søke
                      </p>
                    )}
                  </div>
                </div>

                {/* Search Results */}
                {searchTerm.length >= 2 && (
                  <div className="space-y-2">
                    <Label>
                      Søkeresultater: {isSearching ? (
                        <span className="text-muted-foreground">Søker...</span>
                      ) : (
                        <span className="text-muted-foreground">
                          {searchResults.length > 0 ? `${searchResults.length} funnet` : "Ingen funnet"}
                        </span>
                      )}
                    </Label>
                    {searchResults.length > 0 && (
                      <div className="max-h-60 overflow-y-auto space-y-2 border rounded-md p-2">
                        {searchResults.map((company, index) => (
                          <div key={`${company.organisasjonsnummer}-${index}`} className="flex items-center justify-between p-3 border rounded-lg hover:bg-muted/50 transition-colors">
                            <div className="flex-1">
                              <p className="font-medium">{company.navn}</p>
                              <p className="text-sm text-muted-foreground">
                                Org.nr: {company.organisasjonsnummer}
                              </p>
                            </div>
                            <Button
                              size="sm"
                              onClick={() => addCompany(company)}
                              disabled={isSearching}
                            >
                              <Plus className="h-4 w-4 mr-1" />
                              Legg til
                            </Button>
                          </div>
                        ))}
                      </div>
                    )}
                    {searchTerm.length >= 2 && !isSearching && searchResults.length === 0 && (
                      <div className="p-4 border rounded-md bg-muted/50 text-center">
                        <p className="text-sm text-muted-foreground">
                          Ingen foretak funnet for "{searchTerm}". Prøv et annet søkeord.
                        </p>
                      </div>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Current Companies */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Liste over selskaper</CardTitle>
                <CardDescription>
                  Foretak som har tilgang til dette prosjektet
                </CardDescription>
              </CardHeader>
              <CardContent>
                {companies.length === 0 ? (
                  <p className="text-muted-foreground text-center py-8">
                    Ingen foretak er lagt til prosjektet ennå
                  </p>
                ) : (
                  <div className="space-y-3">
                    {companies.map((company) => (
                      <div key={company.id} className="flex items-center justify-between p-3 border rounded-lg">
                        <div className="flex items-center gap-3">
                          <Building2 className="h-5 w-5 text-muted-foreground" />
                          <div>
                            <p className="font-medium">{company.company_name}</p>
                            {company.organization_number && (
                              <p className="text-sm text-muted-foreground">
                                Org.nr: {company.organization_number}
                              </p>
                            )}
                          </div>
                        </div>
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button variant="outline" size="icon">
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>Fjern foretak fra prosjekt?</AlertDialogTitle>
                              <AlertDialogDescription>
                                Dette vil fjerne {company.company_name} fra prosjektet.
                                Brukere fra dette foretaket vil miste tilgangen til prosjektet.
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Avbryt</AlertDialogCancel>
                              <AlertDialogAction
                                onClick={() => removeCompany(company.id, company.company_name)}
                                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                              >
                                Fjern foretak
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};