import { Calendar, CalendarDays, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";

interface ViewControlsProps {
  calendarView: 'daily' | 'weekly';
  onViewChange: (view: 'daily' | 'weekly') => void;
  onNewBooking: () => void;
}

export const ViewControls = ({ calendarView, onViewChange, onNewBooking }: ViewControlsProps) => {
  return (
    <div className="flex justify-between items-center">
      <div className="flex gap-2">
        <Button
          variant={calendarView === 'daily' ? 'default' : 'outline'}
          size="sm"
          onClick={() => onViewChange('daily')}
          className="flex items-center gap-2"
        >
          <Calendar className="h-4 w-4" />
          Daglig
        </Button>
        <Button
          variant={calendarView === 'weekly' ? 'default' : 'outline'}
          size="sm"
          onClick={() => onViewChange('weekly')}
          className="flex items-center gap-2"
        >
          <CalendarDays className="h-4 w-4" />
          Ukentlig
        </Button>
      </div>
      <Button
        variant="outline"
        size="lg"
        onClick={onNewBooking}
        className="text-base px-6 py-3"
      >
        <Plus className="mr-2 h-5 w-5" />
        Ny leveranse
      </Button>
    </div>
  );
};