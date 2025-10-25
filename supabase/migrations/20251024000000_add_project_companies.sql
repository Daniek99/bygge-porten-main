-- Create project_companies table to manage approved companies per project
CREATE TABLE project_companies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  company_name TEXT NOT NULL,
  organization_number TEXT UNIQUE,
  created_by UUID NOT NULL REFERENCES profiles(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(project_id, company_name)
);

-- Create index for better query performance
CREATE INDEX idx_project_companies_project_id ON project_companies(project_id);

-- Enable RLS
ALTER TABLE project_companies ENABLE ROW LEVEL SECURITY;

-- RLS policies for project_companies
CREATE POLICY "Project members can view project companies" ON project_companies
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM project_members
      WHERE project_members.project_id = project_companies.project_id
      AND project_members.user_id = auth.uid()
    )
  );

CREATE POLICY "Level 2 and owners can manage project companies" ON project_companies
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM project_members
      WHERE project_members.project_id = project_companies.project_id
      AND project_members.user_id = auth.uid()
      AND project_members.role IN ('owner', 'level2')
    )
  );

-- Update profiles table to make company required and fixed
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS company_locked BOOLEAN DEFAULT false;

-- Update invitation_codes to reference project_companies instead of storing company name
ALTER TABLE invitation_codes ADD COLUMN IF NOT EXISTS project_company_id UUID REFERENCES project_companies(id);

-- Create trigger to update updated_at
CREATE TRIGGER update_project_companies_updated_at
  BEFORE UPDATE ON project_companies
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Add comments
COMMENT ON TABLE project_companies IS 'Approved companies that can be assigned to users within a project';
COMMENT ON COLUMN project_companies.organization_number IS 'Organization number from Brønnøysundregisteret';
COMMENT ON COLUMN profiles.company_locked IS 'Whether the user company is locked and can only be changed by level 2+ users';