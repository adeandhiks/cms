-- ============================================================
-- Community Services Table
-- Run this in the Supabase SQL Editor
-- ============================================================

CREATE TABLE IF NOT EXISTS public.community_services (
  id            UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  title         TEXT NOT NULL,
  role          TEXT NOT NULL,
  organization  TEXT NOT NULL,
  year          INTEGER NOT NULL,
  description   TEXT,
  link          TEXT,
  created_at    TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_community_services_year ON public.community_services (year DESC);

-- Enable Row Level Security (match other tables)
ALTER TABLE public.community_services ENABLE ROW LEVEL SECURITY;

-- Allow public read
CREATE POLICY "public_read_community_services"
  ON public.community_services
  FOR SELECT
  USING (true);

-- Allow authenticated full access
CREATE POLICY "admin_all_community_services"
  ON public.community_services
  FOR ALL
  USING (auth.role() = 'authenticated');

-- Allow anon CMS access (matches other tables pattern)
CREATE POLICY "anon_manage_community_services"
  ON public.community_services
  FOR ALL
  USING (auth.role() = 'anon')
  WITH CHECK (auth.role() = 'anon');


-- ============================================================
-- SAMPLE DATA
-- ============================================================
INSERT INTO public.community_services (title, role, organization, year, description, link) VALUES
(
  'Digital Literacy Workshop for Rural Communities',
  'Lead Trainer',
  'Yayasan Pendidikan Digital',
  2024,
  'Organized and led a series of digital literacy workshops for rural communities, covering basic computer skills, internet safety, and digital tools for small businesses.',
  NULL
),
(
  'National Science Olympiad Judge',
  'Panel Judge',
  'Ministry of Education',
  2024,
  'Served as a panel judge for the national science olympiad in the computer science category, evaluating student projects and research presentations.',
  'https://example.com/olympiad'
),
(
  'Open Source Education Platform Development',
  'Technical Advisor',
  'EduTech Indonesia Foundation',
  2023,
  'Provided technical guidance for developing an open-source e-learning platform aimed at underserved schools across Indonesia.',
  'https://example.com/edutech'
),
(
  'Community Health Data Analysis Program',
  'Data Science Volunteer',
  'Puskesmas Sehat Bersama',
  2023,
  'Volunteered data science expertise to analyze community health data, helping local health centers optimize resource allocation and identify health trends.',
  NULL
),
(
  'Youth Coding Bootcamp',
  'Instructor & Mentor',
  'Code for Indonesia',
  2022,
  'Mentored underprivileged youth in a 3-month coding bootcamp covering Python, web development, and basic data science skills.',
  'https://example.com/bootcamp'
);
