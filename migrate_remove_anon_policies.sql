-- ============================================================
-- migrate_remove_anon_policies.sql
-- Security Migration: Remove dangerous anon write policies
-- Run this in Supabase SQL Editor if you already installed the CMS
-- ============================================================

-- ┌─────────────────────────────────────────────────────────┐
-- │  STEP 1: Drop all anon_manage_* policies               │
-- │  These allow ANYONE to modify/delete ALL your data!     │
-- └─────────────────────────────────────────────────────────┘

DROP POLICY IF EXISTS "anon_manage_profile" ON public.profile;
DROP POLICY IF EXISTS "anon_manage_experience" ON public.experience;
DROP POLICY IF EXISTS "anon_manage_research" ON public.research;
DROP POLICY IF EXISTS "anon_manage_product" ON public.product;
DROP POLICY IF EXISTS "anon_manage_contact_info" ON public.contact_info;
DROP POLICY IF EXISTS "anon_manage_messages" ON public.messages;
DROP POLICY IF EXISTS "anon_manage_admin_users" ON public.admin_users;
DROP POLICY IF EXISTS "anon_manage_community_services" ON public.community_services;
DROP POLICY IF EXISTS "anon_manage_settings" ON public.admin_settings;

-- ┌─────────────────────────────────────────────────────────┐
-- │  STEP 2: Drop overly permissive lecturing policies      │
-- └─────────────────────────────────────────────────────────┘

DROP POLICY IF EXISTS "Allow public read on lecturing" ON public.lecturing;
DROP POLICY IF EXISTS "Allow authenticated write on lecturing" ON public.lecturing;
DROP POLICY IF EXISTS "admin_users_self_read" ON public.admin_users;
DROP POLICY IF EXISTS "admin_users_authenticated_write" ON public.admin_users;
DROP POLICY IF EXISTS "auth_manage_settings" ON public.admin_settings;

-- ┌─────────────────────────────────────────────────────────┐
-- │  STEP 3: Create proper read-only policies for anon      │
-- └─────────────────────────────────────────────────────────┘

DO $$ BEGIN CREATE POLICY "public_read_lecturing" ON public.lecturing FOR SELECT USING (true); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "public_read_messages" ON public.messages FOR SELECT USING (true); EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ┌─────────────────────────────────────────────────────────┐
-- │  STEP 4: Create proper authenticated (admin) policies   │
-- └─────────────────────────────────────────────────────────┘

DO $$ BEGIN CREATE POLICY "admin_all_lecturing" ON public.lecturing FOR ALL USING (auth.role() = 'authenticated') WITH CHECK (auth.role() = 'authenticated'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "admin_all_admin_users" ON public.admin_users FOR ALL USING (auth.role() = 'authenticated') WITH CHECK (auth.role() = 'authenticated'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "admin_all_settings" ON public.admin_settings FOR ALL USING (auth.role() = 'authenticated') WITH CHECK (auth.role() = 'authenticated'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ┌─────────────────────────────────────────────────────────┐
-- │  STEP 5: Create admin_login_auth RPC function           │
-- │  This syncs auth.users so signInWithPassword works      │
-- └─────────────────────────────────────────────────────────┘

CREATE OR REPLACE FUNCTION public.admin_login_auth(in_email TEXT, in_password TEXT)
RETURNS JSON
LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  admin_rec RECORD;
  existing_auth_id UUID;
BEGIN
  SELECT id, email, display_name, role, avatar_url INTO admin_rec
  FROM public.admin_users
  WHERE email = in_email
    AND password_hash = crypt(in_password, password_hash)
    AND is_active = true;

  IF admin_rec IS NULL THEN
    RETURN json_build_object('error', 'Invalid email or password');
  END IF;

  SELECT id INTO existing_auth_id FROM auth.users WHERE email = in_email;

  IF existing_auth_id IS NULL THEN
    existing_auth_id := gen_random_uuid();
    INSERT INTO auth.users (
      instance_id, id, aud, role, email,
      encrypted_password, email_confirmed_at,
      raw_app_meta_data, raw_user_meta_data,
      created_at, updated_at, confirmation_token, recovery_token
    ) VALUES (
      '00000000-0000-0000-0000-000000000000',
      existing_auth_id, 'authenticated', 'authenticated', in_email,
      crypt(in_password, gen_salt('bf')), now(),
      '{"provider":"email","providers":["email"]}'::jsonb,
      jsonb_build_object('display_name', admin_rec.display_name),
      now(), now(), '', ''
    );
    INSERT INTO auth.identities (id, user_id, identity_data, provider, provider_id, last_sign_in_at, created_at, updated_at)
    VALUES (
      existing_auth_id::text, existing_auth_id,
      jsonb_build_object('sub', existing_auth_id::text, 'email', in_email),
      'email', existing_auth_id::text, now(), now(), now()
    ) ON CONFLICT DO NOTHING;
    UPDATE public.admin_users SET user_id = existing_auth_id WHERE id = admin_rec.id;
  ELSE
    UPDATE auth.users
    SET encrypted_password = crypt(in_password, gen_salt('bf')), updated_at = now()
    WHERE id = existing_auth_id;
  END IF;

  UPDATE public.admin_users SET last_login = now() WHERE id = admin_rec.id;

  RETURN json_build_object(
    'id', admin_rec.id,
    'email', admin_rec.email,
    'display_name', admin_rec.display_name,
    'role', admin_rec.role,
    'avatar_url', admin_rec.avatar_url
  );
END;
$$;
GRANT EXECUTE ON FUNCTION public.admin_login_auth(TEXT, TEXT) TO anon;

-- ┌─────────────────────────────────────────────────────────┐
-- │  STEP 6: Update admin_change_password to sync auth.users│
-- └─────────────────────────────────────────────────────────┘

CREATE OR REPLACE FUNCTION public.admin_change_password(p_admin_id UUID, p_new_password TEXT)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  admin_email TEXT;
  auth_uid UUID;
BEGIN
  UPDATE public.admin_users SET password_hash = crypt(p_new_password, gen_salt('bf', 12)) WHERE id = p_admin_id;
  SELECT email INTO admin_email FROM public.admin_users WHERE id = p_admin_id;
  IF admin_email IS NOT NULL THEN
    SELECT id INTO auth_uid FROM auth.users WHERE email = admin_email;
    IF auth_uid IS NOT NULL THEN
      UPDATE auth.users SET encrypted_password = crypt(p_new_password, gen_salt('bf')), updated_at = now() WHERE id = auth_uid;
    END IF;
  END IF;
END;
$$;
-- Remove anon access to change_password
REVOKE EXECUTE ON FUNCTION public.admin_change_password(UUID, TEXT) FROM anon;
GRANT EXECUTE ON FUNCTION public.admin_change_password(UUID, TEXT) TO authenticated;

-- ┌─────────────────────────────────────────────────────────┐
-- │  STEP 7: Restrict update_admin_key to authenticated     │
-- └─────────────────────────────────────────────────────────┘

REVOKE EXECUTE ON FUNCTION public.update_admin_key(TEXT, TEXT) FROM anon;
GRANT EXECUTE ON FUNCTION public.update_admin_key(TEXT, TEXT) TO authenticated;
