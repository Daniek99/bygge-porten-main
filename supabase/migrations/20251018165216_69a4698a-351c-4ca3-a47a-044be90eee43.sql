-- Create user_roles table for system-wide admin
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('admin')),
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id, role)
);

ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- Create security definer function to check admin status
CREATE OR REPLACE FUNCTION public.is_admin(_user_id UUID)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND role = 'admin'
  )
$$;

-- Create invitation_codes table
CREATE TABLE public.invitation_codes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  code TEXT NOT NULL UNIQUE,
  role app_role NOT NULL,
  created_by UUID NOT NULL REFERENCES public.profiles(id),
  expires_at TIMESTAMPTZ NOT NULL,
  used_by UUID REFERENCES public.profiles(id),
  used_at TIMESTAMPTZ,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.invitation_codes ENABLE ROW LEVEL SECURITY;

-- RLS policies for user_roles
CREATE POLICY "Admin users can view all roles"
ON public.user_roles FOR SELECT
TO authenticated
USING (public.is_admin(auth.uid()));

CREATE POLICY "Admin users can manage roles"
ON public.user_roles FOR ALL
TO authenticated
USING (public.is_admin(auth.uid()));

-- RLS policies for invitation_codes
CREATE POLICY "Level2 and owners can create invitations"
ON public.invitation_codes FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.project_members
    WHERE project_id = invitation_codes.project_id
      AND user_id = auth.uid()
      AND role IN ('owner', 'level2')
  ) AND created_by = auth.uid()
);

CREATE POLICY "Level2 and owners can view project invitations"
ON public.invitation_codes FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.project_members
    WHERE project_id = invitation_codes.project_id
      AND user_id = auth.uid()
      AND role IN ('owner', 'level2')
  )
);

CREATE POLICY "Level2 and owners can update project invitations"
ON public.invitation_codes FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.project_members
    WHERE project_id = invitation_codes.project_id
      AND user_id = auth.uid()
      AND role IN ('owner', 'level2')
  )
);

CREATE POLICY "Anyone can view active invitation codes for registration"
ON public.invitation_codes FOR SELECT
TO anon
USING (is_active = true AND expires_at > now() AND used_by IS NULL);

-- Insert admin user role for daniel-ekman@veidekke.no
INSERT INTO public.user_roles (user_id, role)
SELECT id, 'admin'
FROM auth.users
WHERE email = 'daniel-ekman@veidekke.no'
ON CONFLICT (user_id, role) DO NOTHING;

-- Function to validate invitation code and create project membership
CREATE OR REPLACE FUNCTION public.use_invitation_code(
  _code TEXT,
  _user_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _invitation invitation_codes%ROWTYPE;
  _result JSONB;
BEGIN
  -- Find valid invitation
  SELECT * INTO _invitation
  FROM public.invitation_codes
  WHERE code = _code
    AND is_active = true
    AND expires_at > now()
    AND used_by IS NULL;
  
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Ugyldig eller utløpt invitasjonskode');
  END IF;
  
  -- Mark invitation as used
  UPDATE public.invitation_codes
  SET used_by = _user_id,
      used_at = now(),
      is_active = false
  WHERE id = _invitation.id;
  
  -- Create project membership
  INSERT INTO public.project_members (project_id, user_id, role)
  VALUES (_invitation.project_id, _user_id, _invitation.role)
  ON CONFLICT (project_id, user_id) DO NOTHING;

  -- Update user profile with company if provided
  IF _invitation.company IS NOT NULL THEN
    UPDATE public.profiles
    SET company = _invitation.company
    WHERE id = _user_id;
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'project_id', _invitation.project_id,
    'role', _invitation.role,
    'company', _invitation.company
  );
END;
$$;