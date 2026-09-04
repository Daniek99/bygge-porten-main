import { format, addWeeks, subWeeks, getWeek } from "date-fns";
import { nb } from "date-fns/locale";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { CardHeader, CardTitle } from "@/components/ui/card";

interface CalendarHeaderProps {
  currentWeek: Date;
  onNavigateWeek: (direction: 'prev' | 'next') => void;
}

export const CalendarHeader = ({ currentWeek, onNavigateWeek }: CalendarHeaderProps) => {
  const weekNumber = getWeek(currentWeek);

  return (
    <CardHeader className="pb-3">
      <div className="flex items-center justify-between">
        <CardTitle className="text-lg">Velg dato</CardTitle>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => onNavigateWeek('prev')}
            className="h-8 w-8 p-0"
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <div className="text-sm font-medium min-w-[140px] text-center">
            {format(currentWeek, 'MMMM yyyy', { locale: nb })} - Uke {weekNumber}
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => onNavigateWeek('next')}
            className="h-8 w-8 p-0"
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </CardHeader>
  );
};