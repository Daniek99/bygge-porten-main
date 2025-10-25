import React, { useRef, useEffect, useState } from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

interface PlacesAutocompleteProps {
  value: string;
  onChange: (value: string) => void;
  onPlaceSelect: (place: {
    address: string;
    latitude: number;
    longitude: number;
  }) => void;
  placeholder?: string;
  label?: string;
}

export const PlacesAutocomplete: React.FC<PlacesAutocompleteProps> = ({
  value,
  onChange,
  onPlaceSelect,
  placeholder = "Søk etter adresse...",
  label = "Adresse"
}) => {
  const inputRef = useRef<HTMLInputElement>(null);
  const [autocomplete, setAutocomplete] = useState<google.maps.places.Autocomplete | null>(null);
  const [isGoogleLoaded, setIsGoogleLoaded] = useState(false);

  useEffect(() => {
    // Load Google Maps API with Places library if not already loaded
    const loadGoogleMaps = async () => {
      console.log("Loading Google Maps API for Places Autocomplete");
      if (window.google && window.google.maps && window.google.maps.places) {
        console.log("Google Maps API already loaded");
        setIsGoogleLoaded(true);
        return;
      }

      try {
        // Check if script is already loading
        const existingScript = document.querySelector('script[src*="maps.googleapis.com"]');
        if (existingScript) {
          const checkGoogle = () => {
            if (window.google && window.google.maps && window.google.maps.places) {
              setIsGoogleLoaded(true);
            } else {
              setTimeout(checkGoogle, 100);
            }
          };
          checkGoogle();
          return;
        }

        // Load Google Maps API with Places library
        const apiKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY;
        console.log("Loading Google Maps API with key:", apiKey ? "API key present" : "No API key");
        const script = document.createElement('script');
        script.src = `https://maps.googleapis.com/maps/api/js?key=${apiKey}&libraries=places&loading=async`;
        script.async = true;
        script.defer = true;

        script.onload = () => {
          console.log("Google Maps API loaded for Places Autocomplete");
          setIsGoogleLoaded(true);
        };

        script.onerror = () => {
          console.error('Failed to load Google Maps API for Places Autocomplete');
          console.error('API Key:', apiKey ? 'Present' : 'Missing');
          console.error('Script src:', script.src);
        };

        document.head.appendChild(script);
      } catch (error) {
        console.error('Error loading Google Maps API:', error);
      }
    };

    loadGoogleMaps();
  }, []);

  useEffect(() => {
    if (inputRef.current && !autocomplete && isGoogleLoaded) {
      try {
        const newAutocomplete = new google.maps.places.Autocomplete(inputRef.current, {
          fields: ['formatted_address', 'geometry'],
          types: ['address'],
          componentRestrictions: { country: 'no' }, // Restrict to Norway
        });

        newAutocomplete.addListener('place_changed', () => {
          const place = newAutocomplete.getPlace();
          if (place.formatted_address && place.geometry?.location) {
            const address = place.formatted_address;
            const latitude = place.geometry.location.lat();
            const longitude = place.geometry.location.lng();

            onChange(address);
            onPlaceSelect({
              address,
              latitude,
              longitude,
            });
          }
        });

        setAutocomplete(newAutocomplete);
      } catch (error) {
        console.error('Error initializing Google Places Autocomplete:', error);
      }
    }

    return () => {
      if (autocomplete) {
        try {
          google.maps.event.clearInstanceListeners(autocomplete);
        } catch (error) {
          console.error('Error cleaning up autocomplete:', error);
        }
      }
    };
  }, [autocomplete, onChange, onPlaceSelect, isGoogleLoaded]);

  if (!isGoogleLoaded) {
    return (
      <div className="grid gap-2">
        <Label htmlFor="address">{label}</Label>
        <Input
          id="address"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="Søk etter adresse... (Google Maps laster)"
        />
        <p className="text-xs text-muted-foreground">
          Du kan skrive inn adressen manuelt mens Google Maps laster
        </p>
      </div>
    );
  }

  return (
    <div className="grid gap-2">
      <Label htmlFor="address">{label}</Label>
      <Input
        ref={inputRef}
        id="address"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
      />
    </div>
  );
};