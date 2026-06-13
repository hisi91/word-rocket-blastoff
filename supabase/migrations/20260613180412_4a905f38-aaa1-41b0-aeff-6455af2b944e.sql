UPDATE public.level_objects lo
SET icon_path = 'level-' || lo.level_id || '/' || lo.word || '.webp'
WHERE lo.level_id BETWEEN 11 AND 20
  AND (lo.icon_path IS NULL OR lo.icon_path = '')
  AND EXISTS (
    SELECT 1 FROM storage.objects so
    WHERE so.bucket_id = 'game-icons'
      AND so.name = 'level-' || lo.level_id || '/' || lo.word || '.webp'
  );