import { useMemo } from "react";
import { startOfDay, addMinutes, addDays, subDays } from "date-fns";
import { isWithinWorkingHours } from "@/lib/calendarUtils";
import { SideNavigation } from "./SideNavigation";

interface Gate {
  id: string;
  name: string;
  description: string | null;
}

interface Elevator {
  id: string;
  name: string;
  description: string | null;
  capacity: number | null;
  floors_served: string | null;
}

interface Booking {
  id: string;
  gate_id: string;
  status: string;
  supplier_name: string;
  contact_name: string;
  contact_phone: string;
  contact_email: string | null;
  vehicle_type: string | null;
  notes: string | null;
  start_time: string;
  end_time: string;
  requires_approval: boolean;
  created_by: string;
  project_id: string;
  gates: Gate;
}

interface ElevatorBooking {
  id: string;
  elevator_id: string;
  status: string;
  supplier_name: string;
  contact_name: string;
  contact_phone: string;
  contact_email: string | null;
  floors: string | null;
  purpose: string | null;
  load_weight: number | null;
  start_time: string;
  end_time: string;
  requires_approval: boolean;
  created_by: string;
  project_id: string;
  elevators: Elevator;
}

interface DailyViewProps {
  currentSelectedDate: Date;
  displayResources: Array<{ id: string; name: string; type: 'gate' | 'elevator' }>;
  bookings: Booking[];
  elevatorBookings: ElevatorBooking[];
  dragStart: { time: Date; y: number; resourceId: string; isElevator: boolean } | null;
  dragEnd: { time: Date; y: number } | null;
  onMouseDown: (time: Date, e: React.MouseEvent, resourceId: string, isElevator: boolean) => void;
  onMouseMove: (time: Date, e: React.MouseEvent) => void;
  onMouseUp: () => void;
  onBookingClick: (booking: Booking | ElevatorBooking, isElevator: boolean) => void;
  onNavigateDay?: (date: Date) => void;
}

export const DailyView = ({
  currentSelectedDate,
  displayResources,
  bookings,
  elevatorBookings,
  dragStart,
  dragEnd,
  onMouseDown,
  onMouseMove,
  onMouseUp,
  onBookingClick,
  onNavigateDay,
}: DailyViewProps) => {
  const timeSlots = useMemo(() => {
    const slots = [];
    const start = startOfDay(currentSelectedDate);
    // Generate slots from 04:00 to 21:00 (18 hours = 72 slots of 15 minutes each)
    for (let i = 0; i < 18 * 4; i++) {
      slots.push(addMinutes(startOfDay(currentSelectedDate), i * 15 + 4 * 60)); // Start from 04:00
    }
    return slots;
  }, [currentSelectedDate]);

  const offsetMinutes = 4 * 60; // Minutes from 00:00 to 04:00

  const getBookingAtTime = (resourceId: string, time: Date, isElevator: boolean = false) => {
    if (isElevator) {
      return elevatorBookings.find((booking) => {
        if (booking.elevator_id !== resourceId) return false;
        const bookingStart = new Date(booking.start_time);
        const bookingEnd = new Date(booking.end_time);
        return time >= bookingStart && time < bookingEnd;
      });
    } else {
      return bookings.find((booking) => {
        if (booking.gate_id !== resourceId) return false;
        const bookingStart = new Date(booking.start_time);
        const bookingEnd = new Date(booking.end_time);
        return time >= bookingStart && time < bookingEnd;
      });
    }
  };

  const getStatusColor = (booking: Booking) => {
    if (booking.requires_approval) {
      return "bg-orange-500/20 border-orange-500";
    }
    switch (booking.status) {
      case "approved":
        return "bg-green-500/20 border-green-500";
      case "pending":
        return "bg-yellow-500/20 border-yellow-500";
      case "rejected":
        return "bg-red-500/20 border-red-500";
      default:
        return "bg-gray-500/20 border-gray-500";
    }
  };

  const handlePreviousDay = () => {
    const previousDay = subDays(currentSelectedDate, 1);
    onNavigateDay?.(previousDay);
  };

  const handleNextDay = () => {
    const nextDay = addDays(currentSelectedDate, 1);
    onNavigateDay?.(nextDay);
  };

  return (
    <div className="grid grid-cols-[120px_1fr_120px]">
      {/* Time Column */}
      <div className="border-r bg-muted/50">
        {Array.from({ length: 18 }, (_, i) => (
          <div key={i} className="h-12 border-b text-xs font-semibold text-foreground px-2 py-1 bg-background/80">
            {String(i + 4).padStart(2, '0')}:00
          </div>
        ))}
      </div>

      {/* Resource Columns Container */}
      <div
        className="relative"
        style={{
          display: 'grid',
          gridTemplateColumns: `repeat(${displayResources.length}, 1fr)`
        }}
        onMouseUp={onMouseUp}
      >
        {/* Resource Headers */}
        {displayResources.map((resource) => (
          <div
            key={resource.id}
            className="border-b border-r bg-muted/30 px-1 py-1 text-center text-xs font-medium"
          >
            <div className="truncate font-semibold">{resource.name}</div>
          </div>
        ))}

        {/* Time Slots and Bookings Grid */}
        {displayResources.map((resource, resourceIndex) => (
          <div key={resource.id} className="relative border-r" onMouseUp={onMouseUp}>
            {timeSlots.map((time, timeIndex) => {
              const booking = getBookingAtTime(resource.id, time, resource.type === 'elevator');
              const isWorkingHour = isWithinWorkingHours(time);
              const isDragging = dragStart && dragEnd;
              const isInSelection = isDragging && dragStart.resourceId === resource.id && dragStart.isElevator === (resource.type === 'elevator') &&
                time >= Math.min(dragStart.time.getTime(), dragEnd.time.getTime()) &&
                time < Math.max(dragStart.time.getTime(), dragEnd.time.getTime());

              return (
                <div
                  key={`${resource.id}-${timeIndex}`}
                  className={`h-3 border-b border-gray-200 cursor-pointer transition-colors ${
                    !isWorkingHour ? 'bg-gray-100/50' : 'hover:bg-accent/50'
                  } ${isInSelection ? 'bg-primary/20' : ''}`}
                  onMouseDown={(e) => onMouseDown(time, e, resource.id, resource.type === 'elevator')}
                  onMouseMove={(e) => onMouseMove(time, e)}
                />
              );
            })}

            {/* Render bookings for this resource */}
            {(resource.type === 'gate' ? bookings : elevatorBookings)
              .filter((b) => b[resource.type === 'gate' ? 'gate_id' : 'elevator_id'] === resource.id)
              .map((booking) => {
                const start = new Date(booking.start_time);
                const end = new Date(booking.end_time);
                const dayStart = startOfDay(currentSelectedDate);
                const minutesFromStart = (start.getTime() - dayStart.getTime()) / (1000 * 60);
                const durationMinutes = (end.getTime() - start.getTime()) / (1000 * 60);
                const top = ((minutesFromStart - offsetMinutes) / 15) * 12;
                const height = (durationMinutes / 15) * 12;

                return (
                  <div
                    key={booking.id}
                    className={`absolute left-1 right-1 rounded-md border-2 p-1 cursor-pointer ${
                      resource.type === 'gate' ? getStatusColor(booking as Booking) : 'bg-red-500/20 border-red-500'
                    }`}
                    style={{ top: `${top}px`, height: `${height}px` }}
                    onClick={() => onBookingClick(booking, resource.type === 'elevator')}
                  >
                    <div className="text-xs font-semibold truncate leading-tight">{booking.supplier_name}</div>
                    <div className="text-xs truncate leading-tight">{booking.contact_name}</div>
                    {resource.type === 'elevator' && (booking as ElevatorBooking).floors && (
                      <div className="text-xs truncate leading-tight">Etg: {(booking as ElevatorBooking).floors}</div>
                    )}
                    {resource.type === 'gate' && (booking as Booking).requires_approval && (
                      <div className="text-xs text-orange-700 font-medium leading-tight">Trenger godkjenning</div>
                    )}
                  </div>
                );
              })}
          </div>
        ))}
      </div>
    </div>
  );
};