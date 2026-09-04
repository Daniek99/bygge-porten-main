import { startOfDay, addMinutes, setHours, setMinutes, isWithinInterval, getDay } from "date-fns";

export const generateTimeSlots = (date: Date) => {
  const slots = [];
  const start = startOfDay(date);
  // Generate slots from 04:00 to 21:00 (18 hours = 72 slots of 15 minutes each)
  for (let i = 0; i < 18 * 4; i++) {
    slots.push(addMinutes(startOfDay(date), i * 15 + 4 * 60)); // Start from 04:00
  }
  return slots;
};

export const getDayOfWeek = (date: Date) => {
  const days = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
  return days[date.getDay()];
};

export const getWorkingHoursForDate = (date: Date, workingHours?: Record<string, { start: string; end: string; enabled: boolean }>) => {
  if (!workingHours) {
    return { start: '07:00', end: '15:30', enabled: true };
  }
  const dayOfWeek = getDayOfWeek(date);
  return workingHours[dayOfWeek] || { start: '07:00', end: '15:30', enabled: true };
};

export const isWithinWorkingHours = (time: Date, workingHours?: Record<string, { start: string; end: string; enabled: boolean }>) => {
  const hours = getWorkingHoursForDate(time, workingHours);
  if (!hours.enabled) return false;

  const [startHour, startMin] = hours.start.split(':').map(Number);
  const [endHour, endMin] = hours.end.split(':').map(Number);

  const startTime = setMinutes(setHours(time, startHour), startMin);
  const endTime = setMinutes(setHours(time, endHour), endMin);

  return isWithinInterval(time, { start: startTime, end: endTime });
};

export const getBookingAtTime = (
  resourceId: string,
  time: Date,
  isElevator: boolean = false,
  bookings: any[],
  elevatorBookings: any[]
) => {
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

export const getStatusColor = (booking: any) => {
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