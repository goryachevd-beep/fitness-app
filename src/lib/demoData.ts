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
  { id: 'demo-general', category: 'general', title: 'Общий' },
  { id: 'demo-workout', category: 'workout', title: 'Тренировки' },
  { id: 'demo-nutrition', category: 'nutrition', title: 'Питание' },
];

export const DEMO_MESSAGES: Message[] = [
  // Общий
  { id: 'g1', thread_id: 'demo-general', sender_role: 'coach', text: 'Привет! Добро пожаловать — каждую неделю будем сверять прогресс и корректировать план.', reply_to_text: null, created_at: '2026-08-23T10:00:00Z' },
  { id: 'g2', thread_id: 'demo-general', sender_role: 'athlete', text: 'Спасибо, готов работать!', reply_to_text: null, created_at: '2026-08-23T10:15:00Z' },
  // Тренировки
  { id: 'w1', thread_id: 'demo-workout', sender_role: 'coach', text: 'На этой неделе держим технику в приседе, не гонимся за весом.', reply_to_text: null, created_at: '2026-08-24T15:40:00Z' },
  { id: 'w2', thread_id: 'demo-workout', sender_role: 'athlete', text: 'Понял, сделаю акцент на технике.', reply_to_text: null, created_at: '2026-08-24T16:20:00Z' },
  { id: 'w3', thread_id: 'demo-workout', sender_role: 'coach', text: 'Отлично, продолжай в том же духе!', reply_to_text: null, created_at: '2026-08-25T09:10:00Z' },
  // Питание
  { id: 'n1', thread_id: 'demo-nutrition', sender_role: 'coach', text: 'На этой неделе держим 2700 ккал — белок 165 г, углеводы 320 г в тренировочные дни.', reply_to_text: null, created_at: '2026-08-24T12:00:00Z' },
  { id: 'n2', thread_id: 'demo-nutrition', sender_role: 'athlete', text: 'Понял, буду следить за КБЖУ.', reply_to_text: null, created_at: '2026-08-24T12:30:00Z' },
];

export interface DemoMetric {
  id: string;
  name: string;
  unit: string;
  is_active: boolean;
  order_index: number;
  instruction: string | null;
  logs: { date: string; value: number }[];
}

export const DEMO_METRICS: DemoMetric[] = [
  { id: 'demo-m1', name: 'Талия (по пупку)', unit: 'см', is_active: true, order_index: 0, instruction: 'Измерять утром натощак', logs: [{ date: '2026-06-01', value: 84 }, { date: '2026-07-01', value: 81 }, { date: '2026-08-01', value: 78 }] },
  { id: 'demo-m2', name: 'Грудь', unit: 'см', is_active: true, order_index: 1, instruction: 'Измерять по самым выступающим точкам', logs: [{ date: '2026-06-01', value: 106 }, { date: '2026-07-01', value: 104 }, { date: '2026-08-01', value: 103 }] },
  { id: 'demo-m3', name: 'Живот', unit: 'см', is_active: true, order_index: 2, instruction: 'Измерять по самому выступающему месту', logs: [{ date: '2026-06-01', value: 88 }, { date: '2026-07-01', value: 84 }, { date: '2026-08-01', value: 80.5 }] },
];
