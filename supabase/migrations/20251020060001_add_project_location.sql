-- Add location fields and project number to projects table
ALTER TABLE public.projects ADD COLUMN IF NOT EXISTS latitude double precision;
ALTER TABLE public.projects ADD COLUMN IF NOT EXISTS longitude double precision;
ALTER TABLE public.projects ADD COLUMN IF NOT EXISTS address text;
ALTER TABLE public.projects ADD COLUMN IF NOT EXISTS project_number text;