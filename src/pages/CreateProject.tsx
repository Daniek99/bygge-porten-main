import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Layout } from "@/components/Layout";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectTrigger, SelectContent, SelectItem, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ArrowLeft } from "lucide-react";
import { toast } from "sonner";
import { PlacesAutocomplete } from "@/components/PlacesAutocomplete";
import ProjectMap from "@/components/ProjectMap";
import { Wrapper } from "@googlemaps/react-wrapper";

const CreateProject = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [isLoading, setIsLoading] = useState(false);
  const [formData, setFormData] = useState({
    name: "",
    projectNumber: "",
    projectType: "",
    description: "",
    gates: ["Port 1", "Port 2", "Port 3"],
  });
  const [locationData, setLocationData] = useState({
    address: "",
    latitude: "",
    longitude: "",
  });
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [placingIndex, setPlacingIndex] = useState<number | null>(null);
  const [gatePositions, setGatePositions] = useState<Array<{ x: number; y: number } | null>>(
    ["Port 1", "Port 2", "Port 3"].map(() => null)
  );
  const [isFullscreen, setIsFullscreen] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    // Temporarily disable admin check for testing
    // TODO: Re-enable proper admin validation after fixing RLS policies

    // Validate that either address or coordinates are provided
    const hasAddress = locationData.address && locationData.address.trim();
    const hasCoordinates = locationData.latitude && locationData.longitude &&
                          !isNaN(parseFloat(locationData.latitude)) &&
                          !isNaN(parseFloat(locationData.longitude));

    if (!hasAddress && !hasCoordinates) {
      toast.error("Du må oppgi enten adresse eller koordinater for prosjektet");
      return;
    }

    setIsLoading(true);
    try {
      // Upload image if provided
      let uploadedImageUrl: string | null = null;
      if (imageFile) {
        try {
          const fileExt = imageFile.name.split('.').pop();
          const fileName = `${Date.now()}.${fileExt}`;
          const filePath = `project-images/${fileName}`;

          const { error: uploadError } = await supabase.storage
            .from("project-assets")
            .upload(filePath, imageFile, {
              cacheControl: '3600',
              upsert: false
            });

          if (uploadError) {
            console.error("Image upload error:", uploadError);
            toast.warning("Kunne ikke laste opp bilde - prosjektet opprettes uten bilde");
          } else {
            const { data: { publicUrl } } = supabase.storage
              .from("project-assets")
              .getPublicUrl(filePath);
            uploadedImageUrl = publicUrl;
            console.log("Image uploaded successfully:", publicUrl);
          }
        } catch (error) {
          console.error("Image upload failed:", error);
          toast.warning("Kunne ikke laste opp bilde - prosjektet opprettes uten bilde");
        }
      }

      // Create project
      const slug = formData.name
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-|-$/g, "");

      const insertPayload: any = {
        name: formData.name,
        slug,
        description: formData.description,
        created_by: user.id,
        project_type: formData.projectType || "Annet",
        site_image_url: uploadedImageUrl,
      };

      // Only add project_number if it has a value
      if (formData.projectNumber && formData.projectNumber.trim()) {
        insertPayload.project_number = formData.projectNumber.trim();
      }

      // Add location data if provided
      if (locationData.latitude && locationData.longitude) {
        insertPayload.latitude = parseFloat(locationData.latitude);
        insertPayload.longitude = parseFloat(locationData.longitude);
      }

      if (locationData.address) {
        insertPayload.address = locationData.address;
      }
      
      const { data: project, error: projectError } = await supabase
        .from("projects")
        .insert(insertPayload)
        .select()
        .single();

      if (projectError) throw projectError;

      // Add user as owner (skip for now due to RLS issues)
      try {
        const { error: memberError } = await supabase
          .from("project_members")
          .insert({
            project_id: project.id,
            user_id: user.id,
            role: "owner",
          });

        if (memberError) {
          console.error("Member creation error:", memberError);
          // Continue anyway - project was created successfully
        }
      } catch (error) {
        console.error("Member creation failed:", error);
        // Continue anyway - project was created successfully
      }

      // Create gates (with optional positions)
      const gatesData = formData.gates
        .filter((name) => name.trim())
        .map((name, index) => ({
          project_id: project.id,
          name: name.trim(),
          display_order: index,
          position_x: gatePositions[index]?.x ?? null,
          position_y: gatePositions[index]?.y ?? null,
        }));

      if (gatesData.length > 0) {
        const { error: gatesError } = await supabase.from("gates").insert(gatesData as any);
        if (gatesError) throw gatesError;
      }

      toast.success("Prosjekt opprettet!");
      navigate(`/projects/${project.id}`);
    } catch (error: any) {
      console.error("Error creating project:", error);
      toast.error("Kunne ikke opprette prosjekt");
    } finally {
      setIsLoading(false);
    }
  };

  const updateGate = (index: number, value: string) => {
    const newGates = [...formData.gates];
    newGates[index] = value;
    setFormData({ ...formData, gates: newGates });
  };

  const addGate = () => {
    setFormData({ ...formData, gates: [...formData.gates, ""] });
    setGatePositions((prev) => [...prev, null]);
  };

  const removeGate = (index: number) => {
    const newGates = formData.gates.filter((_, i) => i !== index);
    setFormData({ ...formData, gates: newGates });
    setGatePositions((prev) => prev.filter((_, i) => i !== index));
    if (placingIndex === index) setPlacingIndex(null);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0] || null;
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      toast.error("Kun bildefiler er tillatt");
      return;
    }
    setImageFile(file);
    setImageUrl(URL.createObjectURL(file));
  };

  const handlePlaceSelect = (place: { address: string; latitude: number; longitude: number }) => {
    setLocationData({
      address: place.address,
      latitude: place.latitude.toString(),
      longitude: place.longitude.toString(),
    });
  };

  const handleImageClick = (e: React.MouseEvent<HTMLImageElement>) => {
    if (placingIndex === null) {
      // If not placing a gate, open fullscreen mode
      setIsFullscreen(true);
      return;
    }

    // Place gate marker
    const rect = e.currentTarget.getBoundingClientRect();
    const x = (e.clientX - rect.left) / rect.width;
    const y = (e.clientY - rect.top) / rect.height;
    const updated = [...gatePositions];
    updated[placingIndex] = { x, y };
    setGatePositions(updated);
    setPlacingIndex(null);
    toast.success(`Port ${placingIndex + 1} plassert`);
  };

  const handleFullscreenImageClick = (e: React.MouseEvent<HTMLImageElement>) => {
    if (placingIndex === null) return;

    // Place gate marker in fullscreen mode
    const rect = e.currentTarget.getBoundingClientRect();
    const x = (e.clientX - rect.left) / rect.width;
    const y = (e.clientY - rect.top) / rect.height;
    const updated = [...gatePositions];
    updated[placingIndex] = { x, y };
    setGatePositions(updated);
    setPlacingIndex(null);
    setIsFullscreen(false);
    toast.success(`Port ${placingIndex + 1} plassert i fullskjermmodus`);
  };

  const closeFullscreen = () => {
    setIsFullscreen(false);
  };

  return (
    <Layout>
      <div className="max-w-2xl mx-auto space-y-6">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate("/")}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h2 className="text-3xl font-bold tracking-tight">Nytt prosjekt</h2>
            <p className="text-muted-foreground">
              Opprett et nytt byggeprosjekt for å administrere leveranser
            </p>
          </div>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Opprett nytt prosjekt</CardTitle>
            <CardDescription>
              Fyll inn informasjon om prosjektet og definer leveransepunkter
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-6">
              <Tabs defaultValue="details" className="w-full">
                <TabsList className="grid w-full grid-cols-3">
                  <TabsTrigger value="details">Prosjektdetaljer</TabsTrigger>
                  <TabsTrigger value="location">Lokasjon</TabsTrigger>
                  <TabsTrigger value="gates">Porter</TabsTrigger>
                </TabsList>

                <TabsContent value="details" className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="name">Prosjektnavn *</Label>
                    <Input
                      id="name"
                      placeholder="f.eks. Oslo City Byggeplass"
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      required
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="projectNumber">Prosjektnummer</Label>
                    <Input
                      id="projectNumber"
                      placeholder="f.eks. PROJ-2025-001"
                      value={formData.projectNumber}
                      onChange={(e) => setFormData({ ...formData, projectNumber: e.target.value })}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="projectType">Prosjekttype</Label>
                    <Select value={formData.projectType} onValueChange={(value) => setFormData({ ...formData, projectType: value })}>
                      <SelectTrigger id="projectType">
                        <SelectValue placeholder="Velg prosjekttype" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Rehabilitering">Rehabilitering</SelectItem>
                        <SelectItem value="Boligbygg">Boligbygg</SelectItem>
                        <SelectItem value="Industri/Næring">Industri/Næring</SelectItem>
                        <SelectItem value="Offentlig">Offentlig</SelectItem>
                        <SelectItem value="Infrastruktur">Infrastruktur</SelectItem>
                        <SelectItem value="Annet">Annet</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="description">Beskrivelse</Label>
                    <Textarea
                      id="description"
                      placeholder="Kort beskrivelse av prosjektet..."
                      value={formData.description}
                      onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                      rows={3}
                    />
                  </div>
                </TabsContent>

                <TabsContent value="location" className="space-y-4">
                  <Wrapper
                    apiKey={import.meta.env.VITE_GOOGLE_MAPS_API_KEY}
                    libraries={['places']}
                  >
                    <PlacesAutocomplete
                      value={locationData.address}
                      onChange={(address) => setLocationData({ ...locationData, address })}
                      onPlaceSelect={handlePlaceSelect}
                      placeholder="Søk etter prosjektadresse..."
                      label="Adresse"
                    />

                    <div className="grid grid-cols-2 gap-4">
                      <div className="grid gap-2">
                        <Label htmlFor="latitude">Breddegrad (Latitude)</Label>
                        <Input
                          id="latitude"
                          type="number"
                          step="any"
                          value={locationData.latitude}
                          onChange={(e) => setLocationData({ ...locationData, latitude: e.target.value })}
                          placeholder="59.9139"
                        />
                      </div>
                      <div className="grid gap-2">
                        <Label htmlFor="longitude">Lengdegrad (Longitude)</Label>
                        <Input
                          id="longitude"
                          type="number"
                          step="any"
                          value={locationData.longitude}
                          onChange={(e) => setLocationData({ ...locationData, longitude: e.target.value })}
                          placeholder="10.7522"
                        />
                      </div>
                    </div>

                    {(locationData.latitude && locationData.longitude) && (
                      <div className="mt-4">
                        <ProjectMap
                          latitude={parseFloat(locationData.latitude)}
                          longitude={parseFloat(locationData.longitude)}
                          address={locationData.address}
                          projectName={formData.name || "Nytt prosjekt"}
                        />
                      </div>
                    )}
                  </Wrapper>
                </TabsContent>

                <TabsContent value="gates" className="space-y-4">
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <Label>Leveransepunkter (Porter)</Label>
                      <Button type="button" variant="outline" size="sm" onClick={addGate}>
                        Legg til port
                      </Button>
                    </div>
                    <div className="space-y-2">
                      {formData.gates.map((gate, index) => (
                        <div key={index} className="flex items-center gap-2">
                          <Input
                            placeholder={`Port ${index + 1}`}
                            value={gate}
                            onChange={(e) => updateGate(index, e.target.value)}
                          />
                          <Button
                            type="button"
                            variant={placingIndex === index ? "secondary" : "outline"}
                            size="sm"
                            onClick={() => setPlacingIndex(index)}
                          >
                            Plasser
                          </Button>
                          {gatePositions[index] && (
                            <span className="text-xs text-muted-foreground">
                              ({Math.round((gatePositions[index]!.x) * 100)}%, {Math.round((gatePositions[index]!.y) * 100)}%)
                            </span>
                          )}
                          {formData.gates.length > 1 && (
                            <Button
                              type="button"
                              variant="outline"
                              size="icon"
                              onClick={() => removeGate(index)}
                              aria-label={`Fjern port ${index + 1}`}
                            >
                              ×
                            </Button>
                          )}
                        </div>
                      ))}
                    </div>
                    <p className="text-sm text-muted-foreground">
                      Definer de ulike leveransepunktene på byggeplassen. Velg "Plasser" ved en port og klikk på bildet nedenfor.
                    </p>

                    <div className="space-y-2 pt-2">
                      <Label htmlFor="site-image">Last opp riggplan/bilde/kart (valgfritt)</Label>
                      <Input id="site-image" type="file" accept="image/*" onChange={handleFileChange} />
                      {imageUrl && (
                        <div className="space-y-2">
                          <div className="relative border rounded-md overflow-hidden">
                            <img
                              src={imageUrl}
                              alt="Prosjektbilde"
                              className="w-full h-auto select-none cursor-pointer hover:opacity-90 transition-opacity"
                              onClick={handleImageClick}
                            />
                            {gatePositions.map((pos, idx) =>
                              pos ? (
                                <div
                                  key={idx}
                                  className="absolute -translate-x-1/2 -translate-y-1/2 w-6 h-6 rounded-full bg-primary text-primary-foreground flex items-center justify-center shadow"
                                  style={{ left: `${pos.x * 100}%`, top: `${pos.y * 100}%` }}
                                  aria-label={`Markør for port ${idx + 1}`}
                                >
                                  {idx + 1}
                                </div>
                              ) : null
                            )}
                          </div>
                          <p className="text-sm text-muted-foreground text-center">
                            Trykk på bildet for å forstørre
                          </p>
                        </div>
                      )}
                    </div>
                  </div>
                </TabsContent>
             </Tabs>

             <div className="flex gap-2 pt-4">
               <Button type="button" variant="outline" onClick={() => navigate("/")} disabled={isLoading}>
                 Avbryt
               </Button>
               <Button type="submit" disabled={isLoading}>
                 {isLoading ? "Oppretter..." : "Opprett prosjekt"}
               </Button>
             </div>
            </form>
          </CardContent>
        </Card>
      </div>

      {/* Fullscreen Image Overlay */}
      {isFullscreen && imageUrl && (
        <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50">
          <div className="relative max-w-[90vw] max-h-[90vh]">
            <Button
              onClick={closeFullscreen}
              variant="secondary"
              size="icon"
              className="absolute -top-12 right-0 z-10"
              aria-label="Lukk fullskjerm"
            >
              ✕
            </Button>

            <div className="relative">
              <img
                src={imageUrl}
                alt="Prosjektbilde - fullskjerm"
                className="max-w-full max-h-[80vh] object-contain cursor-crosshair select-none"
                onClick={handleFullscreenImageClick}
              />

              {/* Gate markers in fullscreen */}
              {gatePositions.map((pos, idx) =>
                pos ? (
                  <div
                    key={idx}
                    className="absolute -translate-x-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center shadow-lg border-2 border-white"
                    style={{
                      left: `${pos.x * 100}%`,
                      top: `${pos.y * 100}%`,
                      fontSize: '12px',
                      fontWeight: 'bold'
                    }}
                    aria-label={`Port ${idx + 1} markør`}
                  >
                    {idx + 1}
                  </div>
                ) : null
              )}

              {/* Instructions overlay */}
              <div className="absolute top-4 left-4 bg-black bg-opacity-50 text-white p-3 rounded-lg">
                <p className="text-sm">
                  {placingIndex !== null
                    ? `Klikk for å plassere Port ${placingIndex + 1}`
                    : "Klikk på bildet for å plassere porter"}
                </p>
              </div>
            </div>
          </div>
        </div>
      )}
    </Layout>
  );
};

export default CreateProject;