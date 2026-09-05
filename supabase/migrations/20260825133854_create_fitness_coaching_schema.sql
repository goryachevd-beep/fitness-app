/*
# Схема приложения для трекинга тренировок, питания и работы с тренером

Демо-версия без входа по паролю. Все данные хранятся в Supabase и доступны
единственному демо-пользователю (атлет + тренер). RLS включён на всех таблицах,
политики открыты для ролей anon и authenticated, т.к. это единое общее демо-пространство.

1. Новые таблицы
   - `profiles` — профили (демо-атлет и демо-тренер): имя, роль, аватар.
   - `daily_logs` — ежедневный дневник: вес, шаги, качество сна, КБЖУ, тренд веса (EMA),
     недельный TDEE и целевая калорийность.
   - `exercises` — библиотека упражнений: название, категория, видео YouTube.
   - `workout_days` — тренировочные дни программы (неделя, день, дата, заголовок).
   - `workout_sets` — подходы: план тренера (вес/повторы/% от 1ПМ) и факт атлета.
   - `personal_records` — персональные рекорды (1ПМ/3ПМ/5ПМ) по упражнениям.
   - `custom_metrics` — конструктор замеров (талия, грудь, бицепс...) с инструкцией и тумблером.
   - `metric_logs` — значения замеров по датам.
   - `chat_threads` — ветки чата с тренером по категориям.
   - `messages` — сообщения в ветках.
   - `recipes` — рецепты с КБЖУ, языком и видеоинструкцией.

2. Безопасность
   - RLS включён на каждой таблице.
   - Отдельные политики select/insert/update/delete для anon + authenticated.
   - Данные общие для демо, поэтому USING (true).
*/

CREATE TABLE IF NOT EXISTS profiles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  role text NOT NULL DEFAULT 'athlete',
  avatar_url text,
  language_preference text NOT NULL DEFAULT 'ru',
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS daily_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  date date NOT NULL,
  weight numeric,
  steps integer DEFAULT 0,
  sleep_quality integer,
  calories integer DEFAULT 0,
  proteins integer DEFAULT 0,
  fats integer DEFAULT 0,
  carbs integer DEFAULT 0,
  weight_ema numeric,
  weekly_tdee integer,
  weekly_target_calories integer,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS exercises (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  category text NOT NULL DEFAULT 'general',
  video_url text,
  is_custom boolean NOT NULL DEFAULT false,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS workout_days (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  week_number integer NOT NULL DEFAULT 1,
  day_name text NOT NULL,
  title text NOT NULL,
  date date,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS workout_sets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workout_day_id uuid NOT NULL REFERENCES workout_days(id) ON DELETE CASCADE,
  exercise_id uuid NOT NULL REFERENCES exercises(id) ON DELETE CASCADE,
  order_index integer NOT NULL DEFAULT 0,
  set_number integer NOT NULL DEFAULT 1,
  target_weight numeric,
  target_reps integer,
  target_rm_percent integer,
  actual_weight numeric,
  actual_reps integer,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS personal_records (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  exercise_id uuid NOT NULL REFERENCES exercises(id) ON DELETE CASCADE,
  rm1 numeric,
  rm3 numeric,
  rm5 numeric,
  date_achieved date NOT NULL DEFAULT CURRENT_DATE,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS custom_metrics (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  instruction text,
  unit text NOT NULL DEFAULT 'см',
  is_active boolean NOT NULL DEFAULT true,
  order_index integer NOT NULL DEFAULT 0,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS metric_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  metric_id uuid NOT NULL REFERENCES custom_metrics(id) ON DELETE CASCADE,
  date date NOT NULL,
  value numeric NOT NULL,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS chat_threads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  category text NOT NULL DEFAULT 'general',
  title text NOT NULL,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  thread_id uuid NOT NULL REFERENCES chat_threads(id) ON DELETE CASCADE,
  sender_role text NOT NULL DEFAULT 'athlete',
  text text NOT NULL,
  reply_to_text text,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS recipes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  description text,
  ingredients text,
  calories integer DEFAULT 0,
  proteins integer DEFAULT 0,
  fats integer DEFAULT 0,
  carbs integer DEFAULT 0,
  video_url text,
  image_url text,
  language text NOT NULL DEFAULT 'ru',
  is_premium boolean NOT NULL DEFAULT false,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_daily_logs_date ON daily_logs(date);
CREATE INDEX IF NOT EXISTS idx_workout_sets_day ON workout_sets(workout_day_id);
CREATE INDEX IF NOT EXISTS idx_metric_logs_metric ON metric_logs(metric_id);
CREATE INDEX IF NOT EXISTS idx_messages_thread ON messages(thread_id);

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

DO $$
DECLARE
  t text;
  tables text[] := ARRAY['profiles','daily_logs','exercises','workout_days','workout_sets','personal_records','custom_metrics','metric_logs','chat_threads','messages','recipes'];
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