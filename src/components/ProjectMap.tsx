import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Loader2 } from 'lucide-react';
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import './ProjectMap.css';

interface ProjectMapProps {
  address?: string | null;
  projectName: string;
}

const ProjectMap: React.FC<ProjectMapProps> = ({
  address,
  projectName,
}) => {
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [coordinates, setCoordinates] = useState<{ lat: number; lng: number } | null>(null);

  // Default coordinates for Hammersborg Torg 1, Oslo
  const defaultLat = 59.9139;
  const defaultLng = 10.7497;

  useEffect(() => {
    // Fix default marker icon
    delete (L.Icon.Default.prototype as any)._getIconUrl;
    L.Icon.Default.mergeOptions({
      iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
      iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
      shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
    });

    const geocodeAddress = async () => {
      if (!address) {
        setCoordinates({ lat: defaultLat, lng: defaultLng });
        setIsLoading(false);
        return;
      }

      try {
        const response = await fetch(
          `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(address)}&limit=1&countrycodes=no`
        );
        const data = await response.json();

        if (data && data.length > 0) {
          const place = data[0];
          const lat = parseFloat(place.lat);
          const lng = parseFloat(place.lon);
          setCoordinates({ lat, lng });
        } else {
          setCoordinates({ lat: defaultLat, lng: defaultLng });
        }
      } catch (error) {
        console.error('Error geocoding address:', error);
        setCoordinates({ lat: defaultLat, lng: defaultLng });
      } finally {
        setIsLoading(false);
      }
    };

    geocodeAddress();
  }, [address]);

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Prosjektlokasjon</CardTitle>
          <CardDescription>
            {address ? `Adresse: ${address}` : 'Laster kart...'}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="w-full h-64 rounded-md border flex items-center justify-center">
            <div className="flex items-center gap-2">
              <Loader2 className="h-6 w-6 animate-spin" />
              <span>Laster kart...</span>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Prosjektlokasjon</CardTitle>
          <CardDescription>Feil ved lasting av kart</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="w-full h-64 rounded-md border flex items-center justify-center text-muted-foreground">
            <div className="text-center">
              <p>Kunne ikke laste kart</p>
              <p className="text-sm mt-1">Sjekk internettforbindelsen eller prøv igjen senere</p>
              {address && <p className="mt-2 font-medium">Adresse: {address}</p>}
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Prosjektlokasjon</CardTitle>
        <CardDescription>
          {address ? `Adresse: ${address}` : 'Kart over prosjektlokasjon'}
        </CardDescription>
      </CardHeader>
      <CardContent>
        {coordinates && (
          <MapContainer
            center={[coordinates.lat, coordinates.lng]}
            zoom={16}
            style={{ height: '256px', width: '100%' }}
            className="rounded-md border"
          >
            <TileLayer
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
              attribution="&copy; <a href='https://www.openstreetmap.org/copyright'>OpenStreetMap</a> contributors"
            />
            <Marker position={[coordinates.lat, coordinates.lng]}>
              <Popup>{projectName}</Popup>
            </Marker>
          </MapContainer>
        )}
      </CardContent>
    </Card>
  );
};

export default ProjectMap;