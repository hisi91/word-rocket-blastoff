DROP POLICY IF EXISTS "game-icons admin insert" ON storage.objects;
DROP POLICY IF EXISTS "game-icons admin update" ON storage.objects;
DROP POLICY IF EXISTS "game-icons admin delete" ON storage.objects;

DROP POLICY IF EXISTS "users_read_own_roles" ON public.user_roles;

CREATE POLICY "users_read_own_roles"
ON public.user_roles
FOR SELECT
TO authenticated
USING (user_id = auth.uid());

CREATE POLICY "game-icons admin insert"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'game-icons'
  AND EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = auth.uid()
      AND role = 'admin'::public.app_role
  )
);

CREATE POLICY "game-icons admin update"
ON storage.objects
FOR UPDATE
TO authenticated
USING (
  bucket_id = 'game-icons'
  AND EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = auth.uid()
      AND role = 'admin'::public.app_role
  )
)
WITH CHECK (
  bucket_id = 'game-icons'
  AND EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = auth.uid()
      AND role = 'admin'::public.app_role
  )
);

CREATE POLICY "game-icons admin delete"
ON storage.objects
FOR DELETE
TO authenticated
USING (
  bucket_id = 'game-icons'
  AND EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = auth.uid()
      AND role = 'admin'::public.app_role
  )
);

REVOKE EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) FROM anon;
REVOKE EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO service_role;