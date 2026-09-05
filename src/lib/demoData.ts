import type { DailyLog, NutritionTargets, WorkoutDay, ChatThread, Message } from '@/lib/types';

export const DEMO_LOGS: DailyLog[] = [
  { id: 'demo-1', date: '2026-08-24', weight: 78.4, steps: 9200, sleep_quality: 4, calories: 2850, proteins: 165, fats: 85, carbs: 320, weight_ema: 78.6, weekly_tdee: 2900, weekly_target_calories: 2700 },
  { id: 'demo-2', date: '2026-08-25', weight: 78.2, steps: 11400, sleep_quality: 5, calories: 2700, proteins: 170, fats: 80, carbs: 300, weight_ema: 78.5, weekly_tdee: 2900, weekly_target_calories: 2700 },
  { id: 'demo-3', date: '2026-08-26', weight: 78.1, steps: 8700, sleep_quality: 3, calories: 2950, proteins: 160, fats: 90, carbs: 340, weight_ema: 78.4, weekly_tdee: 2900, weekly_target_calories: 2700 },
];

export const DEMO_TARGETS: NutritionTargets = {
  id: 'demo-targets',
  mode: 'uniform',
  uniform_calories: 2700,
  training_calories: 2900,
  rest_calories: 2500,
  protein: 165,
  training_carbs: 320,
  rest_carbs: 280,
  fats: 80,
  updated_at: '2026-08-24T00:00:00Z',
};

export const DEMO_TODAY_WORKOUT: WorkoutDay = {
  id: 'demo-w',
  week_number: 1,
  day_name: 'Кроссфит',
  title: 'Кроссфит',
  name: 'Кроссфит',
  date: '2026-08-26',
  template_id: null,
  user_id: null,
  notes: 'Кроссфит (45 мин)',
  completed: true,
};

export const DEMO_WORKOUT_DAYS: WorkoutDay[] = [
  { id: 'demo-day-1', week_number: 1, day_name: 'Кроссфит', title: 'Кроссфит', name: 'Кроссфит', date: '2026-08-24', template_id: null, user_id: null, notes: 'Кроссфит (50 мин)', completed: true },
  { id: 'demo-day-2', week_number: 1, day_name: 'Тренировка ног', title: 'Тренировка ног', name: 'Тренировка ног', date: '2026-08-22', template_id: null, user_id: null, notes: '5 упр. · 3200 кг · 140 подъёмов', completed: true },
];

export interface DemoExercise {
  title: string;
  setsSummary: string;
}

export const DEMO_DAY_EXERCISES: Record<string, DemoExercise[]> = {
  'demo-day-1': [
    { title: 'Приседания', setsSummary: '4 сет.: 80.0 кг × 8, 85.0 кг × 6, 90.0 кг × 5, 85.0 кг × 6' },
    { title: 'Жим лёжа', setsSummary: '3 сет.: 60.0 кг × 10, 65.0 кг × 8, 70.0 кг × 6' },
  ],
  'demo-day-2': [
    { title: 'Приседания', setsSummary: '5 сет.: 100.0 кг × 5, 100.0 кг × 5, 100.0 кг × 5, 100.0 кг × 5, 100.0 кг × 5' },
    { title: 'Жим лёжа', setsSummary: '3 сет.: 70.0 кг × 8, 72.5 кг × 6, 75.0 кг × 5' },
  ],
};

export const DEMO_THREADS: ChatThread[] = [
  { id: 'demo', category: 'workout', title: 'Тренировки' },
];

export const DEMO_MESSAGES: Message[] = [
  { id: 'd1', thread_id: 'demo', sender_role: 'coach', text: 'На этой неделе держим технику в приседе, не гонимся за весом.', reply_to_text: null, created_at: '2026-08-24T15:40:00Z' },
  { id: 'd2', thread_id: 'demo', sender_role: 'athlete', text: 'Понял, сделаю акцент на технике.', reply_to_text: null, created_at: '2026-08-24T16:20:00Z' },
  { id: 'd3', thread_id: 'demo', sender_role: 'coach', text: 'Отлично, продолжай в том же духе!', reply_to_text: null, created_at: '2026-08-25T09:10:00Z' },
];
