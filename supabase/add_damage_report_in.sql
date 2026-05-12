-- Run this in Supabase Dashboard > SQL Editor
ALTER TABLE rentals ADD COLUMN IF NOT EXISTS damage_report_in JSONB DEFAULT NULL;
