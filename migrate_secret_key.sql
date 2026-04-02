-- ============================================================
-- migrate_secret_key.sql
-- Run this in Supabase SQL Editor to enable secret admin URL.
-- Creates admin_settings table + verification RPCs.
-- ============================================================

-- ── ADMIN SETTINGS TABLE ─────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.admin_settings (
  key   TEXT PRIMARY KEY,
  value TEXT NOT NULL
);

ALTER TABLE public.admin_settings ENABLE ROW LEVEL SECURITY;

-- Allow anon to read settings (needed for key verification)
CREATE POLICY "anon_read_settings"
  ON public.admin_settings FOR SELECT
  USING (true);

-- Allow anon to update settings (admin changes key from CMS)
CREATE POLICY "anon_manage_settings"
  ON public.admin_settings FOR ALL
  USING (auth.role() = 'anon') WITH CHECK (auth.role() = 'anon');

CREATE POLICY "auth_manage_settings"
  ON public.admin_settings FOR ALL
  USING (auth.role() = 'authenticated');

-- ── SEED DEFAULT SECRET KEY ──────────────────────────────────
-- Change this to your own secret key!
INSERT INTO public.admin_settings (key, value) VALUES
  ('admin_secret_key', 'ap-admin-2024-secret')
ON CONFLICT (key) DO NOTHING;

-- ── RPC: verify_admin_key ────────────────────────────────────
-- Returns true if the provided key matches the stored secret.
CREATE OR REPLACE FUNCTION public.verify_admin_key(in_key TEXT)
RETURNS BOOLEAN
LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  stored_key TEXT;
BEGIN
  SELECT value INTO stored_key
  FROM public.admin_settings
  WHERE key = 'admin_secret_key';

  RETURN stored_key IS NOT NULL AND stored_key = in_key;
END;
$$;

GRANT EXECUTE ON FUNCTION public.verify_admin_key(TEXT) TO anon;
GRANT EXECUTE ON FUNCTION public.verify_admin_key(TEXT) TO authenticated;

-- ── RPC: update_admin_key ────────────────────────────────────
-- Changes the secret key. Requires the old key for verification.
CREATE OR REPLACE FUNCTION public.update_admin_key(in_old_key TEXT, in_new_key TEXT)
RETURNS BOOLEAN
LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  stored_key TEXT;
BEGIN
  SELECT value INTO stored_key
  FROM public.admin_settings
  WHERE key = 'admin_secret_key';

  IF stored_key IS NULL OR stored_key <> in_old_key THEN
    RETURN false;
  END IF;

  UPDATE public.admin_settings
  SET value = in_new_key
  WHERE key = 'admin_secret_key';

  RETURN true;
END;
$$;

GRANT EXECUTE ON FUNCTION public.update_admin_key(TEXT, TEXT) TO anon;
GRANT EXECUTE ON FUNCTION public.update_admin_key(TEXT, TEXT) TO authenticated;


-- ── STORAGE: profile-photos bucket ───────────────────────────
-- Create a public bucket for profile photos.
-- NOTE: Run this in Supabase Dashboard > Storage > New Bucket
-- Name: profile-photos, Public: Yes
-- Or use the SQL below:
INSERT INTO storage.buckets (id, name, public)
VALUES ('profile-photos', 'profile-photos', true)
ON CONFLICT (id) DO NOTHING;

-- Allow anon to upload to profile-photos bucket
CREATE POLICY "anon_upload_profile_photos"
  ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'profile-photos');

CREATE POLICY "public_read_profile_photos"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'profile-photos');

CREATE POLICY "anon_update_profile_photos"
  ON storage.objects FOR UPDATE
  USING (bucket_id = 'profile-photos');

CREATE POLICY "anon_delete_profile_photos"
  ON storage.objects FOR DELETE
  USING (bucket_id = 'profile-photos');
