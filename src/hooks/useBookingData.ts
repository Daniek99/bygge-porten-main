import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { startOfDay, addMinutes } from "date-fns";

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

interface UseBookingDataProps {
  projectId: string;
  currentSelectedDate: Date;
  calendarView: 'daily' | 'weekly';
}

export const useBookingData = ({ projectId, currentSelectedDate, calendarView }: UseBookingDataProps) => {
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [elevatorBookings, setElevatorBookings] = useState<ElevatorBooking[]>([]);
  const [workingHours, setWorkingHours] = useState<Record<string, WorkingHours>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [currentUser, setCurrentUser] = useState<string | null>(null);

  useEffect(() => {
    fetchProjectWorkingHours();
    fetchCurrentUser();
  }, [projectId]);

  useEffect(() => {
    fetchBookings();
    fetchElevatorBookings();
  }, [currentSelectedDate, projectId, calendarView]);

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

  const fetchBookings = async () => {
    if (!currentSelectedDate || !projectId) {
      return;
    }

    setIsLoading(true);
    try {
      let startOfSelectedDay, endOfSelectedDay;

      if (calendarView === 'weekly') {
        // For weekly view, get the entire week
        const weekStart = startOfDay(currentSelectedDate);
        const weekEnd = addMinutes(weekStart, 7 * 24 * 60); // 7 days
        startOfSelectedDay = weekStart;
        endOfSelectedDay = weekEnd;
      } else {
        // For daily view, get just the selected day
        startOfSelectedDay = startOfDay(currentSelectedDate);
        endOfSelectedDay = addMinutes(startOfSelectedDay, 24 * 60);
      }

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
      // Don't show error toast for now to avoid spam
      setBookings([]);
    } finally {
      setIsLoading(false);
    }
  };

  const fetchElevatorBookings = async () => {
    if (!currentSelectedDate || !projectId) {
      setElevatorBookings([]);
      return;
    }

    setIsLoading(true);
    try {
      let startOfSelectedDay, endOfSelectedDay;

      if (calendarView === 'weekly') {
        const weekStart = startOfDay(currentSelectedDate);
        const weekEnd = addMinutes(weekStart, 7 * 24 * 60);
        startOfSelectedDay = weekStart;
        endOfSelectedDay = weekEnd;
      } else {
        startOfSelectedDay = startOfDay(currentSelectedDate);
        endOfSelectedDay = addMinutes(startOfSelectedDay, 24 * 60);
      }

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
        // Could add toast here if needed
      }
      setElevatorBookings([]);
    } finally {
      setIsLoading(false);
    }
  };

  return {
    bookings,
    elevatorBookings,
    workingHours,
    isLoading,
    currentUser,
    refetchBookings: fetchBookings,
    refetchElevatorBookings: fetchElevatorBookings,
  };
};