-- Add project_number field to projects table
ALTER TABLE projects ADD COLUMN project_number TEXT;

-- Create index on project_number for better query performance
CREATE INDEX idx_projects_project_number ON projects(project_number);

-- Add comment to document the field
COMMENT ON COLUMN projects.project_number IS 'Project number for identification and reference purposes';