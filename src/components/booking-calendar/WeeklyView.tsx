import { format, setHours, setMinutes, addWeeks, subWeeks } from "date-fns";
import { nb } from "date-fns/locale";

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
}

interface WeeklyViewProps {
  currentWeek: Date;
  weekDays: Date[];
  bookings: Booking[];
  elevatorBookings: ElevatorBooking[];
  onDateClick: (date: Date) => void;
  onBookingClick: (booking: Booking | ElevatorBooking, isElevator: boolean) => void;
  onNavigateWeek?: (week: Date) => void;
}

export const WeeklyView = ({
  currentWeek,
  weekDays,
  bookings,
  elevatorBookings,
  onDateClick,
  onBookingClick,
  onNavigateWeek,
}: WeeklyViewProps) => {
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

  const handlePreviousWeek = () => {
    const previousWeek = subWeeks(currentWeek, 1);
    onNavigateWeek?.(previousWeek);
  };

  const handleNextWeek = () => {
    const nextWeek = addWeeks(currentWeek, 1);
    onNavigateWeek?.(nextWeek);
  };

  return (
    <>
      <div className="grid grid-cols-8 gap-1 overflow-y-auto max-h-[600px]">
      {/* Header Row */}
      <div className="p-1 text-center text-xs font-medium bg-muted/30">Tid</div>
      {weekDays.map((date, index) => (
        <div key={index} className="p-1 text-center text-xs font-medium bg-muted/30">
          <div className="truncate">{format(date, 'EEE', { locale: nb })}</div>
          <div className="text-xs">{format(date, 'd')}</div>
        </div>
      ))}

      {/* Time Slots for Weekly View - Show 06:00-17:00, scrollable to 21:00 */}
      {Array.from({ length: 18 }, (_, hourIndex) => {
        const hour = hourIndex + 6;
        return (
          <div key={hourIndex} className="contents">
            <div className="p-1 text-center text-xs border-b bg-muted/50">
              {String(hour).padStart(2, '0')}:00
            </div>
            {weekDays.map((date, dayIndex) => {
              const slotStart = setHours(setMinutes(date, 0), hour);
              const slotEnd = setHours(setMinutes(date, 0), hour + 1);

              // Get bookings for this time slot across all resources
              const dayBookings = [
                ...bookings.filter(b => {
                  const bookingStart = new Date(b.start_time);
                  const bookingEnd = new Date(b.end_time);
                  return bookingStart < slotEnd && bookingEnd > slotStart;
                }),
                ...elevatorBookings.filter(b => {
                  const bookingStart = new Date(b.start_time);
                  const bookingEnd = new Date(b.end_time);
                  return bookingStart < slotEnd && bookingEnd > slotStart;
                })
              ];

              return (
                <div
                  key={`${dayIndex}-${hourIndex}`}
                  className="min-h-[60px] border-b border-r p-1 bg-background hover:bg-accent/20 cursor-pointer"
                  onClick={() => onDateClick(date)}
                >
                  {dayBookings.slice(0, 2).map((booking, bookingIndex) => (
                    <div
                      key={booking.id}
                      className={`mb-1 rounded text-xs p-1 cursor-pointer ${
                        'gate_id' in booking ? getStatusColor(booking as Booking) : 'bg-red-500/20 border-red-500'
                      }`}
                      onClick={(e) => {
                        e.stopPropagation();
                        if ('gate_id' in booking) {
                          onBookingClick(booking as Booking, false);
                        } else {
                          onBookingClick(booking as ElevatorBooking, true);
                        }
                      }}
                    >
                      <div className="font-semibold truncate text-xs leading-tight">{booking.supplier_name}</div>
                      <div className="truncate text-xs leading-tight">{booking.contact_name}</div>
                      {'gate_id' in booking && (booking as Booking).requires_approval && (
                        <div className="text-orange-700 font-medium text-xs">Godkj.</div>
                      )}
                    </div>
                  ))}
                  {dayBookings.length > 2 && (
                    <div className="text-xs text-muted-foreground">
                      +{dayBookings.length - 2} flere
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        );
      })}
      </div>

    </>
  );
};