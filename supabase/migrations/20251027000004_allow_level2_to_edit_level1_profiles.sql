-- Allow level 2 users to edit profiles of level 1 users within their projects
-- This enables level 2 coordinators to update contact information, names, and company details

-- Create new policy for level 2 users to edit level 1 profiles
CREATE POLICY "Level2 users can edit level1 profiles in their projects" ON public.profiles
  FOR UPDATE USING (
    -- Allow users to update their own profile (existing functionality)
    (id = auth.uid())
    OR
    -- Allow level2 users to update profiles of level1 users in their projects
    (
      EXISTS (
        SELECT 1 FROM public.project_members pm_level2
        WHERE pm_level2.project_id IN (
          SELECT pm_level1.project_id 
          FROM public.project_members pm_level1
          WHERE pm_level1.user_id = profiles.id
          AND pm_level1.role = 'level1'
        )
        AND pm_level2.user_id = auth.uid()
        AND pm_level2.role = 'level2'
      )
      AND EXISTS (
        SELECT 1 FROM public.project_members pm_level1
        WHERE pm_level1.user_id = profiles.id
        AND pm_level1.role = 'level1'
      )
    )
  );

-- Add comment for documentation
COMMENT ON POLICY "Level2 users can edit level1 profiles in their projects" ON public.profiles
IS 'Allows level 2 coordinators to update profile information (name, email, phone, company) of level 1 users within their projects';