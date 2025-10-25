-- Add working hours configuration to projects table
ALTER TABLE public.projects
ADD COLUMN working_hours jsonb DEFAULT jsonb_build_object(
  'monday', jsonb_build_object('start', '07:00', 'end', '15:30', 'enabled', true),
  'tuesday', jsonb_build_object('start', '07:00', 'end', '15:30', 'enabled', true),
  'wednesday', jsonb_build_object('start', '07:00', 'end', '15:30', 'enabled', true),
  'thursday', jsonb_build_object('start', '07:00', 'end', '15:30', 'enabled', true),
  'friday', jsonb_build_object('start', '07:00', 'end', '13:30', 'enabled', true),
  'saturday', jsonb_build_object('start', '07:00', 'end', '15:30', 'enabled', false),
  'sunday', jsonb_build_object('start', '07:00', 'end', '15:30', 'enabled', false)
);

-- Add requires_approval flag for bookings outside working hours
ALTER TABLE public.bookings
ADD COLUMN requires_approval boolean DEFAULT false,
ADD COLUMN approval_requested_at timestamp with time zone;

-- Update RLS policy to allow level2 users to update projects
CREATE POLICY "Level2 users can update their projects"
ON public.projects
FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM public.project_members
    WHERE project_members.project_id = projects.id
    AND project_members.user_id = auth.uid()
    AND project_members.role IN ('owner', 'level2')
  )
);

-- Comment to clarify policy intent
COMMENT ON POLICY "Level2 users can update their projects" ON public.projects IS 
'Allows project owners and level2 coordinators to update project details including working hours';