import { Button } from "@/components/ui/button";

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

interface ResourceSelectorProps {
  viewMode: 'gates' | 'elevators';
  gates: Gate[];
  elevators: Elevator[];
  activeGateIds: string[];
  activeElevatorIds: string[];
  onViewModeChange: (mode: 'gates' | 'elevators') => void;
  onGateToggle: (gateId: string) => void;
  onElevatorToggle: (elevatorId: string) => void;
}

export const ResourceSelector = ({
  viewMode,
  gates,
  elevators,
  activeGateIds,
  activeElevatorIds,
  onViewModeChange,
  onGateToggle,
  onElevatorToggle,
}: ResourceSelectorProps) => {
  const currentResources = viewMode === 'gates' ? gates : elevators;
  const activeResourceIds = viewMode === 'gates' ? activeGateIds : activeElevatorIds;

  return (
    <div className="space-y-3">
      {/* Resource Type Tabs */}
      <div className="flex gap-2 border-b pb-2">
        <Button
          variant={viewMode === 'gates' ? 'default' : 'outline'}
          onClick={() => onViewModeChange('gates')}
          disabled={gates.length === 0}
        >
          Porter ({gates.length})
        </Button>
        <Button
          variant={viewMode === 'elevators' ? 'default' : 'outline'}
          onClick={() => onViewModeChange('elevators')}
          disabled={elevators.length === 0}
        >
          Heiser ({elevators.length})
        </Button>
      </div>

      {/* Resource List */}
      {currentResources.length > 0 ? (
        <div>
          <h4 className="text-sm font-medium text-muted-foreground mb-2">
            {viewMode === 'gates' ? 'Tilgjengelige Porter:' : 'Tilgjengelige Heiser:'}
          </h4>
          <div className="flex gap-2 overflow-x-auto pb-2">
            {currentResources.map((resource) => {
              const isActive = activeResourceIds.includes(resource.id);
              const isElevator = 'capacity' in resource;

              return (
                <Button
                  key={resource.id}
                  variant={isActive ? "default" : "outline"}
                  size="sm"
                  onClick={() => {
                    if (viewMode === 'gates') {
                      onGateToggle(resource.id);
                    } else {
                      onElevatorToggle(resource.id);
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
          <p className="text-sm text-muted-foreground">
            Ingen {viewMode === 'gates' ? 'porter' : 'heiser'} er konfigurert for dette prosjektet ennå.
          </p>
        </div>
      )}
    </div>
  );
};