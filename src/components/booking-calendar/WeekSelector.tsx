import { format, isToday } from "date-fns";
import { nb } from "date-fns/locale";
import { Button } from "@/components/ui/button";

interface WeekSelectorProps {
  weekDays: Date[];
  currentSelectedDate: Date;
  onSelectDay: (dayIndex: number) => void;
}

const isSelectedDay = (date: Date, currentSelectedDate: Date) => {
  return date.toDateString() === currentSelectedDate.toDateString();
};

export const WeekSelector = ({ weekDays, currentSelectedDate, onSelectDay }: WeekSelectorProps) => {
  return (
    <div className="grid grid-cols-7 gap-1">
      {weekDays.map((date, index) => (
        <Button
          key={index}
          variant={isSelectedDay(date, currentSelectedDate) ? "default" : "outline"}
          size="sm"
          className={`h-16 flex flex-col items-center justify-center p-2 ${
            isToday(date) ? 'ring-2 ring-primary' : ''
          }`}
          onClick={() => onSelectDay(index)}
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
  );
};