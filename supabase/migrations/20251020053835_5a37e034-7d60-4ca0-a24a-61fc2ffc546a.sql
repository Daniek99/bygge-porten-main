-- Add columns for project type/image and gate positions
ALTER TABLE public.projects ADD COLUMN IF NOT EXISTS project_type text;
ALTER TABLE public.projects ADD COLUMN IF NOT EXISTS site_image_url text;

ALTER TABLE public.gates ADD COLUMN IF NOT EXISTS position_x double precision;
ALTER TABLE public.gates ADD COLUMN IF NOT EXISTS position_y double precision;

-- Create a public storage bucket for project assets (images)
INSERT INTO storage.buckets (id, name, public) VALUES ('project-assets', 'project-assets', true)
ON CONFLICT (id) DO NOTHING;

-- Storage policies for the bucket
DO $$ BEGIN
  -- Public read
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'storage' AND tablename = 'objects' AND policyname = 'Public can view project assets'
  ) THEN
    CREATE POLICY "Public can view project assets"
    ON storage.objects
    FOR SELECT
    USING (bucket_id = 'project-assets');
  END IF;

  -- Authenticated users can upload/update/delete within their own folder (userId/...)
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'storage' AND tablename = 'objects' AND policyname = 'Users can upload own project assets'
  ) THEN
    CREATE POLICY "Users can upload own project assets"
    ON storage.objects
    FOR INSERT TO authenticated
    WITH CHECK (
      bucket_id = 'project-assets'
      AND auth.uid()::text = (storage.foldername(name))[1]
    );
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'storage' AND tablename = 'objects' AND policyname = 'Users can update own project assets'
  ) THEN
    CREATE POLICY "Users can update own project assets"
    ON storage.objects
    FOR UPDATE TO authenticated
    USING (
      bucket_id = 'project-assets'
      AND auth.uid()::text = (storage.foldername(name))[1]
    );
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'storage' AND tablename = 'objects' AND policyname = 'Users can delete own project assets'
  ) THEN
    CREATE POLICY "Users can delete own project assets"
    ON storage.objects
    FOR DELETE TO authenticated
    USING (
      bucket_id = 'project-assets'
      AND auth.uid()::text = (storage.foldername(name))[1]
    );
  END IF;
END $$;

-- Helper functions to avoid recursive RLS on project_members
CREATE OR REPLACE FUNCTION public.is_project_member(_project_id uuid, _user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.project_members
    WHERE project_id = _project_id AND user_id = _user_id
  );
$$;

CREATE OR REPLACE FUNCTION public.is_project_owner(_project_id uuid, _user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.project_members
    WHERE project_id = _project_id AND user_id = _user_id AND role = 'owner'
  );
$$;

-- Replace recursive policies on project_members
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='project_members' AND policyname='Project members can view members') THEN
    DROP POLICY "Project members can view members" ON public.project_members;
  END IF;
  CREATE POLICY "Project members can view members"
  ON public.project_members
  FOR SELECT
  TO authenticated
  USING (public.is_project_member(project_id, auth.uid()));

  IF EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='project_members' AND policyname='Project owners can manage members') THEN
    DROP POLICY "Project owners can manage members" ON public.project_members;
  END IF;
  CREATE POLICY "Project owners can manage members"
  ON public.project_members
  FOR ALL
  TO authenticated
  USING (public.is_project_owner(project_id, auth.uid()))
  WITH CHECK (public.is_project_owner(project_id, auth.uid()));
END $$;

-- Ensure triggers exist to auto-create profile and assign admin role to the specific email
DROP TRIGGER IF EXISTS on_auth_user_created_handle_profile ON auth.users;
CREATE TRIGGER on_auth_user_created_handle_profile
AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();

DROP TRIGGER IF EXISTS on_auth_user_created_assign_admin ON auth.users;
CREATE TRIGGER on_auth_user_created_assign_admin
AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE PROCEDURE public.assign_admin_role();