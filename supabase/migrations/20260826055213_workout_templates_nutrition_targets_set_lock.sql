/*
# Workout templates, nutrition targets, set lock, exercise media & comments

1. New Tables
- `workout_templates` — coach-created workout templates (e.g. "Тренировка 1", "Тренировка 2", custom Crossfit day).
  - `id` (uuid PK), `title` (text), `description` (text), `is_custom` (bool), `created_at`.
- `workout_template_exercises` — exercises within a template with target sets/reps/percent.
  - `id` (uuid PK), `template_id` (FK → workout_templates), `exercise_id` (FK → exercises),
    `order_index` (int), `target_sets` (int), `target_reps` (int), `target_weight` (numeric), `target_rm_percent` (int).
- `nutrition_targets` — daily macro/calorie targets with split training/rest day support.
  - `id` (uuid PK), `mode` (text: 'uniform' | 'split'), `training_calories` (int), `rest_calories` (int),
    `uniform_calories` (int), `protein` (int), `training_carbs` (int), `rest_carbs` (int), `fats` (int),
    `updated_at` (timestamptz).

2. Modified Tables
- `workout_days` — add `template_id` (nullable FK → workout_templates) to link a logged workout to its template.
- `workout_sets` — add `is_locked` (boolean default false) to lock completed sets,
  and `video_url` (text) for user-uploaded execution clips.

3. Security
- RLS enabled on all new tables with anon+authenticated CRUD (single-tenant demo).
- Existing tables already have RLS; no policy changes needed for new columns.

4. Important Notes
- `is_locked` defaults to false; the app sets it true when a set is marked complete.
- `nutrition_targets` has a single row (singleton config); the app upserts row with fixed id.
- `workout_template_exercises` defines the plan; `workout_sets` holds the actual logged sets.
*/

-- Workout templates
CREATE TABLE IF NOT EXISTS workout_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  description text,
  is_custom boolean NOT NULL DEFAULT false,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE workout_templates ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "anon_select_workout_templates" ON workout_templates;
CREATE POLICY "anon_select_workout_templates" ON workout_templates FOR SELECT TO anon, authenticated USING (true);
DROP POLICY IF EXISTS "anon_insert_workout_templates" ON workout_templates;
CREATE POLICY "anon_insert_workout_templates" ON workout_templates FOR INSERT TO anon, authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "anon_update_workout_templates" ON workout_templates;
CREATE POLICY "anon_update_workout_templates" ON workout_templates FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "anon_delete_workout_templates" ON workout_templates;
CREATE POLICY "anon_delete_workout_templates" ON workout_templates FOR DELETE TO anon, authenticated USING (true);

-- Template exercises (the plan)
CREATE TABLE IF NOT EXISTS workout_template_exercises (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  template_id uuid NOT NULL REFERENCES workout_templates(id) ON DELETE CASCADE,
  exercise_id uuid NOT NULL REFERENCES exercises(id) ON DELETE CASCADE,
  order_index integer NOT NULL DEFAULT 0,
  target_sets integer NOT NULL DEFAULT 3,
  target_reps integer,
  target_weight numeric,
  target_rm_percent integer,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE workout_template_exercises ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "anon_select_wte" ON workout_template_exercises;
CREATE POLICY "anon_select_wte" ON workout_template_exercises FOR SELECT TO anon, authenticated USING (true);
DROP POLICY IF EXISTS "anon_insert_wte" ON workout_template_exercises;
CREATE POLICY "anon_insert_wte" ON workout_template_exercises FOR INSERT TO anon, authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "anon_update_wte" ON workout_template_exercises;
CREATE POLICY "anon_update_wte" ON workout_template_exercises FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "anon_delete_wte" ON workout_template_exercises;
CREATE POLICY "anon_delete_wte" ON workout_template_exercises FOR DELETE TO anon, authenticated USING (true);

-- Nutrition targets (singleton config)
CREATE TABLE IF NOT EXISTS nutrition_targets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  mode text NOT NULL DEFAULT 'split',
  training_calories integer NOT NULL DEFAULT 3300,
  rest_calories integer NOT NULL DEFAULT 2850,
  uniform_calories integer NOT NULL DEFAULT 2850,
  protein integer NOT NULL DEFAULT 180,
  training_carbs integer NOT NULL DEFAULT 460,
  rest_carbs integer NOT NULL DEFAULT 335,
  fats integer NOT NULL DEFAULT 80,
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE nutrition_targets ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "anon_select_nutrition_targets" ON nutrition_targets;
CREATE POLICY "anon_select_nutrition_targets" ON nutrition_targets FOR SELECT TO anon, authenticated USING (true);
DROP POLICY IF EXISTS "anon_insert_nutrition_targets" ON nutrition_targets;
CREATE POLICY "anon_insert_nutrition_targets" ON nutrition_targets FOR INSERT TO anon, authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "anon_update_nutrition_targets" ON nutrition_targets;
CREATE POLICY "anon_update_nutrition_targets" ON nutrition_targets FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "anon_delete_nutrition_targets" ON nutrition_targets;
CREATE POLICY "anon_delete_nutrition_targets" ON nutrition_targets FOR DELETE TO anon, authenticated USING (true);

-- Add columns to existing tables
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='workout_days' AND column_name='template_id') THEN
    ALTER TABLE workout_days ADD COLUMN template_id uuid REFERENCES workout_templates(id) ON DELETE SET NULL;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='workout_sets' AND column_name='is_locked') THEN
    ALTER TABLE workout_sets ADD COLUMN is_locked boolean NOT NULL DEFAULT false;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='workout_sets' AND column_name='video_url') THEN
    ALTER TABLE workout_sets ADD COLUMN video_url text;
  END IF;
END $$;

-- Seed default nutrition targets if none exist
INSERT INTO nutrition_targets (mode, training_calories, rest_calories, uniform_calories, protein, training_carbs, rest_carbs, fats)
SELECT 'split', 3300, 2850, 2850, 180, 460, 335, 80
WHERE NOT EXISTS (SELECT 1 FROM nutrition_targets);

-- Seed workout templates
INSERT INTO workout_templates (title, description, is_custom)
SELECT 'Тренировка 1', 'Спина, дельты, руки', false
WHERE NOT EXISTS (SELECT 1 FROM workout_templates WHERE title = 'Тренировка 1');

INSERT INTO workout_templates (title, description, is_custom)
SELECT 'Тренировка 2', 'Грудь, спина, ноги', false
WHERE NOT EXISTS (SELECT 1 FROM workout_templates WHERE title = 'Тренировка 2');

INSERT INTO workout_templates (title, description, is_custom)
SELECT 'Тренировка 3', 'Грудь, ноги, руки', false
WHERE NOT EXISTS (SELECT 1 FROM workout_templates WHERE title = 'Тренировка 3');

INSERT INTO workout_templates (title, description, is_custom)
SELECT 'Crossfit день', 'Кастомный кроссфит WOD', true
WHERE NOT EXISTS (SELECT 1 FROM workout_templates WHERE title = 'Crossfit день');
