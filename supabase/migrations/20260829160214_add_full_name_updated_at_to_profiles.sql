/*
# Add full_name and updated_at to profiles

## Purpose
Support dynamic user profile display and editing. The header reads the
authenticated user's metadata (Google OAuth full_name / avatar_url), and the
profiles table stores custom overrides the user can edit inline.

## 1. Modified Tables
- `profiles`
  - Added `full_name` (text, nullable) — custom display name override
  - Added `updated_at` (timestamptz, default now()) — last modification timestamp

## 2. Security
- No policy changes needed — profiles already has full anon+authenticated CRUD
*/

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'profiles' AND column_name = 'full_name'
  ) THEN
    ALTER TABLE profiles ADD COLUMN full_name text;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'profiles' AND column_name = 'updated_at'
  ) THEN
    ALTER TABLE profiles ADD COLUMN updated_at timestamptz DEFAULT now();
  END IF;
END $$;
