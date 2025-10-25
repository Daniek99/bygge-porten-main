-- Allow project creators to insert initial membership (self as owner)
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='project_members' AND policyname='Project owners can manage members') THEN
    -- keep the owners ALL policy as-is
  END IF;
  
  -- Create dedicated INSERT policy for project creators (non-recursive)
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='project_members' AND policyname='Project creators can add themselves as owner'
  ) THEN
    CREATE POLICY "Project creators can add themselves as owner"
    ON public.project_members
    FOR INSERT
    TO authenticated
    WITH CHECK (
      EXISTS (
        SELECT 1 FROM public.projects p
        WHERE p.id = project_members.project_id
          AND p.created_by = auth.uid()
      )
    );
  END IF;
END $$;