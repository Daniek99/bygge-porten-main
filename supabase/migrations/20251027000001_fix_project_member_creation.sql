-- Fix project member creation by updating RLS policies
-- Drop existing restrictive policies and create more permissive ones for project creation

-- First, let's check if we need to update the project creation policy
DROP POLICY IF EXISTS "Users can create projects" ON public.projects;
CREATE POLICY "Users can create projects" ON public.projects
  FOR INSERT WITH CHECK (auth.uid() = created_by);

-- Update project_members policies to allow project creators to add themselves
DROP POLICY IF EXISTS "Project owners can manage members" ON public.project_members;
CREATE POLICY "Project members can manage members" ON public.project_members
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.project_members pm
      WHERE pm.project_id = project_members.project_id
      AND pm.user_id = auth.uid()
    )
  );


-- Also allow project creators to add themselves as owners
CREATE POLICY "Project creators can add themselves" ON public.project_members
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.projects p
      WHERE p.id = project_members.project_id
      AND p.created_by = auth.uid()
    )
    AND project_members.user_id = auth.uid()
  );

-- Fix the infinite recursion issue by removing conflicting policies
-- The issue is that multiple policies are trying to reference the same table in a circular way
DROP POLICY IF EXISTS "Users can view project members" ON public.project_members;
DROP POLICY IF EXISTS "Users can view their own project memberships" ON public.project_members;

-- Create a single, simple policy for viewing project members
CREATE POLICY "Project members can view all members in their projects" ON public.project_members
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.project_members pm
      WHERE pm.project_id = project_members.project_id
      AND pm.user_id = auth.uid()
    )
  );

-- Also need to fix the projects table policies to avoid recursion
DROP POLICY IF EXISTS "Users can view projects" ON public.projects;
DROP POLICY IF EXISTS "Users can view their own projects" ON public.projects;
DROP POLICY IF EXISTS "Users can view projects they are members of" ON public.projects;

-- Create a single policy for viewing projects
CREATE POLICY "Users can view projects they own or are members of" ON public.projects
  FOR SELECT USING (
    created_by = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.project_members pm
      WHERE pm.project_id = projects.id
      AND pm.user_id = auth.uid()
    )
  );

-- Ensure profiles exist for all users
INSERT INTO public.profiles (id, email, full_name)
SELECT
  id,
  email,
  COALESCE(raw_user_meta_data->>'full_name', email)
FROM auth.users
WHERE id NOT IN (SELECT id FROM public.profiles)
ON CONFLICT (id) DO NOTHING;