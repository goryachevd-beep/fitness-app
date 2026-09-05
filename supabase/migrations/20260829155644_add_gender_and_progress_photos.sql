/*
# Add gender to profiles and create progress_photos table

## Purpose
Supports the Body Progress Visualizer: gender-adaptive silhouette and progress photo storage.

## 1. Modified Tables
- `profiles`
  - Added `gender` column (text, nullable, values 'male' | 'female', default 'male')
  - Allows the visualizer to pick the correct body silhouette

## 2. New Tables
- `progress_photos`
  - `id` (uuid, primary key)
  - `photo_url` (text, not null) — public URL of the uploaded image in Supabase Storage
  - `label` (text, not null) — 'start' or 'current' tag
  - `taken_date` (date, not null) — the date the photo was taken
  - `created_at` (timestamptz, default now())

## 3. Security
- RLS enabled on `progress_photos`
- Single-tenant app (no auth screen) → anon + authenticated full CRUD
- `USING (true)` is acceptable because all data is intentionally shared

## 4. Storage
- Creates a public storage bucket `progress-photos` for image uploads
*/

-- Add gender column to profiles
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'profiles' AND column_name = 'gender'
  ) THEN
    ALTER TABLE profiles ADD COLUMN gender text DEFAULT 'male' CHECK (gender IN ('male', 'female'));
  END IF;
END $$;

-- Create progress_photos table
CREATE TABLE IF NOT EXISTS progress_photos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  photo_url text NOT NULL,
  label text NOT NULL CHECK (label IN ('start', 'current')),
  taken_date date NOT NULL,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE progress_photos ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anon_select_progress_photos" ON progress_photos;
CREATE POLICY "anon_select_progress_photos" ON progress_photos FOR SELECT
  TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "anon_insert_progress_photos" ON progress_photos;
CREATE POLICY "anon_insert_progress_photos" ON progress_photos FOR INSERT
  TO anon, authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "anon_update_progress_photos" ON progress_photos;
CREATE POLICY "anon_update_progress_photos" ON progress_photos FOR UPDATE
  TO anon, authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "anon_delete_progress_photos" ON progress_photos;
CREATE POLICY "anon_delete_progress_photos" ON progress_photos FOR DELETE
  TO anon, authenticated USING (true);

-- Create storage bucket for progress photos
INSERT INTO storage.buckets (id, name, public)
VALUES ('progress-photos', 'progress-photos', true)
ON CONFLICT (id) DO NOTHING;

-- Storage policies for progress-photos bucket
DROP POLICY IF EXISTS "anon_upload_progress_photos" ON storage.objects;
CREATE POLICY "anon_upload_progress_photos" ON storage.objects FOR INSERT
  TO anon, authenticated WITH CHECK (bucket_id = 'progress-photos');

DROP POLICY IF EXISTS "anon_read_progress_photos" ON storage.objects;
CREATE POLICY "anon_read_progress_photos" ON storage.objects FOR SELECT
  TO anon, authenticated USING (bucket_id = 'progress-photos');

DROP POLICY IF EXISTS "anon_delete_progress_photos_storage" ON storage.objects;
CREATE POLICY "anon_delete_progress_photos_storage" ON storage.objects FOR DELETE
  TO anon, authenticated USING (bucket_id = 'progress-photos');
