
-- Simplify: drop all game-icons policies and add clean admin-only policies covering all roles
DROP POLICY IF EXISTS "Admins can upload game-icons" ON storage.objects;
DROP POLICY IF EXISTS "Admins can update game-icons" ON storage.objects;
DROP POLICY IF EXISTS "Admins can delete game-icons" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can upload to game-icons" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can update game-icons" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can delete from game-icons" ON storage.objects;

CREATE POLICY "game-icons admin insert"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'game-icons' AND public.has_role(auth.uid(), 'admin'::public.app_role));

CREATE POLICY "game-icons admin update"
ON storage.objects FOR UPDATE TO authenticated
USING (bucket_id = 'game-icons' AND public.has_role(auth.uid(), 'admin'::public.app_role))
WITH CHECK (bucket_id = 'game-icons' AND public.has_role(auth.uid(), 'admin'::public.app_role));

CREATE POLICY "game-icons admin delete"
ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'game-icons' AND public.has_role(auth.uid(), 'admin'::public.app_role));
