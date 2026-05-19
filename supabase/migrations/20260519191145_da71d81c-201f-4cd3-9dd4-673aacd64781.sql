DELETE FROM public.level_objects WHERE level_id > 5;
DELETE FROM public.levels WHERE id > 5;
UPDATE public.levels SET total_objects = 5;