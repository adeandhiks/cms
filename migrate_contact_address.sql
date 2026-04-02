-- Add "address" column to contact_info table
ALTER TABLE public.contact_info ADD COLUMN IF NOT EXISTS address TEXT;
