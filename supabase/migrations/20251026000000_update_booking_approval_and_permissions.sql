-- Update notification trigger for bookings to only notify if requires_approval
DROP TRIGGER IF EXISTS notify_coordinators_trigger ON public.bookings;
DROP FUNCTION IF EXISTS public.notify_coordinators_on_booking();

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
  -- Only notify on new pending bookings that require approval
  IF TG_OP = 'INSERT' AND NEW.status = 'pending' AND NEW.requires_approval = true THEN
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

-- Add similar trigger for elevator_bookings
CREATE OR REPLACE FUNCTION public.notify_coordinators_on_elevator_booking()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  coordinator_record RECORD;
  creator_name TEXT;
BEGIN
  -- Only notify on new pending bookings that require approval
  IF TG_OP = 'INSERT' AND NEW.status = 'pending' AND NEW.requires_approval = true THEN
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
        'Ny heisbooking',
        creator_name || ' har opprettet en ny heisbooking som trenger godkjenning'
      );
    END LOOP;
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER notify_coordinators_elevator_trigger
  AFTER INSERT ON public.elevator_bookings
  FOR EACH ROW EXECUTE FUNCTION public.notify_coordinators_on_elevator_booking();

-- Update UPDATE policies for bookings to allow creators to update any status
DROP POLICY IF EXISTS "Booking creators can update own pending bookings" ON public.bookings;
CREATE POLICY "Booking creators can update own bookings" ON public.bookings
  FOR UPDATE USING (
    auth.uid() = created_by
  );

-- Update UPDATE policies for elevator_bookings to allow creators to update any status
DROP POLICY IF EXISTS "Elevator booking creators can update own pending bookings" ON public.elevator_bookings;
CREATE POLICY "Elevator booking creators can update own bookings" ON public.elevator_bookings
  FOR UPDATE USING (
    auth.uid() = created_by
  );

-- Add DELETE policies for bookings
CREATE POLICY "Booking creators and level2 can delete bookings" ON public.bookings
  FOR DELETE USING (
    auth.uid() = created_by OR
    EXISTS (
      SELECT 1 FROM public.project_members
      WHERE project_members.project_id = bookings.project_id
      AND project_members.user_id = auth.uid()
      AND project_members.role IN ('owner', 'level2')
    )
  );

-- Add DELETE policies for elevator_bookings
CREATE POLICY "Elevator booking creators and level2 can delete elevator_bookings" ON public.elevator_bookings
  FOR DELETE USING (
    auth.uid() = created_by OR
    EXISTS (
      SELECT 1 FROM public.project_members
      WHERE project_members.project_id = elevator_bookings.project_id
      AND project_members.user_id = auth.uid()
      AND project_members.role IN ('owner', 'level2')
    )
  );

-- Add trigger for deletion notifications on bookings
CREATE OR REPLACE FUNCTION public.notify_creator_on_booking_delete()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  actor_name TEXT;
BEGIN
  -- Get actor name
  SELECT full_name INTO actor_name
  FROM public.profiles
  WHERE id = auth.uid();

  -- Notify the creator if deleted by someone else
  IF OLD.created_by != auth.uid() THEN
    INSERT INTO public.notifications (
      project_id,
      booking_id,
      recipient_id,
      type,
      title,
      message
    ) VALUES (
      OLD.project_id,
      OLD.id,
      OLD.created_by,
      'booking_updated',
      'Booking slettet',
      'Din booking har blitt slettet av ' || actor_name
    );
  END IF;

  RETURN OLD;
END;
$$;

CREATE TRIGGER notify_creator_on_booking_delete_trigger
  BEFORE DELETE ON public.bookings
  FOR EACH ROW EXECUTE FUNCTION public.notify_creator_on_booking_delete();

-- Add similar trigger for elevator_bookings
CREATE OR REPLACE FUNCTION public.notify_creator_on_elevator_booking_delete()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  actor_name TEXT;
BEGIN
  -- Get actor name
  SELECT full_name INTO actor_name
  FROM public.profiles
  WHERE id = auth.uid();

  -- Notify the creator if deleted by someone else
  IF OLD.created_by != auth.uid() THEN
    INSERT INTO public.notifications (
      project_id,
      booking_id,
      recipient_id,
      type,
      title,
      message
    ) VALUES (
      OLD.project_id,
      OLD.id,
      OLD.created_by,
      'booking_updated',
      'Heisbooking slettet',
      'Din heisbooking har blitt slettet av ' || actor_name
    );
  END IF;

  RETURN OLD;
END;
$$;

CREATE TRIGGER notify_creator_on_elevator_booking_delete_trigger
  BEFORE DELETE ON public.elevator_bookings
  FOR EACH ROW EXECUTE FUNCTION public.notify_creator_on_elevator_booking_delete();