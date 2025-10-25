-- Update project permissions to allow level 2 users to update projects
-- Drop the existing restrictive policy
DROP POLICY IF EXISTS "Project owners can update projects" ON public.projects;

-- Create new policy that includes both owners and level 2 users
CREATE POLICY "Project owners and coordinators can update projects" ON public.projects
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM public.project_members
      WHERE project_members.project_id = projects.id
      AND project_members.user_id = auth.uid()
      AND project_members.role IN ('owner', 'level2')
    )
  );

-- Also update gates policy to be consistent (already includes level2)
-- Update elevators policy to be consistent (already includes level2)

-- Add comment for documentation
COMMENT ON POLICY "Project owners and coordinators can update projects" ON public.projects
IS 'Allows both project owners and level 2 coordinators to update project settings';