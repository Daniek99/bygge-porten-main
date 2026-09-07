import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { BookingDialog } from "./BookingDialog";
import { BookingManagement } from "./BookingManagement";
import {
  CalendarHeader,
  ResourceSelector,
  WeekSelector,
  ViewControls,
  DailyView,
  WeeklyView,
  PaginationControls,
} from "./booking-calendar";
import { useCalendarState } from "@/hooks/useCalendarState";
import { useBookingData } from "@/hooks/useBookingData";
import { isWithinWorkingHours, getBookingAtTime, getWorkingHoursForDate } from "@/lib/calendarUtils";
import { setMinutes, setHours, addMinutes, addDays } from "date-fns";
import { toast } from "sonner";
import { Calendar, CalendarDays, Plus, ChevronLeft, ChevronRight } from "lucide-react";

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
  project?: {
    address?: string;
    number?: string;
  } | null;
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
  resourcesRefreshKey?: number;
  selectedDate?: Date;
  onDateChange?: (date: Date) => void;
  selectedGate?: string | null;
  onGateChange?: (gateId: string | null) => void;
}

export const BookingCalendar = ({ projectId, userRole, resourcesRefreshKey = 0, selectedDate, onDateChange, selectedGate, onGateChange }: BookingCalendarProps) => {
  // Use custom hooks for state management
  const calendarState = useCalendarState({ selectedDate, onDateChange, selectedGate, onGateChange });
  const bookingData = useBookingData({
    projectId,
    currentSelectedDate: calendarState.currentSelectedDate,
    calendarView: calendarState.calendarView
  });

  // Local state for UI interactions
  const [dragStart, setDragStart] = useState<{ time: Date; y: number; resourceId: string; isElevator: boolean } | null>(null);
  const [dragEnd, setDragEnd] = useState<{ time: Date; y: number } | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [selectedBooking, setSelectedBooking] = useState<Booking | null>(null);
  const [selectedElevatorBooking, setSelectedElevatorBooking] = useState<ElevatorBooking | null>(null);
  const [isManagementOpen, setIsManagementOpen] = useState(false);
  const [editBooking, setEditBooking] = useState<Booking | ElevatorBooking | null>(null);

  useEffect(() => {
    // Fetch initial data using the hooks
    const fetchInitialData = async () => {
      try {
        // Fetch gates
        const { data: gatesData, error: gatesError } = await supabase
          .from("gates")
          .select("*")
          .eq("project_id", projectId)
          .eq("is_active", true)
          .order("display_order");

        if (!gatesError) {
          calendarState.setGates(gatesData || []);
        }

        // Fetch elevators
        const { data: elevatorsData, error: elevatorsError } = await supabase
          .from("elevators")
          .select("*")
          .eq("project_id", projectId)
          .eq("is_active", true)
          .order("display_order");

        if (!elevatorsError) {
          calendarState.setElevators(elevatorsData || []);
        }
      } catch (error) {
        console.error("Error fetching initial data:", error);
      }
    };

    fetchInitialData();
  }, [projectId, resourcesRefreshKey]);

  // Data fetching is now handled by useBookingData hook

  // Utility functions are now in calendarUtils.ts

  // Booking lookup is now in calendarUtils.ts

  const handleMouseDown = (time: Date, e: React.MouseEvent, resourceId: string, isElevator: boolean) => {
    if (!resourceId) return;

    const booking = getBookingAtTime(resourceId, time, isElevator, bookingData.bookings, bookingData.elevatorBookings) as Booking | ElevatorBooking | undefined;
    if (booking) {
      if (isElevator) {
        setSelectedElevatorBooking(booking as ElevatorBooking);
      } else {
        setSelectedBooking(booking as Booking);
      }
      setIsManagementOpen(true);
      return;
    }
    setDragStart({ time, y: e.clientY, resourceId, isElevator });
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

    const resourceId = calendarState.displayResources.length > 0 ? calendarState.displayResources[0].id : null;
    const isElevator = calendarState.displayResources.length > 0 ? calendarState.displayResources[0].type === 'elevator' : false;

    if (!resourceId) {
        toast.error("Ingen ressurser synlige for ny booking");
        return;
    }

    setDragStart({ time: startTime, y: 0, resourceId, isElevator });
    setDragEnd({ time: endTime, y: 0 });
    setIsDialogOpen(true);
  };

  const handleEditBooking = (booking: Booking | ElevatorBooking) => {
    setEditBooking(booking);
    setIsDialogOpen(true);
  };

  const handleMouseUp = () => {
    if (dragStart && dragEnd) {
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

  // Event handlers using the hooks
  const handleNewBookingFromButton = () => {
    const resourceToSelect = calendarState.displayResources[0];
    if (!resourceToSelect) {
        toast.error("Ingen porter eller heiser tilgjengelig for booking");
        return;
    }

    // Ensure the resource is selected in the UI state if it wasn't already (e.g., if we switch view mode)
    if (resourceToSelect.type === 'gate' && !calendarState.activeGateIds.includes(resourceToSelect.id)) {
        calendarState.setViewMode('gates');
        calendarState.setActiveGateIds([resourceToSelect.id]);
        calendarState.setActiveElevatorIds([]);
        calendarState.setSelectedElevator(null);
    } else if (resourceToSelect.type === 'elevator' && !calendarState.activeElevatorIds.includes(resourceToSelect.id)) {
        calendarState.setViewMode('elevators');
        calendarState.setActiveElevatorIds([resourceToSelect.id]);
        calendarState.setActiveGateIds([]);
        onGateChange?.(null);
    }

    handleNewBooking();
  };

  const handleBookingManagementClick = (booking: Booking | ElevatorBooking, isElevator: boolean) => {
    if (isElevator) {
      setSelectedElevatorBooking(booking as ElevatorBooking);
    } else {
      setSelectedBooking(booking as Booking);
    }
    setIsManagementOpen(true);
  };

  return (
    <div className="space-y-4">
      <CalendarHeader
        currentWeek={calendarState.currentWeek}
        onNavigateWeek={calendarState.navigateWeek}
      />

      <Card>
        <CardContent className="p-4">
          {bookingData.isLoading ? (
            <div className="text-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
            </div>
          ) : (
            <div className="space-y-4">
              {/* Week Day Selection */}
              <WeekSelector
                weekDays={calendarState.weekDays}
                currentSelectedDate={calendarState.currentSelectedDate}
                onSelectDay={calendarState.selectDay}
              />

              <div className="space-y-4">
                {/* Top row with resource type tabs and view controls */}
                <div className="flex justify-between items-end">
                  {/* Left side: Porter & Heiser tabs */}
                  <div className="flex gap-2 border-b pb-2">
                    <Button
                      variant={calendarState.viewMode === 'gates' ? 'default' : 'outline'}
                      onClick={() => calendarState.setViewMode('gates')}
                      disabled={calendarState.gates.length === 0}
                    >
                      Porter ({calendarState.gates.length})
                    </Button>
                    <Button
                      variant={calendarState.viewMode === 'elevators' ? 'default' : 'outline'}
                      onClick={() => calendarState.setViewMode('elevators')}
                      disabled={calendarState.elevators.length === 0}
                    >
                      Heiser ({calendarState.elevators.length})
                    </Button>
                  </div>

                  {/* Right side: View controls */}
                  <div className="flex gap-2">
                    <Button
                      variant={calendarState.calendarView === 'daily' ? 'default' : 'outline'}
                      size="sm"
                      onClick={() => calendarState.setCalendarView('daily')}
                      className="flex items-center gap-2"
                    >
                      <Calendar className="h-4 w-4" />
                      Daglig
                    </Button>
                    <Button
                      variant={calendarState.calendarView === 'weekly' ? 'default' : 'outline'}
                      size="sm"
                      onClick={() => calendarState.setCalendarView('weekly')}
                      className="flex items-center gap-2"
                    >
                      <CalendarDays className="h-4 w-4" />
                      Ukentlig
                    </Button>
                  </div>
                </div>

                {/* Bottom row with resource buttons and new booking button */}
                <div className="flex justify-between items-center">
                  {/* Left side: Resource buttons */}
                  <div className="flex-1">
                    {calendarState.displayResources.length > 0 ? (
                      <div>
                        <h4 className="text-sm font-medium text-muted-foreground mb-2">
                          {calendarState.viewMode === 'gates' ? 'Tilgjengelige Porter:' : 'Tilgjengelige Heiser:'}
                        </h4>
                        <div className="flex gap-2 overflow-x-auto pb-2">
                          {calendarState.displayResources.map((resource) => {
                            const isActive = calendarState.viewMode === 'gates'
                              ? calendarState.activeGateIds.includes(resource.id)
                              : calendarState.activeElevatorIds.includes(resource.id);
                            const isElevator = resource.type === 'elevator';

                            return (
                              <Button
                                key={resource.id}
                                variant={isActive ? "default" : "outline"}
                                size="sm"
                                onClick={() => {
                                  if (calendarState.viewMode === 'gates') {
                                    calendarState.handleGateToggle(resource.id);
                                  } else {
                                    calendarState.handleElevatorToggle(resource.id);
                                  }
                                }}
                                className={isElevator ? 'border-red-200 text-red-700 hover:bg-red-50' : ''}
                              >
                                {resource.name}
                              </Button>
                            );
                          })}
                        </div>
                      </div>
                    ) : (
                      <div className="p-2 border rounded-md bg-muted/50">
                        <p className="text-xs text-muted-foreground leading-tight">
                          Ingen {calendarState.viewMode === 'gates' ? 'porter' : 'heiser'} er konfigurert for dette prosjektet ennå.
                        </p>
                      </div>
                    )}
                  </div>

                  {/* Right side: New booking button */}
                  <Button
                    variant="outline"
                    size="lg"
                    onClick={handleNewBookingFromButton}
                    className="text-base px-6 py-3 ml-4"
                  >
                    <Plus className="mr-2 h-5 w-5" />
                    Ny leveranse
                  </Button>
                </div>
              </div>

              {/* Calendar Grid */}
              {calendarState.displayResources.length > 0 && (
                <div className="relative border rounded-lg overflow-hidden max-h-[1400px] w-full">
                  {/* Side navigation buttons pinned to vertical midpoint on both sides */}
                  <div className="pointer-events-none">
                    {/* Left side button */}
                    <div className="absolute left-2 top-1/2 -translate-y-1/2 pointer-events-auto z-10">
                      <button
                        type="button"
                        className="inline-flex h-10 w-10 items-center justify-center rounded-full border bg-background hover:bg-accent transition"
                        onClick={() => {
                          const y = window.scrollY;
                          if (calendarState.calendarView === 'daily') {
                            const d = addDays(calendarState.currentSelectedDate, -1);
                            calendarState.setInternalSelectedDate(d);
                            onDateChange?.(d);
                          } else {
                            // weekly
                            calendarState.navigateWeek('prev');
                          }
                          requestAnimationFrame(() => { window.scrollTo({ top: y }); });
                        }}
                        aria-label="Forrige"
                        title="Forrige"
                      >
                        <ChevronLeft className="h-5 w-5" />
                      </button>
                    </div>
                    {/* Right side button */}
                    <div className="absolute right-2 top-1/2 -translate-y-1/2 pointer-events-auto z-10">
                      <button
                        type="button"
                        className="inline-flex h-10 w-10 items-center justify-center rounded-full border bg-background hover:bg-accent transition"
                        onClick={() => {
                          const y = window.scrollY;
                          if (calendarState.calendarView === 'daily') {
                            const d = addDays(calendarState.currentSelectedDate, 1);
                            calendarState.setInternalSelectedDate(d);
                            onDateChange?.(d);
                          } else {
                            // weekly
                            calendarState.navigateWeek('next');
                          }
                          requestAnimationFrame(() => { window.scrollTo({ top: y }); });
                        }}
                        aria-label="Neste"
                        title="Neste"
                      >
                        <ChevronRight className="h-5 w-5" />
                      </button>
                    </div>
                  </div>

                  {calendarState.calendarView === 'daily' ? (
                    <DailyView
                      currentSelectedDate={calendarState.currentSelectedDate}
                      displayResources={calendarState.displayResources as Array<{ id: string; name: string; type: 'gate' | 'elevator' }>}
                      bookings={bookingData.bookings}
                      elevatorBookings={bookingData.elevatorBookings}
                      dragStart={dragStart}
                      dragEnd={dragEnd}
                      onMouseDown={handleMouseDown}
                      onMouseMove={handleMouseMove}
                      onMouseUp={handleMouseUp}
                      onBookingClick={handleBookingManagementClick}
                      onNavigateDay={(date) => {
                        calendarState.setInternalSelectedDate(date);
                        onDateChange?.(date);
                      }}
                    />
                  ) : (
                    <WeeklyView
                      currentWeek={calendarState.currentWeek}
                      weekDays={calendarState.weekDays}
                      bookings={bookingData.bookings}
                      elevatorBookings={bookingData.elevatorBookings}
                      onDateClick={(date) => {
                        calendarState.setInternalSelectedDate(date);
                        onDateChange?.(date);
                        calendarState.setCalendarView('daily');
                      }}
                      onBookingClick={handleBookingManagementClick}
                      onNavigateWeek={(week) => {
                        calendarState.setInternalSelectedDate(week);
                        onDateChange?.(week);
                      }}
                    />
                  )}
                </div>
              )}

              {/* Pagination Controls */}
              <PaginationControls
                currentResourcesList={calendarState.currentResourcesList}
                resourcePage={calendarState.resourcePage}
                onPageChange={calendarState.handleResourcePageChange}
                viewMode={calendarState.viewMode}
              />
            </div>
          )}
        </CardContent>
      </Card>

      {/* Booking Dialog */}
      {(dragStart || editBooking) && (
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
          gateId={dragStart?.resourceId || selectedBooking?.gate_id || selectedElevatorBooking?.elevator_id || ''}
          startTime={editBooking ? new Date(editBooking.start_time) : (dragStart ? (dragStart.time < (dragEnd?.time || dragStart.time) ? dragStart.time : dragEnd?.time || dragStart.time) : new Date())}
          endTime={editBooking ? new Date(editBooking.end_time) : (dragStart ? (dragStart.time < (dragEnd?.time || dragStart.time) ? dragEnd?.time || dragStart.time : dragStart.time) : new Date())}
          workingHours={getWorkingHoursForDate(calendarState.currentSelectedDate, bookingData.workingHours)}
          userRole={userRole}
          onSuccess={calendarState.viewMode === 'gates' ? bookingData.refetchBookings : bookingData.refetchElevatorBookings}
          isElevator={dragStart ? dragStart.isElevator : calendarState.viewMode === 'gates' ? false : true}
          editBooking={editBooking}
        />
      )}

      {selectedBooking && (
        <BookingManagement
          booking={selectedBooking}
          open={isManagementOpen}
          onOpenChange={setIsManagementOpen}
          onSuccess={bookingData.refetchBookings}
          canManage={userRole === "owner" || userRole === "level2"}
          canEdit={bookingData.currentUser === selectedBooking.created_by}
          canDelete={bookingData.currentUser === selectedBooking.created_by || userRole === "level2"}
          onEdit={() => handleEditBooking(selectedBooking)}
          currentUser={bookingData.currentUser}
          userRole={userRole}
        />
      )}

      {selectedElevatorBooking && (
        <BookingManagement
          booking={selectedElevatorBooking}
          open={isManagementOpen}
          onOpenChange={setIsManagementOpen}
          onSuccess={bookingData.refetchElevatorBookings}
          canManage={userRole === "owner" || userRole === "level2"}
          canEdit={bookingData.currentUser === selectedElevatorBooking.created_by}
          canDelete={bookingData.currentUser === selectedElevatorBooking.created_by || userRole === "level2"}
          onEdit={() => handleEditBooking(selectedElevatorBooking)}
          currentUser={bookingData.currentUser}
          userRole={userRole}
        />
      )}
    </div>
  );
};