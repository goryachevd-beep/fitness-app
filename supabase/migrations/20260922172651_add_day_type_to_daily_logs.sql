/*
# Add day_type column to daily_logs

1. Changes
- Adds `day_type` column to the `daily_logs` table.
- Type: text, nullable, defaults to 'training'.
- Allowed values: 'training' or 'rest'.
- This stores whether the user marked a given day as a training day or a rest day,
  which controls which calorie/carb targets are shown on the Nutrition page.
2. Security
- No RLS policy changes needed. The existing anon/authenticated CRUD policies on
  daily_logs already cover all columns (updatable_columns: all, insertable_columns: all).
3. Notes
- The column is nullable with a default of 'training' so existing rows and new
  inserts that omit the field default to training day.
- A CHECK constraint enforces only 'training' or 'rest' as valid values.
*/

ALTER TABLE daily_logs
  ADD COLUMN IF NOT EXISTS day_type text DEFAULT 'training';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'daily_logs_day_type_check'
      AND table_name = 'daily_logs'
  ) THEN
    ALTER TABLE daily_logs
      ADD CONSTRAINT daily_logs_day_type_check CHECK (day_type IS NULL OR day_type IN ('training', 'rest'));
  END IF;
END $$;
