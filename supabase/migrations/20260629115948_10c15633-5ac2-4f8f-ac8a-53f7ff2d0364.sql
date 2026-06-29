-- Roles enum + table
CREATE TYPE public.app_role AS ENUM ('admin', 'user');

CREATE TABLE public.user_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.app_role NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);

GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;

ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- Security definer role checker
CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = _role
  )
$$;

-- Users can read their own roles; admins can read all
CREATE POLICY "users_read_own_roles" ON public.user_roles
  FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));

-- Replace storage policies on game-icons: writes restricted to admins
DROP POLICY IF EXISTS "Authenticated can upload game-icons" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated can update game-icons" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated can delete game-icons" ON storage.objects;

CREATE POLICY "Admins can upload game-icons" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'game-icons' AND public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can update game-icons" ON storage.objects
  FOR UPDATE TO authenticated
  USING (bucket_id = 'game-icons' AND public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can delete game-icons" ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'game-icons' AND public.has_role(auth.uid(), 'admin'));