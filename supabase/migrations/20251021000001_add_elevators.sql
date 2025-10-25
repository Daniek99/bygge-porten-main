-- Create elevators table similar to gates but for elevator management
CREATE TABLE elevators (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  display_order INTEGER,
  position_x DECIMAL,
  position_y DECIMAL,
  is_active BOOLEAN DEFAULT true,
  capacity INTEGER, -- Elevator capacity in persons/kg
  floors_served TEXT, -- Comma-separated list of floors served
  operating_hours JSONB, -- Operating hours similar to project working hours
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create index for better query performance
CREATE INDEX idx_elevators_project_id ON elevators(project_id);
CREATE INDEX idx_elevators_is_active ON elevators(is_active);
CREATE INDEX idx_elevators_display_order ON elevators(display_order);

-- Create elevator_bookings table for tracking elevator reservations
CREATE TABLE elevator_bookings (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  elevator_id UUID NOT NULL REFERENCES elevators(id) ON DELETE CASCADE,
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  supplier_name TEXT NOT NULL,
  contact_name TEXT NOT NULL,
  contact_phone TEXT NOT NULL,
  contact_email TEXT,
  start_time TIMESTAMP WITH TIME ZONE NOT NULL,
  end_time TIMESTAMP WITH TIME ZONE NOT NULL,
  floors TEXT, -- Specific floors being used
  purpose TEXT, -- Purpose of elevator use
  load_weight DECIMAL, -- Weight being transported
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected', 'cancelled', 'completed')),
  requires_approval BOOLEAN DEFAULT true,
  approved_by UUID REFERENCES profiles(id),
  approved_at TIMESTAMP WITH TIME ZONE,
  rejection_reason TEXT,
  created_by UUID NOT NULL REFERENCES profiles(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for elevator_bookings
CREATE INDEX idx_elevator_bookings_elevator_id ON elevator_bookings(elevator_id);
CREATE INDEX idx_elevator_bookings_project_id ON elevator_bookings(project_id);
CREATE INDEX idx_elevator_bookings_start_time ON elevator_bookings(start_time);
CREATE INDEX idx_elevator_bookings_status ON elevator_bookings(status);

-- Enable RLS (Row Level Security)
ALTER TABLE elevators ENABLE ROW LEVEL SECURITY;
ALTER TABLE elevator_bookings ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for elevators
CREATE POLICY "Elevators are viewable by project members" ON elevators
  FOR SELECT USING (
    is_project_member(project_id, auth.uid())
  );

CREATE POLICY "Elevators are manageable by project owners and level2" ON elevators
  FOR ALL USING (
    is_project_owner(project_id, auth.uid()) OR
    EXISTS (
      SELECT 1 FROM project_members
      WHERE project_id = elevators.project_id
      AND user_id = auth.uid()
      AND role IN ('owner', 'level2')
    )
  );

-- Create RLS policies for elevator_bookings
CREATE POLICY "Elevator bookings are viewable by project members" ON elevator_bookings
  FOR SELECT USING (
    is_project_member(project_id, auth.uid())
  );

CREATE POLICY "Elevator bookings are manageable by project owners and level2" ON elevator_bookings
  FOR ALL USING (
    is_project_owner(project_id, auth.uid()) OR
    EXISTS (
      SELECT 1 FROM project_members
      WHERE project_id = elevator_bookings.project_id
      AND user_id = auth.uid()
      AND role IN ('owner', 'level2')
    )
  );

-- Create trigger to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_elevators_updated_at
  BEFORE UPDATE ON elevators
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_elevator_bookings_updated_at
  BEFORE UPDATE ON elevator_bookings
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Add comments for documentation
COMMENT ON TABLE elevators IS 'Elevators available for booking at construction sites';
COMMENT ON TABLE elevator_bookings IS 'Bookings for elevator usage at construction sites';
COMMENT ON COLUMN elevators.capacity IS 'Maximum capacity in persons or kg';
COMMENT ON COLUMN elevators.floors_served IS 'Comma-separated list of floors served by this elevator';
COMMENT ON COLUMN elevators.operating_hours IS 'Operating hours for this specific elevator';