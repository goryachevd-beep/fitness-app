-- ============================================================
-- RECONCILE SCHEMA: add missing columns from migrations to existing tables
-- without dropping or recreating anything.
-- ============================================================

-- ---- exercises: missing title, category, video_url, is_custom ----
ALTER TABLE exercises ADD COLUMN IF NOT EXISTS title text;
ALTER TABLE exercises ADD COLUMN IF NOT EXISTS category text NOT NULL DEFAULT 'general';
ALTER TABLE exercises ADD COLUMN IF NOT EXISTS video_url text;
ALTER TABLE exercises ADD COLUMN IF NOT EXISTS is_custom boolean NOT NULL DEFAULT false;
ALTER TABLE exercises ADD COLUMN IF NOT EXISTS created_at timestamptz DEFAULT now();
-- Backfill title from name where title is null
UPDATE exercises SET title = name WHERE title IS NULL AND name IS NOT NULL;
-- Backfill category from muscle_group where category is 'general'
UPDATE exercises SET category = muscle_group WHERE muscle_group IS NOT NULL AND category = 'general';

-- ---- workout_days: missing week_number, day_name, title, template_id, completed, created_at ----
ALTER TABLE workout_days ADD COLUMN IF NOT EXISTS week_number integer NOT NULL DEFAULT 1;
ALTER TABLE workout_days ADD COLUMN IF NOT EXISTS day_name text;
ALTER TABLE workout_days ADD COLUMN IF NOT EXISTS title text;
ALTER TABLE workout_days ADD COLUMN IF NOT EXISTS template_id uuid REFERENCES workout_templates(id) ON DELETE SET NULL;
ALTER TABLE workout_days ADD COLUMN IF NOT EXISTS completed boolean NOT NULL DEFAULT false;
ALTER TABLE workout_days ADD COLUMN IF NOT EXISTS created_at timestamptz DEFAULT now();
-- Backfill day_name and title from name/notes
UPDATE workout_days SET day_name = COALESCE(name, notes) WHERE day_name IS NULL;
UPDATE workout_days SET title = COALESCE(name, notes) WHERE title IS NULL;

-- ---- workout_sets: missing order_index, target_weight, target_reps, target_rm_percent,
--      actual_weight, actual_reps, is_locked, video_url, created_at ----
ALTER TABLE workout_sets ADD COLUMN IF NOT EXISTS order_index integer NOT NULL DEFAULT 0;
ALTER TABLE workout_sets ADD COLUMN IF NOT EXISTS target_weight numeric;
ALTER TABLE workout_sets ADD COLUMN IF NOT EXISTS target_reps integer;
ALTER TABLE workout_sets ADD COLUMN IF NOT EXISTS target_rm_percent integer;
ALTER TABLE workout_sets ADD COLUMN IF NOT EXISTS actual_weight numeric;
ALTER TABLE workout_sets ADD COLUMN IF NOT EXISTS actual_reps integer;
ALTER TABLE workout_sets ADD COLUMN IF NOT EXISTS is_locked boolean NOT NULL DEFAULT false;
ALTER TABLE workout_sets ADD COLUMN IF NOT EXISTS video_url text;
ALTER TABLE workout_sets ADD COLUMN IF NOT EXISTS created_at timestamptz DEFAULT now();
-- Backfill actual_weight/actual_reps from weight_kg/reps
UPDATE workout_sets SET actual_weight = weight_kg WHERE actual_weight IS NULL AND weight_kg IS NOT NULL;
UPDATE workout_sets SET actual_reps = reps WHERE actual_reps IS NULL AND reps IS NOT NULL;

-- ---- workout_templates: missing title, description, is_custom ----
ALTER TABLE workout_templates ADD COLUMN IF NOT EXISTS title text;
ALTER TABLE workout_templates ADD COLUMN IF NOT EXISTS description text;
ALTER TABLE workout_templates ADD COLUMN IF NOT EXISTS is_custom boolean NOT NULL DEFAULT false;
-- Backfill title from name
UPDATE workout_templates SET title = name WHERE title IS NULL AND name IS NOT NULL;

-- ---- template_exercises: missing target_weight, target_rm_percent ----
ALTER TABLE template_exercises ADD COLUMN IF NOT EXISTS target_weight numeric;
ALTER TABLE template_exercises ADD COLUMN IF NOT EXISTS target_rm_percent integer;

-- ---- profiles: missing gender, full_name, updated_at ----
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS gender text DEFAULT 'male' CHECK (gender IN ('male', 'female'));
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS full_name text;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS updated_at timestamptz DEFAULT now();

-- ---- chat_threads: ensure created_at ----
ALTER TABLE chat_threads ADD COLUMN IF NOT EXISTS created_at timestamptz DEFAULT now();

-- ---- messages: ensure created_at ----
ALTER TABLE messages ADD COLUMN IF NOT EXISTS created_at timestamptz DEFAULT now();

-- ---- custom_metrics: ensure created_at ----
ALTER TABLE custom_metrics ADD COLUMN IF NOT EXISTS created_at timestamptz DEFAULT now();

-- ---- metric_logs: ensure created_at ----
ALTER TABLE metric_logs ADD COLUMN IF NOT EXISTS created_at timestamptz DEFAULT now();

-- ---- personal_records: ensure created_at ----
ALTER TABLE personal_records ADD COLUMN IF NOT EXISTS created_at timestamptz DEFAULT now();

-- ---- recipes: ensure created_at ----
ALTER TABLE recipes ADD COLUMN IF NOT EXISTS created_at timestamptz DEFAULT now();

-- ============================================================
-- Create missing tables that don't exist yet
-- ============================================================

-- nutrition_targets (singleton config)
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

-- progress_photos
CREATE TABLE IF NOT EXISTS progress_photos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  photo_url text NOT NULL,
  label text NOT NULL CHECK (label IN ('start', 'current')),
  taken_date date NOT NULL,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE progress_photos ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "anon_select_progress_photos" ON progress_photos;
CREATE POLICY "anon_select_progress_photos" ON progress_photos FOR SELECT TO anon, authenticated USING (true);
DROP POLICY IF EXISTS "anon_insert_progress_photos" ON progress_photos;
CREATE POLICY "anon_insert_progress_photos" ON progress_photos FOR INSERT TO anon, authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "anon_update_progress_photos" ON progress_photos;
CREATE POLICY "anon_update_progress_photos" ON progress_photos FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "anon_delete_progress_photos" ON progress_photos;
CREATE POLICY "anon_delete_progress_photos" ON progress_photos FOR DELETE TO anon, authenticated USING (true);

-- Storage bucket for progress photos
INSERT INTO storage.buckets (id, name, public)
VALUES ('progress-photos', 'progress-photos', true)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "anon_upload_progress_photos" ON storage.objects;
CREATE POLICY "anon_upload_progress_photos" ON storage.objects FOR INSERT
  TO anon, authenticated WITH CHECK (bucket_id = 'progress-photos');

DROP POLICY IF EXISTS "anon_read_progress_photos" ON storage.objects;
CREATE POLICY "anon_read_progress_photos" ON storage.objects FOR SELECT
  TO anon, authenticated USING (bucket_id = 'progress-photos');

DROP POLICY IF EXISTS "anon_delete_progress_photos_storage" ON storage.objects;
CREATE POLICY "anon_delete_progress_photos_storage" ON storage.objects FOR DELETE
  TO anon, authenticated USING (bucket_id = 'progress-photos');

-- ============================================================
-- Ensure RLS is enabled on all tables
-- ============================================================
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE daily_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE exercises ENABLE ROW LEVEL SECURITY;
ALTER TABLE workout_days ENABLE ROW LEVEL SECURITY;
ALTER TABLE workout_sets ENABLE ROW LEVEL SECURITY;
ALTER TABLE personal_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE custom_metrics ENABLE ROW LEVEL SECURITY;
ALTER TABLE metric_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE chat_threads ENABLE ROW LEVEL SECURITY;
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE recipes ENABLE ROW LEVEL SECURITY;
ALTER TABLE workout_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE template_exercises ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- Ensure CRUD policies exist on all tables (anon + authenticated)
-- ============================================================
DO $$
DECLARE
  t text;
  tables text[] := ARRAY['profiles','daily_logs','exercises','workout_days','workout_sets','personal_records','custom_metrics','metric_logs','chat_threads','messages','recipes','workout_templates','template_exercises'];
BEGIN
  FOREACH t IN ARRAY tables LOOP
    EXECUTE format('DROP POLICY IF EXISTS "anon_select_%1$s" ON %1$s;', t);
    EXECUTE format('CREATE POLICY "anon_select_%1$s" ON %1$s FOR SELECT TO anon, authenticated USING (true);', t);
    EXECUTE format('DROP POLICY IF EXISTS "anon_insert_%1$s" ON %1$s;', t);
    EXECUTE format('CREATE POLICY "anon_insert_%1$s" ON %1$s FOR INSERT TO anon, authenticated WITH CHECK (true);', t);
    EXECUTE format('DROP POLICY IF EXISTS "anon_update_%1$s" ON %1$s;', t);
    EXECUTE format('CREATE POLICY "anon_update_%1$s" ON %1$s FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);', t);
    EXECUTE format('DROP POLICY IF EXISTS "anon_delete_%1$s" ON %1$s;', t);
    EXECUTE format('CREATE POLICY "anon_delete_%1$s" ON %1$s FOR DELETE TO anon, authenticated USING (true);', t);
  END LOOP;
END $$;

-- ============================================================
-- Seed data for empty tables
-- ============================================================

-- Seed default nutrition targets if none exist
INSERT INTO nutrition_targets (mode, training_calories, rest_calories, uniform_calories, protein, training_carbs, rest_carbs, fats)
SELECT 'split', 3300, 2850, 2850, 180, 460, 335, 80
WHERE NOT EXISTS (SELECT 1 FROM nutrition_targets);

-- Seed custom metrics if none exist
INSERT INTO custom_metrics (id, name, instruction, unit, is_active, order_index)
SELECT 'a4d27a3c-ca98-49c6-a253-163deec6fdf3', 'Талия (по пупку)', 'Не втягиваем, не вываливаем живот. Обычное состояние. Мерим по пупку (так проще стандартизировать) четко параллельно с полом)', 'см', true, 0
WHERE NOT EXISTS (SELECT 1 FROM custom_metrics WHERE name = 'Талия (по пупку)');

INSERT INTO custom_metrics (id, name, instruction, unit, is_active, order_index)
SELECT '7c79c7a3-0048-47f1-9ed2-f3679ee407a1', 'Талия (без вохдуха)', NULL, 'см', true, 1
WHERE NOT EXISTS (SELECT 1 FROM custom_metrics WHERE name = 'Талия (без вохдуха)');

INSERT INTO custom_metrics (id, name, instruction, unit, is_active, order_index)
SELECT '22c01c5f-0940-4513-8b1f-0a6fc584f2aa', 'Грудь', 'На выдохе замеряем объем по линии сосков', 'см', true, 2
WHERE NOT EXISTS (SELECT 1 FROM custom_metrics WHERE name = 'Грудь');

INSERT INTO custom_metrics (id, name, instruction, unit, is_active, order_index)
SELECT 'c16b8633-e7f2-401d-896f-669003fafd08', 'Живот', 'По самой большой точке, лента параллельна с полом', 'см', true, 3
WHERE NOT EXISTS (SELECT 1 FROM custom_metrics WHERE name = 'Живот');

INSERT INTO custom_metrics (id, name, instruction, unit, is_active, order_index)
SELECT 'c598cd77-1f73-484d-a5f8-e882e44b73e9', 'Таз (ягодицы)', 'Самая большая точка, лента параллельна с полом', 'см', true, 4
WHERE NOT EXISTS (SELECT 1 FROM custom_metrics WHERE name = 'Таз (ягодицы)');

INSERT INTO custom_metrics (id, name, instruction, unit, is_active, order_index)
SELECT 'b647d4f4-a385-4868-994d-1a9c019d9fac', 'Правое бедро', 'Самая большая точка, лента параллельна с полом', 'см', true, 5
WHERE NOT EXISTS (SELECT 1 FROM custom_metrics WHERE name = 'Правое бедро');

INSERT INTO custom_metrics (id, name, instruction, unit, is_active, order_index)
SELECT '7d55f735-52d8-4398-b4ba-d2bdab5f331f', 'Левое бедро', NULL, 'см', true, 6
WHERE NOT EXISTS (SELECT 1 FROM custom_metrics WHERE name = 'Левое бедро');

INSERT INTO custom_metrics (id, name, instruction, unit, is_active, order_index)
SELECT '50cd3387-a2f5-46dc-b944-13756c1d1ba5', 'Правая рука', 'Напрягаем бицепс вот так 💪 мерим по самой большой точке примерно перпендикулярно плечевой кости', 'см', true, 7
WHERE NOT EXISTS (SELECT 1 FROM custom_metrics WHERE name = 'Правая рука');

INSERT INTO custom_metrics (id, name, instruction, unit, is_active, order_index)
SELECT '543582e2-9ebd-4275-affb-223c27e546c6', 'Левая рука', NULL, 'см', true, 8
WHERE NOT EXISTS (SELECT 1 FROM custom_metrics WHERE name = 'Левая рука');

INSERT INTO custom_metrics (id, name, instruction, unit, is_active, order_index)
SELECT 'e2eece6d-7e70-450c-b4e2-75e9313b9d04', 'Шея', 'Чуть выше кадыка, лента паралельна с полом. Наклон головы всегда одинаковый делаем', 'см', true, 9
WHERE NOT EXISTS (SELECT 1 FROM custom_metrics WHERE name = 'Шея');

-- Seed chat threads if none exist
INSERT INTO chat_threads (category, title)
SELECT 'general', 'Общий чат'
WHERE NOT EXISTS (SELECT 1 FROM chat_threads WHERE category = 'general');

INSERT INTO chat_threads (category, title)
SELECT 'workout', 'Тренировки'
WHERE NOT EXISTS (SELECT 1 FROM chat_threads WHERE category = 'workout');

INSERT INTO chat_threads (category, title)
SELECT 'nutrition', 'Питание'
WHERE NOT EXISTS (SELECT 1 FROM chat_threads WHERE category = 'nutrition');

INSERT INTO chat_threads (category, title)
SELECT 'metrics', 'Замеры'
WHERE NOT EXISTS (SELECT 1 FROM chat_threads WHERE category = 'metrics');

-- ============================================================
-- Indexes
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_daily_logs_date ON daily_logs(date);
CREATE INDEX IF NOT EXISTS idx_workout_sets_day ON workout_sets(workout_day_id);
CREATE INDEX IF NOT EXISTS idx_metric_logs_metric ON metric_logs(metric_id);
CREATE INDEX IF NOT EXISTS idx_messages_thread ON messages(thread_id);