import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { format, startOfDay, addMinutes, setHours, setMinutes, parseISO, isWithinInterval, startOfWeek, endOfWeek, addWeeks, subWeeks, getWeek, getDay } from "date-fns";
import { nb } from "date-fns/locale";
import { ChevronLeft, ChevronRight, Plus } from "lucide-react";
import { BookingDialog } from "./BookingDialog";
import { BookingManagement } from "./BookingManagement";

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

interface WorkingHours {
  start: string;
  end: string;
  enabled: boolean;
}

interface BookingCalendarProps {
  projectId: string;
  userRole?: "owner" | "level2" | "level1" | "level0" | null;
  selectedDate?: Date;
  onDateChange?: (date: Date) => void;
  selectedGate?: string | null;
  onGateChange?: (gateId: string | null) => void;
}

export const BookingCalendar = ({ projectId, userRole, selectedDate, onDateChange, selectedGate, onGateChange }: BookingCalendarProps) => {
  const [internalSelectedDate, setInternalSelectedDate] = useState<Date>(selectedDate || new Date());
  const currentSelectedDate = selectedDate || internalSelectedDate;
  const [currentWeek, setCurrentWeek] = useState<Date>(startOfWeek(new Date(), { weekStartsOn: 1 })); // Start on Monday
  const [gates, setGates] = useState<Gate[]>([]);
  const [elevators, setElevators] = useState<Elevator[]>([]);
  const [selectedElevator, setSelectedElevator] = useState<string | null>(null);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [elevatorBookings, setElevatorBookings] = useState<ElevatorBooking[]>([]);
  const [workingHours, setWorkingHours] = useState<Record<string, WorkingHours>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [dragStart, setDragStart] = useState<{ time: Date; y: number } | null>(null);
  const [dragEnd, setDragEnd] = useState<{ time: Date; y: number } | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [selectedBooking, setSelectedBooking] = useState<Booking | null>(null);
  const [selectedElevatorBooking, setSelectedElevatorBooking] = useState<ElevatorBooking | null>(null);
  const [isManagementOpen, setIsManagementOpen] = useState(false);
  const [editBooking, setEditBooking] = useState<Booking | ElevatorBooking | null>(null);
  const [currentUser, setCurrentUser] = useState<string | null>(null);

  useEffect(() => {
    fetchGates();
    fetchElevators();
    fetchProjectWorkingHours();
    fetchCurrentUser();
  }, [projectId]);

  useEffect(() => {
    if (elevators.length > 0) {
      fetchElevatorBookings();
    }
  }, [elevators]);

  useEffect(() => {
    if (currentSelectedDate && projectId) {
      fetchBookings();
      fetchElevatorBookings();
    }
  }, [currentSelectedDate, projectId]);

  useEffect(() => {
    // Update currentWeek when selectedDate changes externally
    if (selectedDate) {
      const weekStart = startOfWeek(selectedDate, { weekStartsOn: 1 });
      setCurrentWeek(weekStart);
    }
  }, [selectedDate]);

  useEffect(() => {
    const channel = supabase
      .channel("bookings-changes")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "bookings",
          filter: `project_id=eq.${projectId}`,
        },
        () => {
          fetchBookings();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [projectId]);

  const fetchProjectWorkingHours = async () => {
    try {
      const { data, error } = await supabase
        .from("projects")
        .select("working_hours")
        .eq("id", projectId)
        .single();

      if (error) throw error;
      setWorkingHours((data?.working_hours as unknown as Record<string, WorkingHours>) || {});
    } catch (error) {
      console.error("Error fetching working hours:", error);
    }
  };

  const fetchCurrentUser = async () => {
    try {
      const { data: userData } = await supabase.auth.getUser();
      if (userData.user) {
        setCurrentUser(userData.user.id);
      }
    } catch (error) {
      console.error("Error fetching current user:", error);
    }
  };

  const fetchGates = async () => {
    try {
      const { data, error } = await supabase
        .from("gates")
        .select("*")
        .eq("project_id", projectId)
        .eq("is_active", true)
        .order("display_order");

      if (error) throw error;
      setGates(data || []);
    } catch (error: any) {
      console.error("Error fetching gates:", error);
      toast.error("Kunne ikke hente porter");
    }
  };

  const fetchElevators = async () => {
    try {
      const { data, error } = await supabase
        .from("elevators")
        .select("*")
        .eq("project_id", projectId)
        .eq("is_active", true)
        .order("display_order");

      if (error) {
        console.error("Error fetching elevators:", error);
        setElevators([]);
        return;
      }

      console.log("Elevators fetched:", data); // Debug log
      setElevators(data || []);
    } catch (error: any) {
      console.error("Error fetching elevators:", error);
      setElevators([]);
    }
  };

  const fetchElevatorBookings = async () => {
    if (!currentSelectedDate || !projectId || elevators.length === 0) {
      setElevatorBookings([]);
      return;
    }

    setIsLoading(true);
    try {
      const startOfSelectedDay = startOfDay(currentSelectedDate);
      const endOfSelectedDay = addMinutes(startOfSelectedDay, 24 * 60);

      const { data, error } = await supabase
        .from("elevator_bookings")
        .select(`
          *,
          elevators (
            id,
            name,
            description,
            capacity,
            floors_served
          )
        `)
        .eq("project_id", projectId)
        .gte("start_time", startOfSelectedDay.toISOString())
        .lt("start_time", endOfSelectedDay.toISOString())
        .order("start_time");

      if (error) throw error;
      setElevatorBookings(data || []);
    } catch (error: any) {
      console.error("Error fetching elevator bookings:", error);
      // Don't show error toast if no elevator_bookings table exists yet - this is normal
      if (error.code !== 'PGRST116') {
        toast.error("Kunne ikke hente heisbookinger");
      }
      setElevatorBookings([]);
    } finally {
      setIsLoading(false);
    }
  };

  const fetchBookings = async () => {
    if (!currentSelectedDate || !projectId) {
      return;
    }

    setIsLoading(true);
    try {
      const startOfSelectedDay = startOfDay(currentSelectedDate);
      const endOfSelectedDay = addMinutes(startOfSelectedDay, 24 * 60);

      const { data, error } = await supabase
        .from("bookings")
        .select(`
          *,
          gates (
            id,
            name,
            description
          )
        `)
        .eq("project_id", projectId)
        .gte("start_time", startOfSelectedDay.toISOString())
        .lt("start_time", endOfSelectedDay.toISOString())
        .order("start_time");

      if (error) throw error;
      setBookings(data || []);
    } catch (error: any) {
      console.error("Error fetching bookings:", error);
      toast.error("Kunne ikke hente bookinger");
    } finally {
      setIsLoading(false);
    }
  };

  const getDayOfWeek = (date: Date) => {
    const days = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
    return days[date.getDay()];
  };

  const getWorkingHoursForDate = (date: Date) => {
    const dayOfWeek = getDayOfWeek(currentSelectedDate);
    return workingHours[dayOfWeek] || { start: '07:00', end: '15:30', enabled: true };
  };

  const isWithinWorkingHours = (time: Date) => {
    const hours = getWorkingHoursForDate(time);
    if (!hours.enabled) return false;

    const [startHour, startMin] = hours.start.split(':').map(Number);
    const [endHour, endMin] = hours.end.split(':').map(Number);

    const startTime = setMinutes(setHours(time, startHour), startMin);
    const endTime = setMinutes(setHours(time, endHour), endMin);

    return isWithinInterval(time, { start: startTime, end: endTime });
  };

  const generateTimeSlots = () => {
    const slots = [];
    const start = startOfDay(currentSelectedDate);
    // Generate slots from 04:00 to 21:00 (18 hours = 72 slots of 15 minutes each)
    for (let i = 0; i < 18 * 4; i++) {
      slots.push(addMinutes(startOfDay(currentSelectedDate), i * 15 + 4 * 60)); // Start from 04:00
    }
    return slots;
  };

  const timeSlots = generateTimeSlots();
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

  const handleMouseDown = (time: Date, e: React.MouseEvent) => {
    const currentResource = selectedGate || selectedElevator;
    if (!currentResource) return;

    const isElevator = !!selectedElevator;
    const booking = getBookingAtTime(currentResource, time, isElevator);
    if (booking) {
      if (isElevator) {
        setSelectedElevatorBooking(booking as ElevatorBooking);
      } else {
        setSelectedBooking(booking as Booking);
      }
      setIsManagementOpen(true);
      return;
    }
    setDragStart({ time, y: e.clientY });
    setDragEnd({ time, y: e.clientY });
  };

  const handleMouseMove = (time: Date, e: React.MouseEvent) => {
    if (dragStart) {
      setDragEnd({ time, y: e.clientY });
    }
  };

  const handleNewBooking = () => {
    const now = new Date();
    const startTime = setMinutes(setHours(now, now.getHours() + 1), 0); // Next hour
    const endTime = addMinutes(startTime, 15); // 15 minutes later

    setDragStart({ time: startTime, y: 0 });
    setDragEnd({ time: endTime, y: 0 });
    setIsDialogOpen(true);
  };

  const handleEditBooking = (booking: Booking | ElevatorBooking) => {
    setEditBooking(booking);
    setIsDialogOpen(true);
  };

  const handleMouseUp = () => {
    const currentResource = selectedGate || selectedElevator;
    if (dragStart && dragEnd && currentResource) {
      let startTime = dragStart.time < dragEnd.time ? dragStart.time : dragEnd.time;
      let endTime = dragStart.time < dragEnd.time ? dragEnd.time : dragStart.time;

      // If it's a click (no drag), set default 15-minute slot
      if (startTime.getTime() === endTime.getTime()) {
        endTime = addMinutes(startTime, 15);
      }

      // Ensure minimum 15 minutes
      const duration = (endTime.getTime() - startTime.getTime()) / (1000 * 60);
      if (duration < 15) {
        toast.error("Minimum bookinglengde er 15 minutter");
        setDragStart(null);
        setDragEnd(null);
        return;
      }

      setIsDialogOpen(true);
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

  const navigateWeek = (direction: 'prev' | 'next') => {
    const newWeek = direction === 'next' ? addWeeks(currentWeek, 1) : subWeeks(currentWeek, 1);
    setCurrentWeek(newWeek);

    // Set selected date to the first day of the new week
    const newSelectedDate = newWeek;
    setInternalSelectedDate(newSelectedDate);
    onDateChange?.(newSelectedDate);
  };

  const selectDay = (dayIndex: number) => {
    const selectedDate = new Date(currentWeek);
    selectedDate.setDate(currentWeek.getDate() + dayIndex);
    setInternalSelectedDate(selectedDate);
    onDateChange?.(selectedDate);
  };

  const getWeekDays = () => {
    const days = [];
    for (let i = 0; i < 7; i++) {
      const date = new Date(currentWeek);
      date.setDate(currentWeek.getDate() + i);
      days.push(date);
    }
    return days;
  };

  const isToday = (date: Date) => {
    const today = new Date();
    return date.toDateString() === today.toDateString();
  };

  const isSelectedDay = (date: Date) => {
    return date.toDateString() === currentSelectedDate.toDateString();
  };

  const weekDays = getWeekDays();
  const weekNumber = getWeek(currentWeek);

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg">Velg dato</CardTitle>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => navigateWeek('prev')}
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
                onClick={() => navigateWeek('next')}
                className="h-8 w-8 p-0"
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-4">
          {isLoading ? (
            <div className="text-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
            </div>
          ) : (
            <div className="space-y-4">
              {/* Week Day Selection */}
              <div className="grid grid-cols-7 gap-1">
                {weekDays.map((date, index) => (
                  <Button
                    key={index}
                    variant={isSelectedDay(date) ? "default" : "outline"}
                    size="sm"
                    className={`h-16 flex flex-col items-center justify-center p-2 ${
                      isToday(date) ? 'ring-2 ring-primary' : ''
                    }`}
                    onClick={() => selectDay(index)}
                  >
                    <span className="text-xs font-medium">
                      {format(date, 'EEE', { locale: nb })}
                    </span>
                    <span className="text-sm font-bold">
                      {format(date, 'd')}
                    </span>
                  </Button>
                ))}
              </div>

              <div className="space-y-3">
                {/* Gates Section */}
                <div>
                  <h4 className="text-sm font-medium text-muted-foreground mb-2">Porter:</h4>
                  <div className="flex gap-2 overflow-x-auto pb-2">
                    {gates.map((gate) => (
                      <Button
                        key={gate.id}
                        variant={selectedGate === gate.id ? "default" : "outline"}
                        size="sm"
                        onClick={() => {
                          onGateChange && onGateChange(gate.id);
                          setSelectedElevator(null); // Clear elevator selection when selecting gate
                        }}
                      >
                        {gate.name}
                      </Button>
                    ))}
                  </div>
                </div>

                {/* New Booking Button */}
                <div className="flex justify-end">
                  <Button
                    variant="outline"
                    size="lg"
                    onClick={() => {
                      // Select first available gate or elevator and open dialog
                      if (gates.length > 0) {
                        onGateChange && onGateChange(gates[0].id);
                        handleNewBooking();
                      } else if (elevators.length > 0) {
                        onGateChange && onGateChange(elevators[0].id);
                        handleNewBooking();
                      } else {
                        toast.error("Ingen porter eller heiser tilgjengelig for booking");
                      }
                    }}
                    className="text-base px-6 py-3"
                  >
                    <Plus className="mr-2 h-5 w-5" />
                    Ny leveranse
                  </Button>
                </div>

                {/* Elevators Section */}
                {elevators.length > 0 ? (
                  <div>
                    <h4 className="text-sm font-medium text-muted-foreground mb-2">Heiser:</h4>
                    <div className="flex gap-2 overflow-x-auto pb-2">
                      {elevators.map((elevator) => (
                        <Button
                          key={elevator.id}
                          variant={selectedElevator === elevator.id ? "destructive" : "outline"}
                          size="sm"
                          className={selectedElevator === elevator.id
                            ? "bg-red-600 text-white hover:bg-red-700"
                            : "border-red-200 text-red-700 hover:bg-red-50"
                          }
                          onClick={() => {
                            setSelectedElevator(elevator.id);
                            onGateChange && onGateChange(null); // Clear gate selection when selecting elevator
                          }}
                        >
                          {elevator.name}
                        </Button>
                      ))}
                    </div>
                  </div>
                ) : (
                  <div>
                    <h4 className="text-sm font-medium text-muted-foreground mb-2">Heiser:</h4>
                    <div className="p-2 border rounded-md bg-muted/50">
                      <p className="text-sm text-muted-foreground">
                        Ingen heiser er konfigurert for dette prosjektet ennå.
                      </p>
                    </div>
                  </div>
                )}
              </div>

              {(selectedGate || selectedElevator) && (
                <div className="relative border rounded-lg overflow-hidden max-h-[900px] w-full">
                  <div className="grid grid-cols-[120px_1fr]">
                  <div className="border-r bg-muted/50">
                    {Array.from({ length: 18 }, (_, i) => (
                      <div key={i} className="h-12 border-b text-sm font-semibold text-foreground px-3 py-2 bg-background/80">
                        {String(i + 4).padStart(2, '0')}:00
                      </div>
                    ))}
                 </div>
                    <div
                      className="relative"
                      onMouseUp={handleMouseUp}
                    >
                      {timeSlots.map((time, i) => {
                        const currentResource = selectedGate || selectedElevator;
                        const isElevator = !!selectedElevator;
                        const booking = currentResource ? getBookingAtTime(currentResource, time, isElevator) : null;
                        const isWorkingHour = isWithinWorkingHours(time);
                        const isDragging = dragStart && dragEnd;
                        const isInSelection = isDragging &&
                          time >= Math.min(dragStart.time.getTime(), dragEnd.time.getTime()) &&
                          time < Math.max(dragStart.time.getTime(), dragEnd.time.getTime());

                        return (
                          <div
                            key={i}
                            className={`h-3 border-b border-gray-200 cursor-pointer transition-colors ${
                              !isWorkingHour ? 'bg-gray-100/50' : 'hover:bg-accent/50'
                            } ${isInSelection ? 'bg-primary/20' : ''}`}
                            onMouseDown={(e) => handleMouseDown(time, e)}
                            onMouseMove={(e) => handleMouseMove(time, e)}
                          />
                        );
                      })}

                      {selectedGate && bookings
                        .filter((b) => b.gate_id === selectedGate)
                        .map((booking) => {
                          const start = new Date(booking.start_time);
                          const end = new Date(booking.end_time);
                          const dayStart = startOfDay(currentSelectedDate);
                          const minutesFromStart = (start.getTime() - dayStart.getTime()) / (1000 * 60);
                          const durationMinutes = (end.getTime() - start.getTime()) / (1000 * 60);
                          const top = ((minutesFromStart - offsetMinutes) / 15) * 12; // 12px per 15min slot (shorter)
                          const height = (durationMinutes / 15) * 12;

                          return (
                            <div
                              key={booking.id}
                              className={`absolute left-1 right-1 rounded-md border-2 p-1 cursor-pointer ${getStatusColor(booking)}`}
                              style={{ top: `${top}px`, height: `${height}px` }}
                              onClick={() => {
                                setSelectedBooking(booking);
                                setIsManagementOpen(true);
                              }}
                            >
                              <div className="text-xs font-semibold truncate">{booking.supplier_name}</div>
                              <div className="text-xs truncate">{booking.contact_name}</div>
                              {booking.requires_approval && (
                                <div className="text-xs text-orange-700 font-medium">Trenger godkjenning</div>
                              )}
                            </div>
                          );
                        })}

                      {selectedElevator && elevatorBookings
                        .filter((b) => b.elevator_id === selectedElevator)
                        .map((booking) => {
                          const start = new Date(booking.start_time);
                          const end = new Date(booking.end_time);
                          const dayStart = startOfDay(currentSelectedDate);
                          const minutesFromStart = (start.getTime() - dayStart.getTime()) / (1000 * 60);
                          const durationMinutes = (end.getTime() - start.getTime()) / (1000 * 60);
                          const top = ((minutesFromStart - offsetMinutes) / 15) * 12; // 12px per 15min slot (shorter)
                          const height = (durationMinutes / 15) * 12;

                          return (
                            <div
                              key={booking.id}
                              className={`absolute left-1 right-1 rounded-md border-2 p-1 cursor-pointer bg-red-500/20 border-red-500`}
                              style={{ top: `${top}px`, height: `${height}px` }}
                              onClick={() => {
                                setSelectedElevatorBooking(booking);
                                setIsManagementOpen(true);
                              }}
                            >
                              <div className="text-xs font-semibold truncate">{booking.supplier_name}</div>
                              <div className="text-xs truncate">{booking.contact_name}</div>
                              {booking.floors && (
                                <div className="text-xs truncate">Etg: {booking.floors}</div>
                              )}
                            </div>
                          );
                        })}
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {(selectedGate || selectedElevator) && (dragStart && dragEnd || editBooking) && (
        <BookingDialog
          open={isDialogOpen}
          onOpenChange={(open) => {
            setIsDialogOpen(open);
            if (!open) {
              setDragStart(null);
              setDragEnd(null);
              setEditBooking(null);
            }
          }}
          projectId={projectId}
          gateId={selectedGate || selectedElevator || ''}
          startTime={editBooking ? new Date(editBooking.start_time) : (dragStart.time < dragEnd.time ? dragStart.time : dragEnd.time)}
          endTime={editBooking ? new Date(editBooking.end_time) : (dragStart.time < dragEnd.time ? dragEnd.time : dragStart.time)}
          workingHours={getWorkingHoursForDate(currentSelectedDate)}
          userRole={userRole}
          onSuccess={selectedElevator ? fetchElevatorBookings : fetchBookings}
          isElevator={!!selectedElevator}
          editBooking={editBooking}
        />
      )}

      {selectedBooking && (
        <BookingManagement
          booking={selectedBooking}
          open={isManagementOpen}
          onOpenChange={setIsManagementOpen}
          onSuccess={fetchBookings}
          canManage={userRole === "owner" || userRole === "level2"}
          canEdit={currentUser === selectedBooking.created_by}
          canDelete={currentUser === selectedBooking.created_by || userRole === "level2"}
          onEdit={() => handleEditBooking(selectedBooking)}
          currentUser={currentUser}
          userRole={userRole}
        />
      )}

      {selectedElevatorBooking && (
        <BookingManagement
          booking={selectedElevatorBooking}
          open={isManagementOpen}
          onOpenChange={setIsManagementOpen}
          onSuccess={fetchElevatorBookings}
          canManage={userRole === "owner" || userRole === "level2"}
          canEdit={currentUser === selectedElevatorBooking.created_by}
          canDelete={currentUser === selectedElevatorBooking.created_by || userRole === "level2"}
          onEdit={() => handleEditBooking(selectedElevatorBooking)}
          currentUser={currentUser}
          userRole={userRole}
        />
      )}
    </div>
  );
};