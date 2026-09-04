import { Button } from "@/components/ui/button";

interface PaginationControlsProps {
  currentResourcesList: Array<{ id: string; name: string }>;
  resourcePage: number;
  onPageChange: (page: number) => void;
  viewMode: 'gates' | 'elevators';
}

const MAX_DISPLAY = 5;

export const PaginationControls = ({
  currentResourcesList,
  resourcePage,
  onPageChange,
  viewMode,
}: PaginationControlsProps) => {
  if (currentResourcesList.length <= MAX_DISPLAY) {
    return null;
  }

  return (
    <div className="flex justify-center gap-2 mt-4">
      <Button
        variant={resourcePage === 0 ? "default" : "outline"}
        size="sm"
        onClick={() => onPageChange(0)}
      >
        {viewMode === 'gates' ? 'Porter 1-5' : 'Heiser 1-5'}
      </Button>
      <Button
        variant={resourcePage === 1 ? "default" : "outline"}
        size="sm"
        onClick={() => onPageChange(1)}
      >
        {viewMode === 'gates' ? `Porter ${MAX_DISPLAY + 1}-${currentResourcesList.length}` : `Heiser ${MAX_DISPLAY + 1}-${currentResourcesList.length}`}
      </Button>
    </div>
  );
};