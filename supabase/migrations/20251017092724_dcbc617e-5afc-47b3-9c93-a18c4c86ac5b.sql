-- Enable necessary extensions
CREATE EXTENSION IF NOT EXISTS btree_gist;

-- Create enum types
CREATE TYPE app_role AS ENUM ('owner', 'level2', 'level1');
CREATE TYPE booking_status AS ENUM ('pending', 'approved', 'rejected', 'rescheduled', 'cancelled', 'completed');

-- Profiles table
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT NOT NULL,
  company TEXT,
  phone TEXT,
  email TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Projects table
CREATE TABLE public.projects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  description TEXT,
  timezone TEXT NOT NULL DEFAULT 'Europe/Oslo',
  created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Project members (roles per project)
CREATE TABLE public.project_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID REFERENCES public.projects(id) ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  role app_role NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (project_id, user_id)
);

-- Gates (ports) per project
CREATE TABLE public.gates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID REFERENCES public.projects(id) ON DELETE CASCADE NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  display_order INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Bookings table
CREATE TABLE public.bookings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID REFERENCES public.projects(id) ON DELETE CASCADE NOT NULL,
  gate_id UUID REFERENCES public.gates(id) ON DELETE RESTRICT NOT NULL,
  created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  status booking_status NOT NULL DEFAULT 'pending',
  
  -- Supplier/delivery information
  supplier_name TEXT NOT NULL,
  contact_name TEXT NOT NULL,
  contact_email TEXT,
  contact_phone TEXT NOT NULL,
  vehicle_type TEXT,
  notes TEXT,
  
  -- Time range for booking
  start_time TIMESTAMPTZ NOT NULL,
  end_time TIMESTAMPTZ NOT NULL,
  
  -- Approval tracking
  approved_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  approved_at TIMESTAMPTZ,
  rejection_reason TEXT,
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  -- Constraint to ensure end_time is after start_time
  CONSTRAINT valid_time_range CHECK (end_time > start_time)
);

-- Create index for time-based queries
CREATE INDEX idx_bookings_times ON public.bookings(start_time, end_time);
CREATE INDEX idx_bookings_gate_times ON public.bookings(gate_id, start_time, end_time);

-- Prevent overlapping bookings on same gate
-- Using tstzrange for better overlap detection
ALTER TABLE public.bookings ADD COLUMN time_range TSTZRANGE 
  GENERATED ALWAYS AS (tstzrange(start_time, end_time, '[)')) STORED;

CREATE INDEX idx_bookings_time_range ON public.bookings USING GIST (gate_id, time_range);

ALTER TABLE public.bookings ADD CONSTRAINT no_overlap_per_gate
  EXCLUDE USING GIST (gate_id WITH =, time_range WITH &&)
  WHERE (status IN ('pending', 'approved', 'rescheduled'));

-- Notifications table
CREATE TABLE public.notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID REFERENCES public.projects(id) ON DELETE CASCADE,
  booking_id UUID REFERENCES public.bookings(id) ON DELETE CASCADE,
  recipient_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('booking_created', 'status_changed', 'booking_updated')),
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  read BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_notifications_recipient ON public.notifications(recipient_id, created_at DESC);

-- Audit logs table
CREATE TABLE public.audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID REFERENCES public.projects(id) ON DELETE SET NULL,
  booking_id UUID REFERENCES public.bookings(id) ON DELETE SET NULL,
  actor_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  action TEXT NOT NULL,
  old_data JSONB,
  new_data JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_audit_logs_project ON public.audit_logs(project_id, created_at DESC);
CREATE INDEX idx_audit_logs_booking ON public.audit_logs(booking_id, created_at DESC);

-- Enable RLS on all tables
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.project_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.gates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bookings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

-- RLS Policies

-- Profiles: users can read and update their own profile
CREATE POLICY "Users can view own profile" ON public.profiles
  FOR SELECT USING (auth.uid() = id);

CREATE POLICY "Users can update own profile" ON public.profiles
  FOR UPDATE USING (auth.uid() = id);

CREATE POLICY "Users can insert own profile" ON public.profiles
  FOR INSERT WITH CHECK (auth.uid() = id);

-- Projects: readable by members
CREATE POLICY "Project members can view projects" ON public.projects
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.project_members
      WHERE project_members.project_id = projects.id
      AND project_members.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can create projects" ON public.projects
  FOR INSERT WITH CHECK (auth.uid() = created_by);

CREATE POLICY "Project owners can update projects" ON public.projects
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM public.project_members
      WHERE project_members.project_id = projects.id
      AND project_members.user_id = auth.uid()
      AND project_members.role = 'owner'
    )
  );

-- Project members: readable by project members
CREATE POLICY "Project members can view members" ON public.project_members
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.project_members pm
      WHERE pm.project_id = project_members.project_id
      AND pm.user_id = auth.uid()
    )
  );

CREATE POLICY "Project owners can manage members" ON public.project_members
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.project_members pm
      WHERE pm.project_id = project_members.project_id
      AND pm.user_id = auth.uid()
      AND pm.role = 'owner'
    )
  );

-- Gates: readable by project members, manageable by owner/level2
CREATE POLICY "Project members can view gates" ON public.gates
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.project_members
      WHERE project_members.project_id = gates.project_id
      AND project_members.user_id = auth.uid()
    )
  );

CREATE POLICY "Owners and coordinators can manage gates" ON public.gates
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.project_members
      WHERE project_members.project_id = gates.project_id
      AND project_members.user_id = auth.uid()
      AND project_members.role IN ('owner', 'level2')
    )
  );

-- Bookings: project members can view, restricted updates
CREATE POLICY "Project members can view bookings" ON public.bookings
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.project_members
      WHERE project_members.project_id = bookings.project_id
      AND project_members.user_id = auth.uid()
    )
  );

CREATE POLICY "Project members can create bookings" ON public.bookings
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.project_members
      WHERE project_members.project_id = bookings.project_id
      AND project_members.user_id = auth.uid()
    )
    AND auth.uid() = created_by
  );

CREATE POLICY "Booking creators can update own pending bookings" ON public.bookings
  FOR UPDATE USING (
    auth.uid() = created_by 
    AND status = 'pending'
  );

CREATE POLICY "Coordinators and owners can update any booking" ON public.bookings
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM public.project_members
      WHERE project_members.project_id = bookings.project_id
      AND project_members.user_id = auth.uid()
      AND project_members.role IN ('owner', 'level2')
    )
  );

-- Notifications: users can view their own notifications
CREATE POLICY "Users can view own notifications" ON public.notifications
  FOR SELECT USING (auth.uid() = recipient_id);

CREATE POLICY "Users can update own notifications" ON public.notifications
  FOR UPDATE USING (auth.uid() = recipient_id);

-- Audit logs: readable by project coordinators and owners
CREATE POLICY "Coordinators and owners can view audit logs" ON public.audit_logs
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.project_members
      WHERE project_members.project_id = audit_logs.project_id
      AND project_members.user_id = auth.uid()
      AND project_members.role IN ('owner', 'level2')
    )
  );

-- Functions and Triggers

-- Function to create profile on user signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email)
  );
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

-- Apply updated_at trigger to relevant tables
CREATE TRIGGER update_profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_projects_updated_at
  BEFORE UPDATE ON public.projects
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_gates_updated_at
  BEFORE UPDATE ON public.gates
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_bookings_updated_at
  BEFORE UPDATE ON public.bookings
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Function to log booking changes
CREATE OR REPLACE FUNCTION public.log_booking_changes()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'UPDATE' THEN
    INSERT INTO public.audit_logs (project_id, booking_id, actor_id, action, old_data, new_data)
    VALUES (
      NEW.project_id,
      NEW.id,
      auth.uid(),
      'booking_updated',
      to_jsonb(OLD),
      to_jsonb(NEW)
    );
  ELSIF TG_OP = 'INSERT' THEN
    INSERT INTO public.audit_logs (project_id, booking_id, actor_id, action, new_data)
    VALUES (
      NEW.project_id,
      NEW.id,
      auth.uid(),
      'booking_created',
      to_jsonb(NEW)
    );
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER log_booking_changes_trigger
  AFTER INSERT OR UPDATE ON public.bookings
  FOR EACH ROW EXECUTE FUNCTION public.log_booking_changes();

-- Function to create notifications for level2 users on new booking
CREATE OR REPLACE FUNCTION public.notify_coordinators_on_booking()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  coordinator_record RECORD;
  creator_name TEXT;
BEGIN
  -- Only notify on new pending bookings
  IF TG_OP = 'INSERT' AND NEW.status = 'pending' THEN
    -- Get creator name
    SELECT full_name INTO creator_name
    FROM public.profiles
    WHERE id = NEW.created_by;

    -- Notify all level2 users and owners in the project
    FOR coordinator_record IN
      SELECT user_id
      FROM public.project_members
      WHERE project_id = NEW.project_id
      AND role IN ('owner', 'level2')
      AND user_id != NEW.created_by
    LOOP
      INSERT INTO public.notifications (
        project_id,
        booking_id,
        recipient_id,
        type,
        title,
        message
      ) VALUES (
        NEW.project_id,
        NEW.id,
        coordinator_record.user_id,
        'booking_created',
        'Ny leveransebooking',
        creator_name || ' har opprettet en ny booking som trenger godkjenning'
      );
    END LOOP;
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER notify_coordinators_trigger
  AFTER INSERT ON public.bookings
  FOR EACH ROW EXECUTE FUNCTION public.notify_coordinators_on_booking();

-- Function to notify booking creator on status change
CREATE OR REPLACE FUNCTION public.notify_creator_on_status_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  status_text TEXT;
BEGIN
  -- Only notify on status changes
  IF TG_OP = 'UPDATE' AND OLD.status != NEW.status THEN
    CASE NEW.status
      WHEN 'approved' THEN status_text := 'godkjent';
      WHEN 'rejected' THEN status_text := 'avvist';
      WHEN 'rescheduled' THEN status_text := 'endret';
      WHEN 'cancelled' THEN status_text := 'kansellert';
      WHEN 'completed' THEN status_text := 'fullført';
      ELSE status_text := 'oppdatert';
    END CASE;

    INSERT INTO public.notifications (
      project_id,
      booking_id,
      recipient_id,
      type,
      title,
      message
    ) VALUES (
      NEW.project_id,
      NEW.id,
      NEW.created_by,
      'status_changed',
      'Booking ' || status_text,
      'Din booking har blitt ' || status_text
    );
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER notify_creator_on_status_change_trigger
  AFTER UPDATE ON public.bookings
  FOR EACH ROW EXECUTE FUNCTION public.notify_creator_on_status_change();