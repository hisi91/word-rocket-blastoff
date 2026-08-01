UPDATE public.level_objects SET icon_path = 'level-' || level_id || '/' || word || '.webp'
WHERE icon_path IS NULL AND (
  (level_id = 30 AND word IN ('rabbit','squirrel','tree','wolf')) OR
  (level_id = 31 AND word IN ('cave','cliff','eagle','glacier','goat','peak','rock','snow','trail','valley'))
);