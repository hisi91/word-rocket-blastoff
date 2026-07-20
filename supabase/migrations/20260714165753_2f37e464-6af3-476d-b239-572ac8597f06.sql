DROP POLICY IF EXISTS "game-icons admin select" ON storage.objects;

CREATE POLICY "game-icons admin select"
ON storage.objects
FOR SELECT
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