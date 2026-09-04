-- Add level0 to the app_role enum type
ALTER TYPE app_role ADD VALUE 'level0';

-- Update the comment to reflect the new role
COMMENT ON TYPE app_role IS 'Application roles: owner, level2 (admin), level1 (UE), level0 (leverandør)';