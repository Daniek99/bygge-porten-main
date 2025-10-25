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
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PlacesAutocomplete } from "@/components/PlacesAutocomplete";
import ProjectMap from "@/components/ProjectMap";

interface WorkingHours {
  start: string;
  end: string;
  enabled: boolean;
}

interface EditProjectDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projectId: string;
  projectName: string;
  projectDescription: string | null;
  projectLatitude?: number | null;
  projectLongitude?: number | null;
  projectAddress?: string | null;
  projectNumber?: string | null;
  onSuccess: () => void;
}

const DAYS = [
  { key: 'monday', label: 'Mandag' },
  { key: 'tuesday', label: 'Tirsdag' },
  { key: 'wednesday', label: 'Onsdag' },
  { key: 'thursday', label: 'Torsdag' },
  { key: 'friday', label: 'Fredag' },
  { key: 'saturday', label: 'Lørdag' },
  { key: 'sunday', label: 'Søndag' },
];

export const EditProjectDialog = ({
  open,
  onOpenChange,
  projectId,
  projectName: initialName,
  projectDescription: initialDescription,
  projectLatitude: initialLatitude,
  projectLongitude: initialLongitude,
  projectAddress: initialAddress,
  projectNumber: initialProjectNumber,
  onSuccess,
}: EditProjectDialogProps) => {
  const [isLoading, setIsLoading] = useState(false);
  const [name, setName] = useState(initialName);
  const [description, setDescription] = useState(initialDescription || "");
  const [projectNumber, setProjectNumber] = useState(initialProjectNumber || "");
  const [latitude, setLatitude] = useState(initialLatitude?.toString() || "");
  const [longitude, setLongitude] = useState(initialLongitude?.toString() || "");
  const [address, setAddress] = useState(initialAddress || "");
  const [workingHours, setWorkingHours] = useState<Record<string, WorkingHours>>({
    monday: { start: '07:00', end: '15:30', enabled: true },
    tuesday: { start: '07:00', end: '15:30', enabled: true },
    wednesday: { start: '07:00', end: '15:30', enabled: true },
    thursday: { start: '07:00', end: '15:30', enabled: true },
    friday: { start: '07:00', end: '13:30', enabled: true },
    saturday: { start: '07:00', end: '15:30', enabled: false },
    sunday: { start: '07:00', end: '15:30', enabled: false },
  });
  const [gates, setGates] = useState<string[]>(["Port 1", "Port 2", "Port 3"]);
  const [gatePositions, setGatePositions] = useState<Array<{ x: number; y: number } | null>>([]);
  const [elevators, setElevators] = useState<string[]>(["Heis 1"]);
  const [elevatorPositions, setElevatorPositions] = useState<Array<{ x: number; y: number } | null>>([]);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [placingIndex, setPlacingIndex] = useState<number | null>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);

  useEffect(() => {
    if (open) {
      setName(initialName);
      setDescription(initialDescription || "");
      setProjectNumber(initialProjectNumber || "");
      setLatitude(initialLatitude?.toString() || "");
      setLongitude(initialLongitude?.toString() || "");
      setAddress(initialAddress || "");
      fetchProjectDetails();
      fetchGates();
      fetchElevators();
    }
  }, [open, projectId, initialName, initialDescription, initialProjectNumber, initialLatitude, initialLongitude, initialAddress]);

  const fetchProjectDetails = async () => {
    try {
      const { data, error } = await supabase
        .from("projects")
        .select("working_hours, site_image_url")
        .eq("id", projectId)
        .single();

      if (error) throw error;
      if (data?.working_hours) {
        setWorkingHours(data.working_hours as unknown as Record<string, WorkingHours>);
      }
      if (data?.site_image_url) {
        setImageUrl(data.site_image_url);
      }
    } catch (error) {
      console.error("Error fetching project details:", error);
    }
  };

  const fetchGates = async () => {
    try {
      const { data, error } = await supabase
        .from("gates")
        .select("name, position_x, position_y")
        .eq("project_id", projectId)
        .order("display_order");

      if (error) throw error;

      if (data && data.length > 0) {
        setGates(data.map(gate => gate.name));
        setGatePositions(data.map(gate => gate.position_x && gate.position_y ? {
          x: gate.position_x,
          y: gate.position_y
        } : null));
      } else {
        // If no gates exist, initialize with defaults
        setGates(["Port 1", "Port 2", "Port 3"]);
        setGatePositions([null, null, null]);
      }
    } catch (error) {
      console.error("Error fetching gates:", error);
    }
  };

  const fetchElevators = async () => {
    try {
      const { data, error } = await supabase
        .from("elevators")
        .select("name, position_x, position_y")
        .eq("project_id", projectId)
        .eq("is_active", true)
        .order("display_order");

      if (error) throw error;

      if (data && data.length > 0) {
        setElevators(data.map(elevator => elevator.name));
        setElevatorPositions(data.map(elevator => elevator.position_x && elevator.position_y ? {
          x: elevator.position_x,
          y: elevator.position_y
        } : null));
      } else {
        // If no elevators exist, initialize with default
        setElevators(["Heis 1"]);
        setElevatorPositions([null]);
      }
    } catch (error) {
      console.error("Error fetching elevators:", error);
      // Initialize with default even if fetch fails
      setElevators(["Heis 1"]);
      setElevatorPositions([null]);
    }
  };

  const handlePlaceSelect = (place: { address: string; latitude: number; longitude: number }) => {
    console.log("Place selected:", place);
    setAddress(place.address);
    setLatitude(place.latitude.toString());
    setLongitude(place.longitude.toString());
    toast.success(`Adresse valgt: ${place.address}`);
    console.log("Updated coordinates:", { latitude: place.latitude, longitude: place.longitude });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!name.trim()) {
      toast.error("Prosjektnavn er påkrevd");
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
            toast.warning("Kunne ikke laste opp bilde - prosjektet oppdateres uten bilde");
          } else {
            const { data: { publicUrl } } = supabase.storage
              .from("project-assets")
              .getPublicUrl(filePath);
            uploadedImageUrl = publicUrl;
          }
        } catch (error) {
          console.error("Image upload failed:", error);
          toast.warning("Kunne ikke laste opp bilde - prosjektet oppdateres uten bilde");
        }
      }

      // Prepare the update data with proper null handling
      const updateData: any = {
        name: name.trim(),
        description: description.trim() || null,
        project_number: projectNumber.trim() || null,
        working_hours: workingHours as any,
      };

      // Handle location fields properly
      const latValue = latitude ? parseFloat(latitude) : null;
      const lngValue = longitude ? parseFloat(longitude) : null;

      if (latValue !== null && !isNaN(latValue)) {
        updateData.latitude = latValue;
      } else if (latitude === '') {
        updateData.latitude = null; // Allow clearing coordinates
      }

      if (lngValue !== null && !isNaN(lngValue)) {
        updateData.longitude = lngValue;
      } else if (longitude === '') {
        updateData.longitude = null; // Allow clearing coordinates
      }

      if (address !== undefined && address.trim() !== '') {
        updateData.address = address.trim();
      } else if (address === '') {
        updateData.address = null; // Allow clearing address
      }

      if (uploadedImageUrl) {
        updateData.site_image_url = uploadedImageUrl;
      }

      console.log("Updating project with data:", updateData);

      const { error } = await supabase
        .from("projects")
        .update(updateData)
        .eq("id", projectId);

      if (error) {
        console.error("Supabase error:", error);
        throw error;
      }

      // Update gates
      const validGates = gates.filter(gate => gate.trim());
      if (validGates.length > 0) {
        // Delete existing gates
        await supabase.from("gates").delete().eq("project_id", projectId);

        // Insert new gates
        const gatesData = validGates.map((gateName, index) => ({
          project_id: projectId,
          name: gateName.trim(),
          display_order: index,
          position_x: gatePositions[index]?.x ?? null,
          position_y: gatePositions[index]?.y ?? null,
        }));

        const { error: gatesError } = await supabase.from("gates").insert(gatesData);
        if (gatesError) {
          console.error("Error updating gates:", gatesError);
          toast.warning("Prosjekt oppdatert, men kunne ikke oppdatere porter");
        }
      }

      // Update elevators
      const validElevators = elevators.filter(elevator => elevator.trim());
      if (validElevators.length > 0) {
        // Delete existing elevators
        await supabase.from("elevators").delete().eq("project_id", projectId);

        // Insert new elevators
        const elevatorsData = validElevators.map((elevatorName, index) => ({
          project_id: projectId,
          name: elevatorName.trim(),
          display_order: index,
          position_x: elevatorPositions[index]?.x ?? null,
          position_y: elevatorPositions[index]?.y ?? null,
          is_active: true,
          capacity: null, // Can be added later if needed
          floors_served: null, // Can be added later if needed
          operating_hours: null, // Can be added later if needed
        }));

        const { error: elevatorsError } = await supabase.from("elevators").insert(elevatorsData);
        if (elevatorsError) {
          console.error("Error updating elevators:", elevatorsError);
          toast.warning("Prosjekt oppdatert, men kunne ikke oppdatere heiser");
        }
      }

      toast.success("Prosjekt oppdatert!");
      onSuccess();
      onOpenChange(false);
    } catch (error: any) {
      console.error("Error updating project:", error);
      toast.error(`Kunne ikke oppdatere prosjekt: ${error.message || 'Ukjent feil'}`);
    } finally {
      setIsLoading(false);
    }
  };

  const updateWorkingHours = (day: string, field: keyof WorkingHours, value: string | boolean) => {
    setWorkingHours((prev) => ({
      ...prev,
      [day]: {
        ...prev[day],
        [field]: value,
      },
    }));
  };

  const updateGate = (index: number, value: string) => {
    const newGates = [...gates];
    newGates[index] = value;
    setGates(newGates);
  };

  const addGate = () => {
    setGates([...gates, ""]);
    setGatePositions([...gatePositions, null]);
  };

  const removeGate = (index: number) => {
    const newGates = gates.filter((_, i) => i !== index);
    setGates(newGates);
    setGatePositions(gatePositions.filter((_, i) => i !== index));

    // Adjust placingIndex if we're removing a gate before the current placingIndex
    if (placingIndex !== null) {
      if (placingIndex === index) {
        setPlacingIndex(null);
      } else if (placingIndex > index) {
        setPlacingIndex(placingIndex - 1);
      }
    }
  };

  // Elevator management functions
  const updateElevator = (index: number, value: string) => {
    const newElevators = [...elevators];
    newElevators[index] = value;
    setElevators(newElevators);
  };

  const addElevator = () => {
    setElevators([...elevators, `Heis ${elevators.length + 1}`]);
    setElevatorPositions([...elevatorPositions, null]);
  };

  const removeElevator = (index: number) => {
    const newElevators = elevators.filter((_, i) => i !== index);
    setElevators(newElevators);
    setElevatorPositions(elevatorPositions.filter((_, i) => i !== index));

    // Adjust placingIndex if we're removing the elevator being placed
    if (placingIndex !== null && placingIndex >= gates.length + index) {
      setPlacingIndex(placingIndex - 1);
    }
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

  const handleImageClick = (e: React.MouseEvent<HTMLImageElement>) => {
    if (placingIndex === null) {
      setIsFullscreen(true);
      return;
    }

    const rect = e.currentTarget.getBoundingClientRect();
    const x = (e.clientX - rect.left) / rect.width;
    const y = (e.clientY - rect.top) / rect.height;

    // Check if we're placing a gate or elevator
    if (placingIndex < gates.length) {
      // Placing a gate
      const updated = [...gatePositions];
      updated[placingIndex] = { x, y };
      setGatePositions(updated);
      toast.success(`Port ${placingIndex + 1} plassert`);
    } else {
      // Placing an elevator
      const elevatorIndex = placingIndex - gates.length;
      const updated = [...elevatorPositions];
      updated[elevatorIndex] = { x, y };
      setElevatorPositions(updated);
      toast.success(`Heis ${elevatorIndex + 1} plassert`);
    }

    setPlacingIndex(null);
  };

  const handleFullscreenImageClick = (e: React.MouseEvent<HTMLImageElement>) => {
    if (placingIndex === null) return;

    const rect = e.currentTarget.getBoundingClientRect();
    const x = (e.clientX - rect.left) / rect.width;
    const y = (e.clientY - rect.top) / rect.height;

    // Check if we're placing a gate or elevator
    if (placingIndex < gates.length) {
      // Placing a gate
      const updated = [...gatePositions];
      updated[placingIndex] = { x, y };
      setGatePositions(updated);
      toast.success(`Port ${placingIndex + 1} plassert i fullskjermmodus`);
    } else {
      // Placing an elevator
      const elevatorIndex = placingIndex - gates.length;
      const updated = [...elevatorPositions];
      updated[elevatorIndex] = { x, y };
      setElevatorPositions(updated);
      toast.success(`Heis ${elevatorIndex + 1} plassert i fullskjermmodus`);
    }

    setPlacingIndex(null);
    setIsFullscreen(false);
  };

  const closeFullscreen = () => {
    setIsFullscreen(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Rediger prosjekt</DialogTitle>
          <DialogDescription>
            Oppdater prosjektdetaljer og arbeidstider
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <Tabs defaultValue="details" className="w-full">
            <TabsList className="grid w-full grid-cols-4">
              <TabsTrigger value="details">Detaljer</TabsTrigger>
              <TabsTrigger value="location">Lokasjon</TabsTrigger>
              <TabsTrigger value="resources">Porter & Heiser</TabsTrigger>
              <TabsTrigger value="hours">Arbeidstider</TabsTrigger>
            </TabsList>

            <TabsContent value="details" className="space-y-4">
              <div className="grid gap-2">
                <Label htmlFor="name">Prosjektnavn *</Label>
                <Input
                  id="name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                />
              </div>

              <div className="grid gap-2">
                <Label htmlFor="projectNumber">Prosjektnummer</Label>
                <Input
                  id="projectNumber"
                  value={projectNumber}
                  onChange={(e) => setProjectNumber(e.target.value)}
                  placeholder="f.eks. 2024-001"
                />
              </div>

              <div className="grid gap-2">
                <Label htmlFor="description">Beskrivelse</Label>
                <Textarea
                  id="description"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  rows={4}
                  placeholder="Kort beskrivelse av prosjektet..."
                />
              </div>
            </TabsContent>

            <TabsContent value="location" className="space-y-4">
              <PlacesAutocomplete
                value={address}
                onChange={setAddress}
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
                    value={latitude}
                    onChange={(e) => setLatitude(e.target.value)}
                    placeholder="59.9139"
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="longitude">Lengdegrad (Longitude)</Label>
                  <Input
                    id="longitude"
                    type="number"
                    step="any"
                    value={longitude}
                    onChange={(e) => setLongitude(e.target.value)}
                    placeholder="10.7522"
                  />
                </div>
              </div>

              {(latitude && longitude) && (
                <div className="mt-4">
                  {(() => {
                    const latNum = parseFloat(latitude);
                    const lngNum = parseFloat(longitude);
                    console.log("Rendering ProjectMap with:", { latNum, lngNum, address, name });
                    return (
                      <ProjectMap
                        key={`${latitude}-${longitude}-${Date.now()}`}
                        latitude={latNum}
                        longitude={lngNum}
                        address={address}
                        projectName={name}
                      />
                    );
                  })()}
                </div>
              )}
            </TabsContent>

            <TabsContent value="resources" className="space-y-6">
              {/* Gates Section */}
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <Label className="text-base font-semibold">Leveransepunkter (Porter)</Label>
                  <Button type="button" variant="outline" size="sm" onClick={addGate}>
                    Legg til port
                  </Button>
                </div>
                <div className="space-y-2">
                  {gates.map((gate, index) => (
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
                      {gates.length > 1 && (
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
              </div>

              {/* Divider */}
              <div className="border-t pt-4">
                <p className="text-sm text-muted-foreground mb-4">
                  Definer de ulike leveransepunktene på byggeplassen. Velg "Plasser" ved en port/heis og klikk på bildet nedenfor.
                </p>
              </div>

              {/* Elevators Section */}
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <Label className="text-base font-semibold">Heiser (Elevators)</Label>
                  <Button type="button" variant="outline" size="sm" onClick={addElevator}>
                    Legg til heis
                  </Button>
                </div>
                <div className="space-y-2">
                  {elevators.map((elevator, index) => (
                    <div key={index} className="flex items-center gap-2">
                      <Input
                        placeholder={`Heis ${index + 1}`}
                        value={elevator}
                        onChange={(e) => updateElevator(index, e.target.value)}
                      />
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => setPlacingIndex(gates.length + index)}
                      >
                        Plasser
                      </Button>
                      {elevatorPositions[index] && (
                        <span className="text-xs text-muted-foreground">
                          ({Math.round((elevatorPositions[index]!.x) * 100)}%, {Math.round((elevatorPositions[index]!.y) * 100)}%)
                        </span>
                      )}
                      {elevators.length > 1 && (
                        <Button
                          type="button"
                          variant="outline"
                          size="icon"
                          onClick={() => removeElevator(index)}
                          aria-label={`Fjern heis ${index + 1}`}
                        >
                          ×
                        </Button>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              {/* Image placement section */}
              <div className="space-y-2 pt-4 border-t">
                <Label htmlFor="site-image">Last opp nytt bilde/kart (valgfritt)</Label>
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

                      {/* Combined markers for both gates and elevators */}
                      {[...gatePositions, ...elevatorPositions].map((pos, idx) => {
                        const isElevator = idx >= gates.length;
                        const actualIndex = isElevator ? idx - gates.length : idx;
                        const markerNumber = isElevator ? actualIndex + 1 : actualIndex + 1;

                        return pos ? (
                          <div
                            key={`${isElevator ? 'elevator' : 'gate'}-${idx}`}
                            className={`absolute -translate-x-1/2 -translate-y-1/2 w-6 h-6 rounded-full flex items-center justify-center shadow ${
                              isElevator
                                ? 'bg-red-500 text-white border-2 border-white'
                                : 'bg-primary text-primary-foreground'
                            }`}
                            style={{ left: `${pos.x * 100}%`, top: `${pos.y * 100}%` }}
                            aria-label={`${isElevator ? 'Heis' : 'Port'} ${markerNumber} markør`}
                          >
                            {isElevator ? `H${markerNumber}` : markerNumber}
                          </div>
                        ) : null;
                      })}
                    </div>
                    <p className="text-sm text-muted-foreground text-center">
                      Trykk på bildet for forstørret visning
                    </p>
                  </div>
                )}
              </div>
            </TabsContent>

            <TabsContent value="hours" className="space-y-4">
              <div className="space-y-4">
                {DAYS.map((day) => (
                  <div key={day.key} className="border rounded-lg p-4">
                    <div className="flex items-center justify-between mb-3">
                      <Label className="text-base font-semibold">{day.label}</Label>
                      <div className="flex items-center gap-2">
                        <Label htmlFor={`${day.key}-enabled`} className="text-sm">
                          Aktiv
                        </Label>
                        <Switch
                          id={`${day.key}-enabled`}
                          checked={workingHours[day.key]?.enabled || false}
                          onCheckedChange={(checked) =>
                            updateWorkingHours(day.key, 'enabled', checked)
                          }
                        />
                      </div>
                    </div>

                    {workingHours[day.key]?.enabled && (
                      <div className="grid grid-cols-2 gap-4">
                        <div className="grid gap-2">
                          <Label htmlFor={`${day.key}-start`}>Start</Label>
                          <Input
                            id={`${day.key}-start`}
                            type="time"
                            value={workingHours[day.key]?.start || '07:00'}
                            onChange={(e) =>
                              updateWorkingHours(day.key, 'start', e.target.value)
                            }
                          />
                        </div>
                        <div className="grid gap-2">
                          <Label htmlFor={`${day.key}-end`}>Slutt</Label>
                          <Input
                            id={`${day.key}-end`}
                            type="time"
                            value={workingHours[day.key]?.end || '15:30'}
                            onChange={(e) =>
                              updateWorkingHours(day.key, 'end', e.target.value)
                            }
                          />
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </TabsContent>
          </Tabs>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Avbryt
            </Button>
            <Button type="submit" disabled={isLoading}>
              {isLoading ? "Lagrer..." : "Lagre endringer"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>

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

              {/* Combined markers for both gates and elevators in fullscreen */}
              {[...gatePositions, ...elevatorPositions].map((pos, idx) => {
                const isElevator = idx >= gates.length;
                const actualIndex = isElevator ? idx - gates.length : idx;
                const markerNumber = isElevator ? actualIndex + 1 : actualIndex + 1;

                return pos ? (
                  <div
                    key={`${isElevator ? 'elevator' : 'gate'}-${idx}`}
                    className={`absolute -translate-x-1/2 -translate-y-1/2 w-8 h-8 rounded-full flex items-center justify-center shadow-lg border-2 border-white ${
                      isElevator
                        ? 'bg-red-500 text-white'
                        : 'bg-primary text-primary-foreground'
                    }`}
                    style={{
                      left: `${pos.x * 100}%`,
                      top: `${pos.y * 100}%`,
                      fontSize: '12px',
                      fontWeight: 'bold'
                    }}
                    aria-label={`${isElevator ? 'Heis' : 'Port'} ${markerNumber} markør`}
                  >
                    {isElevator ? `H${markerNumber}` : markerNumber}
                  </div>
                ) : null;
              })}

              {/* Instructions overlay */}
              <div className="absolute top-4 left-4 bg-black bg-opacity-50 text-white p-3 rounded-lg">
                <p className="text-sm">
                  {placingIndex !== null
                    ? placingIndex < gates.length
                      ? `Klikk for å plassere Port ${placingIndex + 1}`
                      : `Klikk for å plassere Heis ${placingIndex - gates.length + 1}`
                    : "Klikk på bildet for å plassere porter og heiser"}
                </p>
              </div>
            </div>
          </div>
        </div>
      )}
    </Dialog>
  );
};