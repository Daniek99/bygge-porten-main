-- Fix the missing foreign key constraint between project_members and profiles
-- The constraint was missing, causing Supabase to not recognize the relationship

-- First, drop any existing constraints that might be causing issues
DO $$
BEGIN
    -- Check if constraint exists and drop it
    IF EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE constraint_name = 'project_members_user_id_fkey' 
        AND table_name = 'project_members'
        AND table_schema = 'public'
    ) THEN
        ALTER TABLE public.project_members DROP CONSTRAINT IF EXISTS project_members_user_id_fkey;
    END IF;
END $$;

-- Add the missing foreign key constraint
ALTER TABLE public.project_members 
ADD CONSTRAINT project_members_user_id_fkey 
FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE;

-- Update RLS policies to ensure proper access
DROP POLICY IF EXISTS "Project members can view members" ON public.project_members;
CREATE POLICY "Project members can view members" ON public.project_members
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.project_members pm
      WHERE pm.project_id = project_members.project_id
      AND pm.user_id = auth.uid()
    )
  );

-- Ensure the relationship is properly indexed for performance
CREATE INDEX IF NOT EXISTS idx_project_members_user_id ON public.project_members(user_id);
CREATE INDEX IF NOT EXISTS idx_project_members_project_id ON public.project_members(project_id);