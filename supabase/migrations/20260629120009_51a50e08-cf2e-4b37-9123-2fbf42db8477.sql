-- Tighten EXECUTE on has_role
REVOKE EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO authenticated, service_role;

-- Make the existing account an admin
INSERT INTO public.user_roles (user_id, role)
VALUES ('841b2f12-5ea2-42c3-8064-514f758257b1', 'admin')
ON CONFLICT (user_id, role) DO NOTHING;