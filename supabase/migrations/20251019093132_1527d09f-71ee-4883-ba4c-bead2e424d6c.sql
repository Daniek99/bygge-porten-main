-- Update RLS policy for project creation to only allow admin users
DROP POLICY IF EXISTS "Users can create projects" ON public.projects;

CREATE POLICY "Only admins can create projects" ON public.projects
  FOR INSERT
  WITH CHECK (
    public.is_admin(auth.uid()) AND auth.uid() = created_by
  );

-- Create policy to allow admins to view all projects
CREATE POLICY "Admins can view all projects" ON public.projects
  FOR SELECT
  USING (public.is_admin(auth.uid()));

-- Update profiles RLS to allow public viewing (needed for invitation emails)
CREATE POLICY "Project members can view related profiles" ON public.profiles
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.project_members pm1
      JOIN public.project_members pm2 ON pm1.project_id = pm2.project_id
      WHERE pm1.user_id = auth.uid()
      AND pm2.user_id = profiles.id
    )
  );