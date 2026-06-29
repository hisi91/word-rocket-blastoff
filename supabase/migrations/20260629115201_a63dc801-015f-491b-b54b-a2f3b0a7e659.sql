CREATE POLICY "Authenticated users can upload to game-icons"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'game-icons');

CREATE POLICY "Authenticated users can update game-icons"
ON storage.objects FOR UPDATE TO authenticated
USING (bucket_id = 'game-icons')
WITH CHECK (bucket_id = 'game-icons');

CREATE POLICY "Authenticated users can delete from game-icons"
ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'game-icons');
