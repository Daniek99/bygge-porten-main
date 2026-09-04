import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";

interface SideNavigationProps {
  onNavigatePrevious: () => void;
  onNavigateNext: () => void;
  previousLabel?: string;
  nextLabel?: string;
  disabled?: boolean;
}

export const SideNavigation = ({ 
  onNavigatePrevious, 
  onNavigateNext, 
  previousLabel = "Forrige",
  nextLabel = "Neste",
  disabled = false
}: SideNavigationProps) => {
  return (
    <div className="flex flex-col gap-2">
      <Button
        variant="outline"
        size="sm"
        onClick={onNavigatePrevious}
        disabled={disabled}
        className="h-8 w-8 p-0"
        title={previousLabel}
      >
        <ChevronLeft className="h-4 w-4" />
      </Button>
      <Button
        variant="outline"
        size="sm"
        onClick={onNavigateNext}
        disabled={disabled}
        className="h-8 w-8 p-0"
        title={nextLabel}
      >
        <ChevronRight className="h-4 w-4" />
      </Button>
    </div>
  );
};