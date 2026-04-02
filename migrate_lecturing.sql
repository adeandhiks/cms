-- ============================================================
-- Lecturing (Pengajaran) Table
-- Run this in the Supabase SQL Editor
-- ============================================================

CREATE TABLE IF NOT EXISTS public.lecturing (
  id            UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  course_name   TEXT NOT NULL,
  program       TEXT NOT NULL,
  semester      TEXT,
  year          INTEGER NOT NULL,
  description   TEXT,
  created_at    TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_lecturing_year ON public.lecturing (year DESC);

-- Enable Row Level Security (match other tables)
ALTER TABLE public.lecturing ENABLE ROW LEVEL SECURITY;

-- Allow public read
CREATE POLICY "Allow public read on lecturing"
  ON public.lecturing
  FOR SELECT
  USING (true);

-- Allow authenticated insert/update/delete  
CREATE POLICY "Allow authenticated write on lecturing"
  ON public.lecturing
  FOR ALL
  USING (true)
  WITH CHECK (true);
