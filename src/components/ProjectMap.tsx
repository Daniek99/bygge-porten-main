import React, { useRef, useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Loader2 } from 'lucide-react';

interface ProjectMapProps {
  latitude?: number | null;
  longitude?: number | null;
  address?: string | null;
  projectName: string;
}

declare global {
  interface Window {
    google: typeof google;
  }
}

const ProjectMap: React.FC<ProjectMapProps> = ({
  latitude,
  longitude,
  address,
  projectName,
}) => {
  const mapRef = useRef<HTMLDivElement>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [mapLoaded, setMapLoaded] = useState(false);

  useEffect(() => {
    let isMounted = true;
    let mapInitializationTimeout: NodeJS.Timeout;

    console.log("ProjectMap useEffect triggered with:", { latitude, longitude, address, projectName });

    // Load Google Maps API with proper callback
    const loadGoogleMaps = () => {
      return new Promise<void>((resolve, reject) => {
        // Check if Google Maps is already loaded
        if (window.google && window.google.maps && isMounted) {
          resolve();
          return;
        }

        // Check if script is already being loaded
        const existingScript = document.querySelector('script[src*="maps.googleapis.com"]');
        if (existingScript && isMounted) {
          // Wait for it to load
          const checkGoogle = () => {
            if (window.google && window.google.maps && isMounted) {
              resolve();
            } else if (isMounted) {
              setTimeout(checkGoogle, 100);
            }
          };
          checkGoogle();
          return;
        }

        // Create new script with callback
        const script = document.createElement('script');
        script.src = `https://maps.googleapis.com/maps/api/js?key=${import.meta.env.VITE_GOOGLE_MAPS_API_KEY}&loading=async`;
        script.async = true;
        script.defer = true;

        script.onload = () => {
          if (isMounted) resolve();
        };
        script.onerror = () => {
          if (isMounted) reject(new Error('Failed to load Google Maps API'));
        };

        if (isMounted) {
          document.head.appendChild(script);
        }
      });
    };

    const initMap = async () => {
      try {
        setIsLoading(true);
        setError(null);

        // Default coordinates for Hammersborg Torg 1, Oslo
        const defaultLat = 59.9139;
        const defaultLng = 10.7497;

        const lat = latitude || defaultLat;
        const lng = longitude || defaultLng;

        // Load Google Maps API with timeout
        const loadPromise = loadGoogleMaps();
        const timeoutPromise = new Promise((_, reject) =>
          setTimeout(() => reject(new Error('Google Maps API load timeout')), 10000)
        );

        await Promise.race([loadPromise, timeoutPromise]);

        // Wait a bit more to ensure maps API is fully ready
        await new Promise(resolve => setTimeout(resolve, 500));

        // Wait for DOM to be ready with retry mechanism
        const initializeMapWithRetry = (retryCount = 0) => {
          if (!mapRef.current) {
            if (retryCount < 10) {
              mapInitializationTimeout = setTimeout(() => initializeMapWithRetry(retryCount + 1), 200);
              return;
            } else {
              throw new Error('Map container not available after retries');
            }
          }

          try {
            // Initialize map
            const map = new window.google.maps.Map(mapRef.current, {
              center: { lat, lng },
              zoom: 16,
              mapTypeControl: false,
              streetViewControl: false,
              fullscreenControl: true,
              zoomControl: true,
            });

            // Add marker after a short delay to ensure map is fully ready
            setTimeout(() => {
              if (mapRef.current && window.google) {
                new window.google.maps.Marker({
                  position: { lat, lng },
                  map: map,
                  title: projectName,
                  animation: window.google.maps.Animation.DROP,
                });
              }
            }, 200);

            return map;
          } catch (mapError) {
            console.error('Error creating map:', mapError);
            throw mapError;
          }
        };

        await initializeMapWithRetry();

        setMapLoaded(true);
        setIsLoading(false);
      } catch (err) {
        console.error('Error initializing map:', err);
        setError(err instanceof Error ? err.message : 'Failed to load map');
        setIsLoading(false);
      }
    };

    // Small delay to ensure component is fully mounted
    const initTimeout = setTimeout(() => {
      if (isMounted) {
        initMap();
      }
    }, 100);

    return () => {
      isMounted = false;
      if (initTimeout) clearTimeout(initTimeout);
      if (mapInitializationTimeout) clearTimeout(mapInitializationTimeout);
    };
  }, [latitude, longitude, projectName]);

  if (isLoading || !mapLoaded) {
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
        <div ref={mapRef} className="w-full h-64 rounded-md border" />
      </CardContent>
    </Card>
  );
};

export default ProjectMap;