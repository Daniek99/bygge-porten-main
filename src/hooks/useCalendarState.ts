import { useState, useEffect, useMemo } from "react";
import { startOfWeek, addWeeks, subWeeks, getWeek, startOfDay, addMinutes } from "date-fns";

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

interface UseCalendarStateProps {
  selectedDate?: Date;
  onDateChange?: (date: Date) => void;
  selectedGate?: string | null;
  onGateChange?: (gateId: string | null) => void;
}

export const useCalendarState = ({
  selectedDate,
  onDateChange,
  selectedGate,
  onGateChange,
}: UseCalendarStateProps) => {
  const [internalSelectedDate, setInternalSelectedDate] = useState<Date>(selectedDate || new Date());
  const currentSelectedDate = selectedDate || internalSelectedDate;
  const [currentWeek, setCurrentWeek] = useState<Date>(startOfWeek(new Date(), { weekStartsOn: 1 }));
  const [gates, setGates] = useState<Gate[]>([]);
  const [elevators, setElevators] = useState<Elevator[]>([]);
  const [selectedElevator, setSelectedElevator] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<'gates' | 'elevators'>('gates');
  const [activeGateIds, setActiveGateIds] = useState<string[]>([]);
  const [activeElevatorIds, setActiveElevatorIds] = useState<string[]>([]);
  const [calendarView, setCalendarView] = useState<'daily' | 'weekly'>('daily');
  const [resourcePage, setResourcePage] = useState<number>(0);

  // Initialize active resource selection based on initial fetch results
  useEffect(() => {
    if (gates.length > 0 && activeGateIds.length === 0) {
      setActiveGateIds([gates[0].id]);
    }
    if (elevators.length > 0 && activeElevatorIds.length === 0) {
      setActiveElevatorIds([elevators[0].id]);
    }
  }, [gates, elevators]);

  // Ensure only one mode is active, and if resources exist, at least one is selected
  useEffect(() => {
    if (viewMode === 'gates' && activeGateIds.length === 0 && gates.length > 0) {
      setActiveGateIds([gates[0].id]);
    } else if (viewMode === 'elevators' && activeElevatorIds.length === 0 && elevators.length > 0) {
      setActiveElevatorIds([elevators[0].id]);
    }
  }, [gates.length, elevators.length, viewMode, activeGateIds.length, activeElevatorIds.length]);

  // Reset page when view mode changes
  useEffect(() => {
    setResourcePage(0);
  }, [viewMode]);

  const MAX_DISPLAY = 5;
  const isGateView = viewMode === 'gates';
  const currentResourcesList = isGateView ? gates : elevators;

  const displayResources = useMemo(() => {
    // Show all resources if <= 5, otherwise paginate
    if (currentResourcesList.length <= MAX_DISPLAY) {
      return currentResourcesList.map(r => ({ id: r.id, name: r.name, type: viewMode === 'gates' ? 'gate' : 'elevator' }));
    }

    if (resourcePage === 0) {
      return currentResourcesList.slice(0, MAX_DISPLAY).map(r => ({ id: r.id, name: r.name, type: viewMode === 'gates' ? 'gate' : 'elevator' }));
    } else {
      // Page 1 shows resources 6 onwards
      return currentResourcesList.slice(MAX_DISPLAY).map(r => ({ id: r.id, name: r.name, type: viewMode === 'gates' ? 'gate' : 'elevator' }));
    }
  }, [currentResourcesList, resourcePage, viewMode]);

  const navigateWeek = (direction: 'prev' | 'next') => {
    const newWeek = direction === 'next' ? addWeeks(currentWeek, 1) : subWeeks(currentWeek, 1);
    setCurrentWeek(newWeek);

    // Set selected date to the first day of the new week
    const newSelectedDate = newWeek;
    setInternalSelectedDate(newSelectedDate);
    onDateChange?.(newSelectedDate);
    setResourcePage(0); // Reset page on week navigation
  };

  const selectDay = (dayIndex: number) => {
    const selectedDate = new Date(currentWeek);
    selectedDate.setDate(currentWeek.getDate() + dayIndex);
    setInternalSelectedDate(selectedDate);
    onDateChange?.(selectedDate);
    setResourcePage(0); // Reset page on day selection
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

  const weekDays = getWeekDays();
  const weekNumber = getWeek(currentWeek);

  const handleGateToggle = (gateId: string) => {
    setViewMode('gates');
    setResourcePage(0);
    setActiveGateIds(prev => {
      const newIds = prev.includes(gateId)
        ? prev.filter(id => id !== gateId)
        : [...prev, gateId];

      // If no gates are selected, select the first one by default
      if (newIds.length === 0 && gates.length > 0) {
        return [gates[0].id];
      }
      return newIds;
    });
    onGateChange?.(null);
  };

  const handleElevatorToggle = (elevatorId: string) => {
    setViewMode('elevators');
    setResourcePage(0);
    setActiveElevatorIds(prev => {
      const newIds = prev.includes(elevatorId)
        ? prev.filter(id => id !== elevatorId)
        : [...prev, elevatorId];

      // If no elevators are selected, select the first one by default
      if (newIds.length === 0 && elevators.length > 0) {
        return [elevators[0].id];
      }
      return newIds;
    });
    onGateChange?.(null);
  };

  const handleResourceSelectionChange = (resourceId: string, isElevator: boolean) => {
    if (isElevator) {
      handleElevatorToggle(resourceId);
    } else {
      handleGateToggle(resourceId);
    }
  };

  const handleResourcePageChange = (page: number) => {
    if (currentResourcesList.length > MAX_DISPLAY) {
      setResourcePage(page);
    }
  };

  return {
    // State
    internalSelectedDate,
    currentSelectedDate,
    currentWeek,
    gates,
    elevators,
    selectedElevator,
    viewMode,
    activeGateIds,
    activeElevatorIds,
    calendarView,
    resourcePage,
    displayResources,
    weekDays,
    weekNumber,
    currentResourcesList,

    // Setters
    setInternalSelectedDate,
    setGates,
    setElevators,
    setSelectedElevator,
    setViewMode,
    setActiveGateIds,
    setActiveElevatorIds,
    setCalendarView,
    setResourcePage,

    // Handlers
    navigateWeek,
    selectDay,
    handleGateToggle,
    handleElevatorToggle,
    handleResourceSelectionChange,
    handleResourcePageChange,
  };
};