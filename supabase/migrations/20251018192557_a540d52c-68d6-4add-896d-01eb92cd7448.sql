-- Update admin user email
UPDATE public.user_roles
SET user_id = (
  SELECT id FROM auth.users WHERE email = 'daniel-ekman@hotmail.com'
)
WHERE user_id = (
  SELECT id FROM auth.users WHERE email = 'daniel-ekman@veidekke.no'
);

-- If the admin user doesn't exist yet, we'll handle it when they sign up
-- Add a function to automatically assign admin role to specific email
CREATE OR REPLACE FUNCTION public.assign_admin_role()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.email = 'daniel-ekman@hotmail.com' THEN
    INSERT INTO public.user_roles (user_id, role)
    VALUES (NEW.id, 'admin')
    ON CONFLICT (user_id, role) DO NOTHING;
  END IF;
  RETURN NEW;
END;
$$;

-- Create trigger to assign admin role on user creation
DROP TRIGGER IF EXISTS on_auth_user_created_assign_admin ON auth.users;
CREATE TRIGGER on_auth_user_created_assign_admin
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.assign_admin_role();