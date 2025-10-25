-- Add company field to invitation_codes table
ALTER TABLE public.invitation_codes
ADD COLUMN company text;

-- Add comment to clarify the purpose
COMMENT ON COLUMN public.invitation_codes.company IS 'Company name specified during invitation creation, validated against Brønnøysundregisteret';