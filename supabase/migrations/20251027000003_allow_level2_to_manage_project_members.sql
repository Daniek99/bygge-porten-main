-- Allow level 2 users and project owners to edit project member properties
-- Update the existing restrictive policy to include level2 users

-- Drop the existing policy that only allows owners
DROP POLICY IF EXISTS "Project owners can manage members" ON public.project_members;

-- Create new policy that includes both owners and level 2 users
CREATE POLICY "Project owners and level2 can manage members" ON public.project_members
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM public.project_members pm
      WHERE pm.project_id = project_members.project_id
      AND pm.user_id = auth.uid()
      AND pm.role IN ('owner', 'level2')
    )
  );

-- Also allow level2 users to delete project members (with restrictions)
CREATE POLICY "Project owners and level2 can delete members" ON public.project_members
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM public.project_members pm
      WHERE pm.project_id = project_members.project_id
      AND pm.user_id = auth.uid()
      AND pm.role IN ('owner', 'level2')
    )
    -- Prevent users from deleting themselves
    AND project_members.user_id != auth.uid()
    -- Prevent level2 users from deleting owners
    AND (
      EXISTS (
        SELECT 1 FROM public.project_members pm2
        WHERE pm2.project_id = project_members.project_id
        AND pm2.user_id = auth.uid()
        AND pm2.role = 'owner'
      )
      OR (
        EXISTS (
          SELECT 1 FROM public.project_members pm3
          WHERE pm3.project_id = project_members.project_id
          AND pm3.user_id = auth.uid()
          AND pm3.role = 'level2'
        )
        AND project_members.role NOT IN ('owner', 'level2')
      )
    )
  );

-- Add comment for documentation
COMMENT ON POLICY "Project owners and level2 can manage members" ON public.project_members
IS 'Allows both project owners and level 2 coordinators to update project member roles and properties';

COMMENT ON POLICY "Project owners and level2 can delete members" ON public.project_members
IS 'Allows both project owners and level 2 coordinators to delete project members with appropriate restrictions';