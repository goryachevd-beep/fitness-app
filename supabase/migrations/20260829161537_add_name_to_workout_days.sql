/*
# Add `name` column to workout_days

## Purpose
Store the exact workout day name (e.g. "Тренировка 1", "Тренировка 2") directly
on the workout_days row. The UI displays this verbatim — no muscle-group
inference from template titles.

## 1. Modified Tables
- `workout_days`
  - Added `name` (text, nullable) — the canonical display name for the workout day

## 2. Data Backfill
- Existing rows get `name` = `day_name` where `name` is still null, so current
  data (e.g. "День A", "Тренировка 3") is preserved and shown correctly.

## 3. Security
- No policy changes needed — workout_days already has full anon+authenticated CRUD.
*/

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'workout_days' AND column_name = 'name'
  ) THEN
    ALTER TABLE workout_days ADD COLUMN name text;
  END IF;
END $$;

-- Backfill from day_name where name is null
UPDATE workout_days SET name = day_name WHERE name IS NULL AND day_name IS NOT NULL;
