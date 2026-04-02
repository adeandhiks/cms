-- Add new columns to profile table
ALTER TABLE profile ADD COLUMN IF NOT EXISTS motto TEXT DEFAULT '';
ALTER TABLE profile ADD COLUMN IF NOT EXISTS theme TEXT DEFAULT 'ocean';
ALTER TABLE profile ADD COLUMN IF NOT EXISTS logo_text TEXT DEFAULT '';
ALTER TABLE profile ADD COLUMN IF NOT EXISTS layout TEXT DEFAULT 'classic';

-- Add all columns to contact_info table (in case some are missing)
ALTER TABLE contact_info ADD COLUMN IF NOT EXISTS address TEXT DEFAULT '';
ALTER TABLE contact_info ADD COLUMN IF NOT EXISTS hours_weekday TEXT DEFAULT '08:00 – 17:00 WIB';
ALTER TABLE contact_info ADD COLUMN IF NOT EXISTS hours_saturday TEXT DEFAULT 'By Appointment';
ALTER TABLE contact_info ADD COLUMN IF NOT EXISTS hours_sunday TEXT DEFAULT 'Closed';
ALTER TABLE contact_info ADD COLUMN IF NOT EXISTS quick_response TEXT DEFAULT '24h';
ALTER TABLE contact_info ADD COLUMN IF NOT EXISTS collab_status TEXT DEFAULT 'available';
ALTER TABLE contact_info ADD COLUMN IF NOT EXISTS collab_text TEXT DEFAULT '';
