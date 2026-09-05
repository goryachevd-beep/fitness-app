-- Add muscle_group column to exercises table
ALTER TABLE exercises ADD COLUMN IF NOT EXISTS muscle_group text;

-- Backfill muscle_group from existing category values
UPDATE exercises SET muscle_group = category WHERE muscle_group IS NULL;

-- Add comment
COMMENT ON COLUMN exercises.muscle_group IS 'Muscle group for exercise (e.g. Спина, Грудь, Ноги, Руки)';
