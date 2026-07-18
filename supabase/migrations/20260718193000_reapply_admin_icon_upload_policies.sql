-- Re-apply icon upload permissions in an idempotent migration.
-- This matters when older upload migrations were already marked as applied
-- before the admin-gated policy fix was added to the repository.

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'app_role' AND typnamespace = 'public'::regnamespace) THEN
    CREATE TYPE public.app_role AS ENUM ('admin', 'user');
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS public.user_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.app_role NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);

GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;

ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND role = _role
  )
$$;

REVOKE EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO authenticated, service_role;

DROP POLICY IF EXISTS "users_read_own_roles" ON public.user_roles;
CREATE POLICY "users_read_own_roles" ON public.user_roles
  FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));

-- Remove every historical write policy name used for the game-icons bucket.
DROP POLICY IF EXISTS "Authenticated can upload game-icons" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated can update game-icons" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated can delete game-icons" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can upload to game-icons" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can update game-icons" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can delete from game-icons" ON storage.objects;
DROP POLICY IF EXISTS "Admins can upload game-icons" ON storage.objects;
DROP POLICY IF EXISTS "Admins can update game-icons" ON storage.objects;
DROP POLICY IF EXISTS "Admins can delete game-icons" ON storage.objects;

CREATE POLICY "Admins can upload game-icons" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'game-icons' AND public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can update game-icons" ON storage.objects
  FOR UPDATE TO authenticated
  USING (bucket_id = 'game-icons' AND public.has_role(auth.uid(), 'admin'))
  WITH CHECK (bucket_id = 'game-icons' AND public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can delete game-icons" ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'game-icons' AND public.has_role(auth.uid(), 'admin'));

-- Keep the known admin account from the main-branch fix.
INSERT INTO public.user_roles (user_id, role)
VALUES ('841b2f12-5ea2-42c3-8064-514f758257b1', 'admin')
ON CONFLICT (user_id, role) DO NOTHING;
