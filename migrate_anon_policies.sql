-- ============================================================
-- migrate_anon_policies.sql
-- Run this in Supabase SQL Editor to add anon-role CMS policies.
-- Required because admin CMS uses custom admin_login() RPC
-- (not Supabase Auth), so the client operates as 'anon' role.
-- ============================================================

-- Drop existing policies if re-running this migration
DO $$
DECLARE
  _policies TEXT[] := ARRAY[
    'anon_manage_profile',
    'anon_manage_experience',
    'anon_manage_research',
    'anon_manage_product',
    'anon_manage_contact_info',
    'anon_manage_messages',
    'anon_manage_admin_users'
  ];
  _tables TEXT[] := ARRAY[
    'profile',
    'experience',
    'research',
    'product',
    'contact_info',
    'messages',
    'admin_users'
  ];
  i INT;
BEGIN
  FOR i IN 1..array_length(_policies, 1) LOOP
    EXECUTE format(
      'DROP POLICY IF EXISTS %I ON public.%I',
      _policies[i], _tables[i]
    );
  END LOOP;
END;
$$;

-- ── ANON CMS ACCESS ──────────────────────────────────────────
CREATE POLICY "anon_manage_profile"
  ON public.profile FOR ALL
  USING (auth.role() = 'anon') WITH CHECK (auth.role() = 'anon');

CREATE POLICY "anon_manage_experience"
  ON public.experience FOR ALL
  USING (auth.role() = 'anon') WITH CHECK (auth.role() = 'anon');

CREATE POLICY "anon_manage_research"
  ON public.research FOR ALL
  USING (auth.role() = 'anon') WITH CHECK (auth.role() = 'anon');

CREATE POLICY "anon_manage_product"
  ON public.product FOR ALL
  USING (auth.role() = 'anon') WITH CHECK (auth.role() = 'anon');

CREATE POLICY "anon_manage_contact_info"
  ON public.contact_info FOR ALL
  USING (auth.role() = 'anon') WITH CHECK (auth.role() = 'anon');

CREATE POLICY "anon_manage_messages"
  ON public.messages FOR ALL
  USING (auth.role() = 'anon') WITH CHECK (auth.role() = 'anon');

CREATE POLICY "anon_manage_admin_users"
  ON public.admin_users FOR ALL
  USING (auth.role() = 'anon') WITH CHECK (auth.role() = 'anon');
