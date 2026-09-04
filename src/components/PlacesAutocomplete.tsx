import React, { useState } from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Search } from 'lucide-react';

interface PlacesAutocompleteProps {
  value: string;
  onChange: (value: string) => void;
  onPlaceSelect: (place: {
    address: string;
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
  const [isSearching, setIsSearching] = useState(false);

  const searchAddress = async () => {
    if (!value.trim()) return;

    setIsSearching(true);
    try {
      const response = await fetch(
        `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(value)}&limit=1&countrycodes=no`
      );
      const data = await response.json();

      if (data && data.length > 0) {
        const place = data[0];
        const address = place.display_name;
        const latitude = parseFloat(place.lat);
        const longitude = parseFloat(place.lon);

        onChange(address);
        onPlaceSelect({
          address,
        });
      }
    } catch (error) {
      console.error('Error searching address:', error);
    } finally {
      setIsSearching(false);
    }
  };

  return (
    <div className="grid gap-2">
      <Label htmlFor="address">{label}</Label>
      <div className="flex gap-2">
        <Input
          id="address"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
        />
        <Button
          type="button"
          variant="outline"
          size="icon"
          onClick={searchAddress}
          disabled={isSearching}
        >
          <Search className="h-4 w-4" />
        </Button>
      </div>
      <p className="text-xs text-muted-foreground">
        Søk etter adresse ved hjelp av OpenStreetMap
      </p>
    </div>
  );
};