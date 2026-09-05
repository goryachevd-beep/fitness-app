export interface Profile {
  id: string;
  name: string;
  role: 'athlete' | 'coach';
  avatar_url: string | null;
  language_preference: string;
  gender: 'male' | 'female' | null;
  full_name: string | null;
  updated_at: string | null;
}

export interface ProgressPhoto {
  id: string;
  photo_url: string;
  label: 'start' | 'current';
  taken_date: string;
  created_at: string;
}

export interface DailyLog {
  id: string;
  date: string;
  weight: number | null;
  steps: number;
  sleep_quality: number | null;
  calories: number;
  proteins: number;
  fats: number;
  carbs: number;
  weight_ema: number | null;
  weekly_tdee: number | null;
  weekly_target_calories: number | null;
}

export interface Exercise {
  id: string;
  title: string;
  category: string;
  muscle_group: string | null;
  video_url: string | null;
  is_custom: boolean;
}

export interface WorkoutDay {
  id: string;
  week_number: number;
  day_name: string;
  title: string;
  name: string | null;
  date: string | null;
  template_id: string | null;
  user_id: string | null;
  notes: string | null;
  completed: boolean;
}

export interface WorkoutSet {
  id: string;
  workout_day_id: string;
  exercise_id: string;
  order_index: number;
  set_number: number;
  target_weight: number | null;
  target_reps: number | null;
  target_rm_percent: number | null;
  actual_weight: number | null;
  actual_reps: number | null;
  is_locked: boolean;
  video_url: string | null;
  weight_kg: number | null;
  reps: number | null;
  notes: string | null;
}

export interface WorkoutTemplate {
  id: string;
  title: string;
  description: string | null;
  is_custom: boolean;
}

export interface WorkoutTemplateExercise {
  id: string;
  template_id: string;
  exercise_id: string;
  order_index: number;
  target_sets: number;
  target_reps: number | null;
  target_weight: number | null;
  target_rm_percent: number | null;
}

export interface TemplateExercise {
  id: string;
  template_id: string;
  exercise_id: string;
  order_index: number;
  target_sets: number;
  target_reps: number | null;
  target_weight: number | null;
  target_rm_percent: number | null;
  created_at: string | null;
  exercises: {
    id: string;
    title: string;
    muscle_group: string | null;
    video_url: string | null;
  } | null;
}

export interface NutritionTargets {
  id: string;
  mode: 'uniform' | 'split';
  training_calories: number;
  rest_calories: number;
  uniform_calories: number;
  protein: number;
  training_carbs: number;
  rest_carbs: number;
  fats: number;
  updated_at: string;
}

export interface PersonalRecord {
  id: string;
  exercise_id: string;
  rm1: number | null;
  rm3: number | null;
  rm5: number | null;
  date_achieved: string;
}

export interface CustomMetric {
  id: string;
  name: string;
  instruction: string | null;
  unit: string;
  is_active: boolean;
  order_index: number;
}

export interface MetricLog {
  id: string;
  metric_id: string;
  date: string;
  value: number;
}

export interface ChatThread {
  id: string;
  category: 'general' | 'workout' | 'nutrition' | 'metrics';
  title: string;
}

export interface Message {
  id: string;
  thread_id: string;
  sender_role: 'athlete' | 'coach';
  text: string;
  reply_to_text: string | null;
  created_at: string;
}

export interface Recipe {
  id: string;
  title: string;
  description: string | null;
  ingredients: string | null;
  calories: number;
  proteins: number;
  fats: number;
  carbs: number;
  video_url: string | null;
  image_url: string | null;
  language: string;
  is_premium: boolean;
}
