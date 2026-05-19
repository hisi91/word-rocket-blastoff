
-- Tables
CREATE TABLE public.levels (
  id INTEGER PRIMARY KEY,
  name TEXT NOT NULL,
  total_objects INTEGER NOT NULL DEFAULT 10,
  folder_name TEXT NOT NULL,
  background_theme TEXT NOT NULL,
  fall_duration NUMERIC NOT NULL DEFAULT 5.0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE public.level_objects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  level_id INTEGER NOT NULL REFERENCES public.levels(id) ON DELETE CASCADE,
  word TEXT NOT NULL,
  icon_path TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(level_id, word)
);

CREATE INDEX idx_level_objects_level ON public.level_objects(level_id);

-- RLS: public read
ALTER TABLE public.levels ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.level_objects ENABLE ROW LEVEL SECURITY;

CREATE POLICY "levels_public_read" ON public.levels FOR SELECT USING (true);
CREATE POLICY "level_objects_public_read" ON public.level_objects FOR SELECT USING (true);

-- Storage bucket
INSERT INTO storage.buckets (id, name, public) VALUES ('game-icons', 'game-icons', true)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "game_icons_public_read" ON storage.objects FOR SELECT
  USING (bucket_id = 'game-icons');
