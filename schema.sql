-- ============================================================
-- schema.sql — Supabase Database Schema
-- Adam Puspabhuana Portfolio CMS
-- Run this in the Supabase SQL Editor
-- ============================================================

-- ── PROFILE ──────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.profile (
  id          UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name        TEXT NOT NULL DEFAULT 'Adam Puspabhuana',
  title       TEXT,
  bio         TEXT,
  photo_url   TEXT,
  created_at  TIMESTAMPTZ DEFAULT now()
);

-- ── EXPERIENCE ────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.experience (
  id          UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  position    TEXT NOT NULL,
  institution TEXT NOT NULL,
  description TEXT,
  start_year  INTEGER NOT NULL,
  end_year    INTEGER,
  created_at  TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_experience_start_year ON public.experience (start_year DESC);

-- ── RESEARCH ─────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.research (
  id          UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  title       TEXT NOT NULL,
  journal     TEXT NOT NULL,
  year        INTEGER NOT NULL,
  doi_link    TEXT,
  abstract    TEXT,
  created_at  TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_research_year ON public.research (year DESC);

-- ── PRODUCT ──────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.product (
  id            UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  product_name  TEXT NOT NULL,
  product_type  TEXT NOT NULL,
  description   TEXT,
  year          INTEGER NOT NULL,
  demo_link     TEXT,
  created_at    TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_product_year ON public.product (year DESC);

-- ── CONTACT INFO ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.contact_info (
  id          UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  email       TEXT,
  linkedin    TEXT,
  github      TEXT,
  phone       TEXT,
  created_at  TIMESTAMPTZ DEFAULT now()
);

-- ── MESSAGES ─────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.messages (
  id          UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name        TEXT NOT NULL,
  email       TEXT NOT NULL,
  message     TEXT NOT NULL,
  created_at  TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_messages_created_at ON public.messages (created_at DESC);

-- ── PGCRYPTO (bcrypt password hashing) ───────────────────────
-- Required for crypt() and gen_salt() functions
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ── ADMIN USERS ───────────────────────────────────────────────
-- Stores admin account data.
-- password_hash uses bcrypt (via pgcrypto crypt + gen_salt('bf',12)).
-- user_id is optional — links to Supabase Auth if also created there.
CREATE TABLE IF NOT EXISTS public.admin_users (
  id            UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id       UUID UNIQUE REFERENCES auth.users(id) ON DELETE SET NULL,
  email         TEXT UNIQUE NOT NULL,
  display_name  TEXT NOT NULL DEFAULT 'Admin',
  password_hash TEXT NOT NULL,                     -- bcrypt via pgcrypto
  role          TEXT NOT NULL DEFAULT 'admin'
                  CHECK (role IN ('superadmin','admin','editor')),
  avatar_url    TEXT,
  is_active     BOOLEAN NOT NULL DEFAULT true,
  last_login    TIMESTAMPTZ,
  created_at    TIMESTAMPTZ DEFAULT now()
);

-- ── MIGRATION: upgrade existing admin_users table ────────────
-- These ALTER TABLE statements add missing columns if admin_users
-- was created by a previous version of this schema (without email
-- or password_hash). Safe to run on both new and existing tables:
-- ADD COLUMN IF NOT EXISTS is a no-op if the column already exists.
DO $$
BEGIN
  -- Make user_id nullable (old schema had NOT NULL)
  BEGIN
    ALTER TABLE public.admin_users ALTER COLUMN user_id DROP NOT NULL;
  EXCEPTION WHEN others THEN NULL; END;

  -- Add email column if missing
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name   = 'admin_users'
      AND column_name  = 'email'
  ) THEN
    ALTER TABLE public.admin_users ADD COLUMN email TEXT;
    -- Backfill email from linked auth.users where possible
    UPDATE public.admin_users au
    SET email = u.email
    FROM auth.users u
    WHERE u.id = au.user_id AND au.email IS NULL;
    -- Fallback for any rows without a linked auth user
    UPDATE public.admin_users
    SET email = 'admin_' || id::text || '@placeholder.local'
    WHERE email IS NULL;
    -- Now enforce NOT NULL and UNIQUE
    ALTER TABLE public.admin_users ALTER COLUMN email SET NOT NULL;
    ALTER TABLE public.admin_users ADD CONSTRAINT admin_users_email_uniq UNIQUE (email);
  END IF;

  -- Add password_hash column if missing
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name   = 'admin_users'
      AND column_name  = 'password_hash'
  ) THEN
    ALTER TABLE public.admin_users ADD COLUMN password_hash TEXT;
    -- Set a temporary placeholder hash (bcrypt of 'ChangeMe123!')
    -- Admin MUST reset password after first login.
    UPDATE public.admin_users
    SET password_hash = crypt('ChangeMe123!', gen_salt('bf', 12))
    WHERE password_hash IS NULL;
    ALTER TABLE public.admin_users ALTER COLUMN password_hash SET NOT NULL;
  END IF;
END;
$$;

CREATE INDEX IF NOT EXISTS idx_admin_users_user_id ON public.admin_users (user_id);
CREATE INDEX IF NOT EXISTS idx_admin_users_email   ON public.admin_users (email);


-- ── RPC: admin_login ──────────────────────────────────────────
-- Called by login.html to verify credentials against admin_users.
-- Returns user data if email + password match and account is active.
-- SECURITY DEFINER + GRANT to anon so it can be called without auth session.
CREATE OR REPLACE FUNCTION public.admin_login(in_email TEXT, in_password TEXT)
RETURNS TABLE(
  id           UUID,
  email        TEXT,
  display_name TEXT,
  role         TEXT,
  avatar_url   TEXT
)
LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  -- Update last_login timestamp before returning
  UPDATE public.admin_users
  SET last_login = now()
  WHERE public.admin_users.email       = in_email
    AND public.admin_users.password_hash = crypt(in_password, public.admin_users.password_hash)
    AND public.admin_users.is_active   = true;

  RETURN QUERY
  SELECT
    a.id,
    a.email,
    a.display_name,
    a.role,
    a.avatar_url
  FROM public.admin_users a
  WHERE a.email         = in_email
    AND a.password_hash = crypt(in_password, a.password_hash)
    AND a.is_active     = true;
END;
$$;

-- Allow unauthenticated (anon) callers to use admin_login for sign-in
GRANT EXECUTE ON FUNCTION public.admin_login(TEXT, TEXT) TO anon;

-- ── RPC: admin_change_password ────────────────────────────────
-- Called from users.html to reset/change a user's password.
-- Only accessible by authenticated admins (RLS enforced via SECURITY DEFINER).
CREATE OR REPLACE FUNCTION public.admin_change_password(p_admin_id UUID, p_new_password TEXT)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  UPDATE public.admin_users
  SET password_hash = crypt(p_new_password, gen_salt('bf', 12))
  WHERE id = p_admin_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_change_password(UUID, TEXT) TO authenticated, anon;

-- ── TRIGGER: auto-populate admin_users on new Auth signup ─────
CREATE OR REPLACE FUNCTION public.handle_new_auth_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  -- Only insert if not already present
  INSERT INTO public.admin_users (user_id, email, display_name, role, password_hash)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'display_name', split_part(NEW.email, '@', 1)),
    'admin',
    crypt('ChangeMe@' || to_char(now(), 'YYYY'), gen_salt('bf', 12))
  )
  ON CONFLICT (email) DO UPDATE
    SET user_id = EXCLUDED.user_id;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_auth_user();


-- ============================================================
-- ROW LEVEL SECURITY (RLS)
-- ============================================================

-- Enable RLS on all tables
ALTER TABLE public.profile      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.experience   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.research     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.product      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.contact_info ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.messages     ENABLE ROW LEVEL SECURITY;

-- ── PUBLIC READ: profile, experience, research, product, contact_info ──
CREATE POLICY "public_read_profile"
  ON public.profile FOR SELECT USING (true);

CREATE POLICY "public_read_experience"
  ON public.experience FOR SELECT USING (true);

CREATE POLICY "public_read_research"
  ON public.research FOR SELECT USING (true);

CREATE POLICY "public_read_product"
  ON public.product FOR SELECT USING (true);

CREATE POLICY "public_read_contact_info"
  ON public.contact_info FOR SELECT USING (true);

-- ── PUBLIC INSERT: messages (anyone can send a message) ──────
CREATE POLICY "public_insert_messages"
  ON public.messages FOR INSERT WITH CHECK (true);

-- ── AUTHENTICATED ADMIN: full access ─────────────────────────
CREATE POLICY "admin_all_profile"
  ON public.profile FOR ALL USING (auth.role() = 'authenticated');

CREATE POLICY "admin_all_experience"
  ON public.experience FOR ALL USING (auth.role() = 'authenticated');

CREATE POLICY "admin_all_research"
  ON public.research FOR ALL USING (auth.role() = 'authenticated');

CREATE POLICY "admin_all_product"
  ON public.product FOR ALL USING (auth.role() = 'authenticated');

CREATE POLICY "admin_all_contact_info"
  ON public.contact_info FOR ALL USING (auth.role() = 'authenticated');

CREATE POLICY "admin_all_messages"
  ON public.messages FOR ALL USING (auth.role() = 'authenticated');

-- ── ANON CMS ACCESS ──────────────────────────────────────────
-- The admin CMS uses custom admin_login() RPC + sessionStorage
-- for authentication (NOT Supabase Auth). The Supabase client
-- therefore operates as 'anon' role. These policies allow the
-- CMS to perform CRUD operations on content tables.
-- Client-side auth guard (requireAuth) prevents unauthorized access.
CREATE POLICY "anon_manage_profile"
  ON public.profile FOR ALL USING (auth.role() = 'anon') WITH CHECK (auth.role() = 'anon');

CREATE POLICY "anon_manage_experience"
  ON public.experience FOR ALL USING (auth.role() = 'anon') WITH CHECK (auth.role() = 'anon');

CREATE POLICY "anon_manage_research"
  ON public.research FOR ALL USING (auth.role() = 'anon') WITH CHECK (auth.role() = 'anon');

CREATE POLICY "anon_manage_product"
  ON public.product FOR ALL USING (auth.role() = 'anon') WITH CHECK (auth.role() = 'anon');

CREATE POLICY "anon_manage_contact_info"
  ON public.contact_info FOR ALL USING (auth.role() = 'anon') WITH CHECK (auth.role() = 'anon');

CREATE POLICY "anon_manage_messages"
  ON public.messages FOR ALL USING (auth.role() = 'anon') WITH CHECK (auth.role() = 'anon');

-- ── ADMIN USERS RLS ───────────────────────────────────────────
-- admin_users uses SECURITY DEFINER RPCs for all access,
-- but we still enable RLS and allow admins to view/manage.
ALTER TABLE public.admin_users ENABLE ROW LEVEL SECURITY;

-- admin_login() bypasses RLS via SECURITY DEFINER — safe to read password_hash
CREATE POLICY "admin_users_self_read"
  ON public.admin_users FOR SELECT
  USING (auth.role() = 'authenticated');

CREATE POLICY "admin_users_authenticated_write"
  ON public.admin_users FOR ALL
  USING (auth.role() = 'authenticated');

-- Allow anon CMS to manage admin_users (needed for user management page)
CREATE POLICY "anon_manage_admin_users"
  ON public.admin_users FOR ALL
  USING (auth.role() = 'anon') WITH CHECK (auth.role() = 'anon');


-- ============================================================
-- SAMPLE DATA (Optional — remove in production)
-- ============================================================

-- Profile
INSERT INTO public.profile (name, title, bio, photo_url) VALUES
(
  'Adam Puspabhuana',
  'Lecturer & Researcher',
  'Adam Puspabhuana is a dedicated academic professional with expertise in information systems, data science, and technology innovation. Committed to advancing knowledge through rigorous research and meaningful academic contributions.',
  ''
) ON CONFLICT DO NOTHING;

-- Contact Info
INSERT INTO public.contact_info (email, linkedin, github, phone) VALUES
(
  'adam.puspabhuana@example.com',
  'https://linkedin.com/in/adampuspabhuana',
  'https://github.com/adampuspabhuana',
  '+62 xxx-xxxx-xxxx'
) ON CONFLICT DO NOTHING;

-- ── ADMIN USER ACCOUNTS (Sample data with bcrypt encryption) ──
--
-- ┌──────────────────────────────────────────────────────────┐
-- │               DEFAULT LOGIN CREDENTIALS                  │
-- │  (For testing only — change passwords after first login) │
-- ├────────────────┬─────────────────────────┬───────────────┤
-- │  Email         │ Password (plain text)   │ Role          │
-- ├────────────────┼─────────────────────────┼───────────────┤
-- │  admin@adam    │ Admin@2024              │ superadmin    │
-- │  portfolio.com │                         │               │
-- ├────────────────┼─────────────────────────┼───────────────┤
-- │  editor@adam   │ Editor@2024             │ editor        │
-- │  portfolio.com │                         │               │
-- └────────────────┴─────────────────────────┴───────────────┘
--
-- Passwords are hashed using bcrypt (cost factor 12) via pgcrypto.
-- crypt('plaintext', gen_salt('bf', 12)) produces a secure bcrypt hash.
-- Verification: crypt(input, stored_hash) = stored_hash (constant-time).

INSERT INTO public.admin_users (email, display_name, role, password_hash, is_active) VALUES
(
  'admin@adamportfolio.com',
  'Super Admin',
  'superadmin',
  crypt('Admin@2024', gen_salt('bf', 12)),   -- Plain: Admin@2024
  true
),
(
  'editor@adamportfolio.com',
  'Content Editor',
  'editor',
  crypt('Editor@2024', gen_salt('bf', 12)),  -- Plain: Editor@2024
  true
)
ON CONFLICT (email) DO NOTHING;

-- Sample Experience
INSERT INTO public.experience (position, institution, description, start_year, end_year) VALUES
('Lecturer', 'Universitas Contoh', 'Teaching courses in information systems, machine learning, and research methodology. Supervising undergraduate and postgraduate research projects.', 2022, NULL),
('Research Associate', 'Research Institute Indonesia', 'Conducting applied research in data science and AI applications for public health and education sectors.', 2021, 2022),
('Junior Researcher', 'Tech Innovation Lab', 'Supporting research initiatives in educational technology and digital transformation.', 2020, 2021);

-- Sample Research
INSERT INTO public.research (title, journal, year, doi_link, abstract) VALUES
('Deep Learning Approaches for Academic Performance Prediction', 'Journal of Educational Technology', 2024, 'https://doi.org/10.xxxx/example1', 'This paper explores the application of deep learning techniques to predict academic performance using historical student data, attendance patterns, and engagement metrics.'),
('Blockchain-Based Academic Record Verification System', 'International Journal of Information Systems', 2023, 'https://doi.org/10.xxxx/example2', 'A novel blockchain-based system for verifying and securing academic records, ensuring authenticity and preventing document fraud in higher education institutions.'),
('IoT Integration in Smart Campus Infrastructure', 'Journal of Smart Technology', 2022, 'https://doi.org/10.xxxx/example3', 'This research presents a comprehensive framework for integrating IoT devices in university campus infrastructure to optimize resource utilization and improve stakeholder experience.');

-- Sample Products
INSERT INTO public.product (product_name, product_type, description, year, demo_link) VALUES
('AcademiQ – AI Academic Advisor', 'Software Application', 'An AI-powered academic advising system that provides personalized study recommendations and course planning for university students based on their performance data.', 2024, 'https://example.com/academiq'),
('SmartAttend – Attendance Tracking System', 'Software', 'A face-recognition based attendance system for classrooms, integrated with the university''s existing LMS platforms.', 2023, NULL),
('Open Research Dataset – Educational Analytics', 'Dataset / IP', 'A curated and anonymized dataset of student learning patterns spanning 3 years, made available for researchers under a Creative Commons license.', 2022, 'https://example.com/dataset');
