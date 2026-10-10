import { useEffect, useState } from 'react';
import { Flame, TrendingDown, Footprints, Moon, Play, Plus, X, Check, RefreshCw, Dumbbell, Clock, Sparkles, History, Target, Zap, Award } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import type { DailyLog, NutritionTargets, WorkoutDay } from '@/lib/types';
import { Card, Loader, Toast } from '@/components/ui';
import { LineChart } from '@/components/LineChart';
import { todayISO, yesterdayISO, dedupLogsByDate } from '@/lib/calc';
import { initiateGoogleFitAuth, trySyncFromSession, fetchStepsForRange, getCachedProviderToken, SYNC_FLAG } from '@/lib/googleFit';
import { useAuthUser } from '@/lib/useAuthUser';
import { DEMO_LOGS, DEMO_TARGETS, DEMO_TODAY_WORKOUT } from '@/lib/demoData';
import { MOTIVATIONAL_QUOTES } from '@/lib/motivationalQuotes';

const STEP_TARGET = 10000;
const SLEEP_TARGET = 5;

function getDayIndex(date: Date, length: number): number {
  const epoch = new Date(2026, 0, 1);
  const daysSinceEpoch = Math.floor((date.getTime() - epoch.getTime()) / 86400000);
  return ((daysSinceEpoch % length) + length) % length;
}

type InsightLog = Pick<DailyLog, 'date' | 'weight' | 'calories' | 'proteins' | 'fats' | 'carbs' | 'steps' | 'sleep_quality'>;

function localDateISO(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function rusDay(n: number): string {
  const mod10 = n % 10;
  const mod100 = n % 100;
  if (mod100 >= 11 && mod100 <= 14) return 'дней';
  if (mod10 === 1) return 'день';
  if (mod10 >= 2 && mod10 <= 4) return 'дня';
  return 'дней';
}

function mergeStepsIntoLogs(prev: DailyLog[] | null, perDay: { date: string; steps: number }[]): DailyLog[] | null {
  if (!prev) return prev;
  const updated = [...prev];
  for (const day of perDay) {
    const idx = updated.findIndex((l) => l.date === day.date);
    if (idx >= 0) {
      updated[idx] = { ...updated[idx], steps: day.steps };
    } else {
      updated.push({ id: 'tmp', date: day.date, weight: null, steps: day.steps, sleep_quality: null, calories: 0, proteins: 0, fats: 0, carbs: 0, weight_ema: null, weekly_tdee: null, weekly_target_calories: null, day_type: null, created_at: new Date().toISOString() });
    }
  }
  updated.sort((a, b) => a.date.localeCompare(b.date));
  return updated;
}

function ProgressBar({ pct, tone }: { pct: number; tone: string }) {
  const toneMap: Record<string, string> = {
    brand: 'from-brand-500 to-brand-400',
    emerald: 'from-emerald-500 to-emerald-400',
    amber: 'from-amber-500 to-amber-400',
    sky: 'from-sky-500 to-sky-400',
    lime: 'from-lime-500 to-lime-400',
  };
  return (
    <div className="h-1.5 overflow-hidden rounded-full bg-ink-700">
      <div className={`h-full rounded-full bg-gradient-to-r ${toneMap[tone] ?? toneMap.brand} transition-all duration-700`} style={{ width: `${Math.min(pct, 100)}%` }} />
    </div>
  );
}

function WeightModal({
  open,
  onClose,
  defaultDate,
  existing,
  isDemo,
  onSaved,
}: {
  open: boolean;
  onClose: () => void;
  defaultDate: string;
  existing: DailyLog | null;
  isDemo: boolean;
  onSaved: (date: string, weight: number) => void;
}) {
  const [date, setDate] = useState(defaultDate);
  const [weight, setWeight] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setDate(defaultDate);
    setWeight(existing && existing.weight ? String(existing.weight) : '');
  }, [open, defaultDate, existing]);

  if (!open) return null;

  async function save() {
    const w = Number(weight);
    if (!weight || Number.isNaN(w)) return;
    setSaving(true);
    await supabase.from('daily_logs').upsert({ date, weight: w }, { onConflict: 'date' });
    onSaved(date, w);
    setSaving(false);
    onClose();
  }

  const inputCls = 'w-full rounded-xl border border-ink-600 bg-ink-950 px-4 py-3 text-lg font-bold text-white outline-none focus:border-brand-500';
  const labelCls = 'mb-1 text-xs font-semibold text-slate-400';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4" onClick={onClose}>
      <div className="w-full max-w-sm rounded-2xl border border-ink-700 bg-ink-900 p-5" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-bold text-white">Ввод веса</h3>
          <button onClick={onClose} className="text-slate-500 hover:text-slate-300"><X className="h-5 w-5" /></button>
        </div>

        <div className="mt-4">
          <label className={labelCls}>Дата</label>
          <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className={inputCls} />
        </div>

        <div className="mt-4">
          <label className={labelCls}>Вес, кг</label>
          <input type="number" inputMode="decimal" step="0.1" value={weight} onChange={(e) => setWeight(e.target.value)} placeholder="0.0" autoFocus className={inputCls} />
        </div>

        <div className="mt-5 flex gap-3">
          <button onClick={onClose} disabled={saving} className="flex-1 rounded-xl border border-ink-600 bg-ink-800 py-3 font-bold text-slate-200 hover:bg-ink-700 disabled:opacity-50">Отмена</button>
          <button onClick={save} disabled={saving || isDemo || !weight} className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-brand-500 py-3 font-bold text-ink-950 transition-transform hover:scale-[1.02] active:scale-95 disabled:opacity-40">
            {saving ? <><RefreshCw className="h-4 w-4 animate-spin" /> Сохранение...</> : <><Check className="h-4 w-4" /> Сохранить</>}
          </button>
        </div>
      </div>
    </div>
  );
}

function NutritionModal({
  open,
  onClose,
  defaultDate,
  existing,
  isDemo,
  onSaved,
}: {
  open: boolean;
  onClose: () => void;
  defaultDate: string;
  existing: DailyLog | null;
  isDemo: boolean;
  onSaved: (date: string, patch: { calories: number; proteins: number; fats: number; carbs: number }) => void;
}) {
  const [date, setDate] = useState(defaultDate);
  const [calories, setCalories] = useState('');
  const [proteins, setProteins] = useState('');
  const [fats, setFats] = useState('');
  const [carbs, setCarbs] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setDate(defaultDate);
    setCalories(existing ? String(existing.calories) : '');
    setProteins(existing ? String(existing.proteins) : '');
    setFats(existing ? String(existing.fats) : '');
    setCarbs(existing ? String(existing.carbs) : '');
  }, [open, defaultDate, existing]);

  if (!open) return null;

  async function save() {
    const c = Number(calories) || 0;
    const p = Number(proteins) || 0;
    const f = Number(fats) || 0;
    const cb = Number(carbs) || 0;
    setSaving(true);
    await supabase.from('daily_logs').upsert({ date, calories: c, proteins: p, fats: f, carbs: cb }, { onConflict: 'date' });
    onSaved(date, { calories: c, proteins: p, fats: f, carbs: cb });
    setSaving(false);
    onClose();
  }

  const inputCls = 'w-full rounded-xl border border-ink-600 bg-ink-950 px-4 py-3 text-lg font-bold text-white outline-none focus:border-brand-500';
  const labelCls = 'mb-1 text-xs font-semibold text-slate-400';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4" onClick={onClose}>
      <div className="w-full max-w-sm rounded-2xl border border-ink-700 bg-ink-900 p-5" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-bold text-white">Ввод КБЖУ и данных</h3>
          <button onClick={onClose} className="text-slate-500 hover:text-slate-300"><X className="h-5 w-5" /></button>
        </div>

        <div className="mt-4">
          <label className={labelCls}>Дата</label>
          <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className={inputCls} />
        </div>

        <div className="mt-4 grid grid-cols-2 gap-3">
          <div>
            <label className={labelCls}>Калории, ккал</label>
            <input type="number" inputMode="numeric" value={calories} onChange={(e) => setCalories(e.target.value)} placeholder="0" className={inputCls} />
          </div>
          <div>
            <label className={labelCls}>Белки, г</label>
            <input type="number" inputMode="numeric" value={proteins} onChange={(e) => setProteins(e.target.value)} placeholder="0" className={inputCls} />
          </div>
          <div>
            <label className={labelCls}>Жиры, г</label>
            <input type="number" inputMode="numeric" value={fats} onChange={(e) => setFats(e.target.value)} placeholder="0" className={inputCls} />
          </div>
          <div>
            <label className={labelCls}>Углеводы, г</label>
            <input type="number" inputMode="numeric" value={carbs} onChange={(e) => setCarbs(e.target.value)} placeholder="0" className={inputCls} />
          </div>
        </div>

        <div className="mt-5 flex gap-3">
          <button onClick={onClose} disabled={saving} className="flex-1 rounded-xl border border-ink-600 bg-ink-800 py-3 font-bold text-slate-200 hover:bg-ink-700 disabled:opacity-50">Отмена</button>
          <button onClick={save} disabled={saving || isDemo} className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-brand-500 py-3 font-bold text-ink-950 transition-transform hover:scale-[1.02] active:scale-95 disabled:opacity-40">
            {saving ? <><RefreshCw className="h-4 w-4 animate-spin" /> Сохранение...</> : <><Check className="h-4 w-4" /> Сохранить</>}
          </button>
        </div>
      </div>
    </div>
  );
}

function StepsModal({
  open,
  onClose,
  defaultDate,
  existing,
  isDemo,
  onSaved,
}: {
  open: boolean;
  onClose: () => void;
  defaultDate: string;
  existing: DailyLog | null;
  isDemo: boolean;
  onSaved: (date: string, steps: number) => void;
}) {
  const [date, setDate] = useState(defaultDate);
  const [steps, setSteps] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setDate(defaultDate);
    setSteps(existing && existing.steps ? String(existing.steps) : '');
  }, [open, defaultDate, existing]);

  if (!open) return null;

  async function save() {
    const s = Number(steps) || 0;
    setSaving(true);
    await supabase.from('daily_logs').upsert({ date, steps: s }, { onConflict: 'date' });
    onSaved(date, s);
    setSaving(false);
    onClose();
  }

  const inputCls = 'w-full rounded-xl border border-ink-600 bg-ink-950 px-4 py-3 text-lg font-bold text-white outline-none focus:border-brand-500';
  const labelCls = 'mb-1 text-xs font-semibold text-slate-400';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4" onClick={onClose}>
      <div className="w-full max-w-sm rounded-2xl border border-ink-700 bg-ink-900 p-5" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-bold text-white">Ввод шагов</h3>
          <button onClick={onClose} className="text-slate-500 hover:text-slate-300"><X className="h-5 w-5" /></button>
        </div>

        <div className="mt-4">
          <label className={labelCls}>Дата</label>
          <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className={inputCls} />
        </div>

        <div className="mt-4">
          <label className={labelCls}>Шаги</label>
          <input type="number" inputMode="numeric" value={steps} onChange={(e) => setSteps(e.target.value)} placeholder="0" autoFocus className={inputCls} />
        </div>

        <div className="mt-5 flex gap-3">
          <button onClick={onClose} disabled={saving} className="flex-1 rounded-xl border border-ink-600 bg-ink-800 py-3 font-bold text-slate-200 hover:bg-ink-700 disabled:opacity-50">Отмена</button>
          <button onClick={save} disabled={saving || isDemo} className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-brand-500 py-3 font-bold text-ink-950 transition-transform hover:scale-[1.02] active:scale-95 disabled:opacity-40">
            {saving ? <><RefreshCw className="h-4 w-4 animate-spin" /> Сохранение...</> : <><Check className="h-4 w-4" /> Сохранить</>}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function Dashboard({ onStartWorkout, isDemo }: { onStartWorkout: () => void; isDemo: boolean }) {
  const { user } = useAuthUser();
  const [logs, setLogs] = useState<DailyLog[] | null>(null);
  const [targets, setTargets] = useState<NutritionTargets | null>(null);
  const [weightModal, setWeightModal] = useState(false);
  const [nutritionModal, setNutritionModal] = useState(false);
  const [nutritionDate, setNutritionDate] = useState(yesterdayISO());
  const [stepsModal, setStepsModal] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [stepsSyncing, setStepsSyncing] = useState(false);
  const [toast, setToast] = useState<{ message: string; tone: 'success' | 'error' } | null>(null);
  const [todayWorkout, setTodayWorkout] = useState<WorkoutDay | null>(null);
  const [yesterdayWorkout, setYesterdayWorkout] = useState<WorkoutDay | null>(null);
  const [showSleepCheckin, setShowSleepCheckin] = useState(false);
  const [sleepSaving, setSleepSaving] = useState(false);
  const [allLogs, setAllLogs] = useState<InsightLog[] | null>(null);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 4000);
    return () => clearTimeout(t);
  }, [toast]);

  useEffect(() => {
    if (isDemo) {
      setLogs(DEMO_LOGS);
      setTargets(DEMO_TARGETS);
      setTodayWorkout(DEMO_TODAY_WORKOUT);
      return;
    }
    (async () => {
      const { data: logData } = await supabase.from('daily_logs').select('*').order('date', { ascending: true });
      const { data: targetData } = await supabase.from('nutrition_targets').select('*').maybeSingle();
      setLogs(dedupLogsByDate((logData as DailyLog[]) ?? []));
      setTargets(targetData as NutritionTargets | null);

      const { data: insightData } = await supabase.from('daily_logs').select('date,weight,calories,proteins,fats,carbs,steps,sleep_quality').order('date', { ascending: false }).limit(500);
      setAllLogs((insightData as InsightLog[]) ?? []);

      const { data: workoutData } = await supabase.from('workout_days').select('*').eq('date', todayISO()).order('created_at', { ascending: false }).limit(1).maybeSingle();
      setTodayWorkout(workoutData as WorkoutDay | null);

      const { data: yWorkoutData } = await supabase.from('workout_days').select('*').eq('date', yesterdayISO()).order('created_at', { ascending: false }).limit(1).maybeSingle();
      setYesterdayWorkout(yWorkoutData as WorkoutDay | null);

      const syncedSteps = await trySyncFromSession();
      if (syncedSteps != null) {
        setLogs((prev) => {
          if (!prev) return prev;
          const updated = [...prev];
          const last = updated[updated.length - 1];
          if (last && last.date === todayISO()) {
            updated[updated.length - 1] = { ...last, steps: syncedSteps };
          } else {
            updated.push({ id: 'tmp', date: todayISO(), weight: null, steps: syncedSteps, sleep_quality: null, calories: 0, proteins: 0, fats: 0, carbs: 0, weight_ema: null, weekly_tdee: null, weekly_target_calories: null, day_type: null, created_at: new Date().toISOString() });
          }
          return updated;
        });
        setToast({ message: `Синхронизировано ${syncedSteps.toLocaleString('ru-RU')} шагов за сегодня!`, tone: 'success' });
      }

      const { data: bgSession } = await supabase.auth.getSession();
      const bgToken = bgSession.session?.provider_token ?? getCachedProviderToken();
      if (bgToken && !sessionStorage.getItem(SYNC_FLAG)) {
        try {
          const bgResult = await fetchStepsForRange(bgToken);
          setLogs((prev) => mergeStepsIntoLogs(prev, bgResult.perDay));
        } catch {
          // Silent: missing scope or other failure — skip
        }
      }
    })();
  }, [isDemo]);

  useEffect(() => {
    if (!logs || isDemo) return;
    const todayLog = logs.find((l) => l.date === todayISO());
    if (todayLog && todayLog.sleep_quality == null) {
      setShowSleepCheckin(true);
    }
  }, [logs, isDemo]);

  async function handleSleepCheckin(q: number) {
    setSleepSaving(true);
    try {
      await saveSleep(q);
    } finally {
      setSleepSaving(false);
      setShowSleepCheckin(false);
    }
  }

  async function saveSleep(q: number) {
    if (isDemo) return;
    await supabase.from('daily_logs').upsert({ date: todayISO(), sleep_quality: q }, { onConflict: 'date' });
    setLogs((prev) => {
      if (!prev) return prev;
      const updated = [...prev];
      const last = updated[updated.length - 1];
      if (last && last.date === todayISO()) {
        updated[updated.length - 1] = { ...last, sleep_quality: q };
      } else {
        updated.push({ id: 'tmp', date: todayISO(), weight: null, steps: 0, sleep_quality: q, calories: 0, proteins: 0, fats: 0, carbs: 0, weight_ema: null, weekly_tdee: null, weekly_target_calories: null, day_type: null, created_at: new Date().toISOString() });
      }
      return updated;
    });
  }

  async function handleSync() {
    setSyncing(true);
    try {
      await handleStepsSync();
    } finally {
      setSyncing(false);
    }
  }

  async function handleStepsSync() {
    setStepsSyncing(true);
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const sessionToken = sessionData.session?.provider_token ?? null;
      const cachedToken = getCachedProviderToken();
      const providerToken = sessionToken ?? cachedToken;
      if (providerToken) {
        try {
          const result = await fetchStepsForRange(providerToken);
          setLogs((prev) => mergeStepsIntoLogs(prev, result.perDay));
          setToast({ message: `Синхронизировано ${result.todaySteps.toLocaleString('ru-RU')} шагов за сегодня!`, tone: 'success' });
        } catch (err) {
          const message = err instanceof Error ? err.message : '';
          if (message.includes('403') || message.includes('insufficient') || message.includes('PERMISSION_DENIED') || message.includes('ACCESS_TOKEN_SCOPE_INSUFFICIENT')) {
            initiateGoogleFitAuth();
            return;
          }
          throw err;
        }
      } else {
        initiateGoogleFitAuth();
      }
    } catch (e) {
      setToast({ message: e instanceof Error ? e.message : 'Ошибка синхронизации шагов', tone: 'error' });
    } finally {
      setStepsSyncing(false);
    }
  }

  if (!logs) return <Loader />;
  if (logs.length === 0) return <p className="py-20 text-center text-slate-500">Дневник пуст</p>;

  const today = logs[logs.length - 1];
  const todayLog = logs.find((l) => l.date === todayISO()) ?? null;
  const weightLogs = logs.filter((l) => l.weight != null);
  const emaData = weightLogs.slice(-30).map((l) => Number(l.weight_ema ?? l.weight));
  const lastEma = emaData[emaData.length - 1] ?? 0;
  const recent7 = emaData.slice(-7);
  const prev7 = emaData.slice(-14, -7);
  const recentAvg = recent7.length ? recent7.reduce((a, b) => a + b, 0) / recent7.length : 0;
  const prevAvg = prev7.length ? prev7.reduce((a, b) => a + b, 0) / prev7.length : 0;
  const weeklyDelta = prevAvg ? recentAvg - prevAvg : 0;

  // ── Today's plan targets ──
  // Day type is determined solely by whether a workout is scheduled/logged for today.
  // The daily_logs.day_type column defaults to 'training' and is not reliable for this decision.
  const isTrainingDay = !!todayWorkout;
  const todayCalTarget = targets
    ? targets.mode === 'split'
      ? isTrainingDay ? targets.training_calories : targets.rest_calories
      : targets.uniform_calories
    : 0;
  const todayCarbTarget = targets
    ? targets.mode === 'split'
      ? isTrainingDay ? targets.training_carbs : targets.rest_carbs
      : targets.training_carbs
    : 0;
  const todayProteinTarget = targets?.protein ?? 0;
  const todayFatTarget = targets?.fats ?? 0;

  const workoutName = todayWorkout?.name ?? todayWorkout?.day_name ?? todayWorkout?.title ?? null;
  const workoutDuration = todayWorkout?.notes?.match(/\((\d+)\s*мин\)/)?.[1] ?? null;
  const workoutDone = todayWorkout?.completed ?? false;

  // ── Today's progress ──
  const calPct = todayCalTarget > 0 ? ((todayLog?.calories ?? 0) / todayCalTarget) * 100 : 0;
  const proteinPct = todayProteinTarget > 0 ? ((todayLog?.proteins ?? 0) / todayProteinTarget) * 100 : 0;
  const stepPct = ((todayLog?.steps ?? 0) / STEP_TARGET) * 100;

  // ── Overall progress ──
  const weightChartLabels = weightLogs.slice(-14).map((l) => {
    const d = new Date(l.date + 'T00:00:00');
    return { label: `${d.getDate()}.${d.getMonth() + 1}`, value: Number(l.weight_ema ?? l.weight) };
  });
  const last7ForAvg = logs.slice(-7);
  const avgSteps7 = last7ForAvg.length ? Math.round(last7ForAvg.reduce((s, l) => s + l.steps, 0) / last7ForAvg.length) : 0;
  const sleepLogs7 = last7ForAvg.filter((l) => l.sleep_quality != null);
  const avgSleep7 = sleepLogs7.length ? sleepLogs7.reduce((s, l) => s + (l.sleep_quality ?? 0), 0) / sleepLogs7.length : 0;

  // ── Coach assignment ──
  const weekAgo = new Date();
  weekAgo.setDate(weekAgo.getDate() - 6);
  const weekAgoISO = weekAgo.toISOString().slice(0, 10);
  const weekLogs = logs.filter((l) => l.date >= weekAgoISO);
  const completedDays = weekLogs.filter((l) => l.calories > 0 || l.steps > 0).length;
  const coachInstruction = targets
    ? `Удерживайте ${todayCalTarget.toLocaleString('ru-RU')} ккал, ${STEP_TARGET.toLocaleString('ru-RU')} шагов и регулярные тренировки каждую неделю.`
    : 'Следуйте плану тренера для достижения целей.';

  // ── Yesterday compact ──
  const yLog = logs.find((l) => l.date === yesterdayISO()) ?? null;
  const yIsTraining = !!yesterdayWorkout;
  const yCalTarget = targets
    ? targets.mode === 'split'
      ? yIsTraining ? targets.training_calories : targets.rest_calories
      : targets.uniform_calories
    : 0;
  const yProteinTarget = targets?.protein ?? 0;
  const yPct = yLog && yCalTarget > 0 ? Math.round((yLog.calories / yCalTarget) * 100) : 0;

  // ── Header ──
  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Доброе утро' : hour < 18 ? 'Добрый день' : 'Добрый вечер';
  const todayDateLabel = new Date().toLocaleDateString('ru-RU', { weekday: 'long', day: 'numeric', month: 'long' });
  const todayQuote = MOTIVATIONAL_QUOTES[getDayIndex(new Date(), MOTIVATIONAL_QUOTES.length)];

  const insight = (() => {
    if (isDemo) return { text: '🔥 12 дней подряд с записью — не останавливайся!', tone: 'streak' as const };

    const now = new Date();
    const hour = now.getHours();
    const todayStr = todayISO();
    const todayEntry = logs.find((l) => l.date === todayStr) ?? null;

    // 1. Evening reminder
    if (hour >= 20) {
      const missing: string[] = [];
      if (!todayEntry?.calories) missing.push('питание');
      if (todayEntry?.sleep_quality == null) missing.push('сон');
      if (todayEntry?.weight == null) missing.push('вес');
      if (!todayEntry?.steps) missing.push('шаги');

      if (missing.length >= 3) return { text: 'Не забудь внести данные за сегодня', tone: 'reminder' as const };
      if (missing.length === 2) return { text: `Не забудь внести ${missing[0]} и ${missing[1]} за сегодня`, tone: 'reminder' as const };
      if (missing.length === 1) return { text: `Не забудь внести ${missing[0]} за сегодня`, tone: 'reminder' as const };
    }

    // 2. Weight trend praise — goal mode field not available in schema, skip

    // 3. Streak
    const hasEntry = (l: { weight: number | null; calories: number; steps: number; sleep_quality: number | null } | undefined): boolean => {
      if (!l) return false;
      return l.weight != null || l.calories > 0 || l.steps > 0 || l.sleep_quality != null;
    };

    const logMap = new Map<string, boolean>();
    for (const l of (allLogs ?? [])) logMap.set(l.date, hasEntry(l));
    for (const l of logs) logMap.set(l.date, hasEntry(l));

    const todayHasEntry = logMap.get(todayStr) ?? false;
    const cursor = new Date();
    if (!todayHasEntry) cursor.setDate(cursor.getDate() - 1);

    let streak = 0;
    while (logMap.get(localDateISO(cursor))) {
      streak++;
      cursor.setDate(cursor.getDate() - 1);
    }

    if (streak >= 2) {
      return { text: `🔥 ${streak} ${rusDay(streak)} подряд с записью — не останавливайся!`, tone: 'streak' as const };
    }

    return null;
  })();

  function statusLabel(pct: number): string {
    return pct >= 100 ? 'Готово' : pct >= 75 ? 'На пути' : 'Внимание';
  }
  function statusColor(pct: number): string {
    return pct >= 100 ? 'text-emerald-400' : pct >= 75 ? 'text-brand-400' : 'text-amber-400';
  }

  return (
    <div className="animate-fade-up space-y-5">
      {/* ── 1. HEADER ── */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-sm text-slate-400">{greeting},</p>
          <h1 className="text-2xl font-extrabold text-white">{user?.displayName ?? 'Гость'}</h1>
          <p className="mt-0.5 text-sm capitalize text-slate-500">{todayDateLabel}</p>
          {insight && <p className={`mt-1 text-sm ${insight.tone === 'reminder' ? 'text-amber-400/80' : 'text-brand-300/80'}`}>{insight.text}</p>}
        </div>
        {!isDemo && (
          <button
            onClick={handleSync}
            disabled={syncing}
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-ink-700 bg-ink-850 text-slate-400 transition-colors hover:border-brand-500/50 hover:text-brand-300 disabled:opacity-50"
            title="Синхронизировать данные"
          >
            <RefreshCw className={`h-4 w-4 ${syncing ? 'animate-spin' : ''}`} />
          </button>
        )}
      </div>

      {/* ── 2. TODAY'S PLAN ── */}
      {targets && (
        <Card className="border-brand-500/25 bg-brand-500/[0.04] p-5">
          <div className="flex items-center gap-2">
            <Target className="h-5 w-5 text-brand-400" />
            <h2 className="text-lg font-bold text-white">План на сегодня</h2>
            <span className="ml-auto rounded-lg border border-ink-600 bg-ink-850 px-2.5 py-1 text-xs font-semibold text-slate-400">
              {isTrainingDay ? 'Тренировочный день' : 'День отдыха'}
            </span>
            {targets.mode === 'split' && (
              <span className={`ml-1 rounded-lg px-2 py-1 text-xs font-bold ${isTrainingDay ? 'bg-brand-500/15 text-brand-300' : 'bg-slate-500/15 text-slate-400'}`}>
                {todayCalTarget.toLocaleString('ru-RU')} ккал
              </span>
            )}
          </div>

          {/* Calorie target */}
          <div className="mt-4">
            <p className="text-3xl font-extrabold text-white">
              {todayCalTarget.toLocaleString('ru-RU')}
              <span className="ml-1.5 text-base font-semibold text-slate-500">ккал</span>
            </p>
          </div>

          {/* Macro targets */}
          <div className="mt-3 flex flex-wrap gap-2">
            <span className="rounded-lg border border-emerald-500/20 bg-emerald-500/10 px-3 py-1.5 text-xs font-semibold text-emerald-300">Белки {todayProteinTarget}г</span>
            <span className="rounded-lg border border-amber-500/20 bg-amber-500/10 px-3 py-1.5 text-xs font-semibold text-amber-300">Жиры {todayFatTarget}г</span>
            <span className="rounded-lg border border-sky-500/20 bg-sky-500/10 px-3 py-1.5 text-xs font-semibold text-sky-300">Углеводы {todayCarbTarget}г</span>
          </div>

          {/* Workout */}
          <div className={`mt-4 rounded-xl border p-3.5 ${isTrainingDay ? 'border-brand-500/30 bg-brand-500/5' : 'border-ink-700 bg-ink-850'}`}>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className={`flex h-9 w-9 items-center justify-center rounded-lg ${isTrainingDay ? 'bg-brand-500/15' : 'bg-slate-500/10'}`}>
                  {isTrainingDay ? <Dumbbell className="h-4.5 w-4.5 text-brand-300" /> : <Moon className="h-4.5 w-4.5 text-slate-400" />}
                </div>
                <div>
                  <p className="text-sm font-bold text-white">{isTrainingDay ? (workoutName ?? 'Тренировка') : 'День отдыха'}</p>
                  {workoutDuration && <p className="text-xs text-slate-400">~{workoutDuration} мин</p>}
                </div>
              </div>
              {workoutDone ? (
                <span className="flex items-center gap-1 rounded-lg bg-emerald-500/15 px-3 py-1.5 text-xs font-bold text-emerald-400">
                  <Check className="h-3.5 w-3.5" /> Выполнено
                </span>
              ) : isTrainingDay ? (
                <button
                  onClick={onStartWorkout}
                  disabled={isDemo}
                  className="flex items-center gap-1.5 rounded-lg bg-brand-500 px-4 py-2 text-sm font-bold text-ink-950 transition-transform hover:scale-[1.03] active:scale-95 disabled:opacity-50"
                >
                  <Play className="h-3.5 w-3.5 fill-ink-950" /> Старт
                </button>
              ) : (
                <span className="rounded-lg bg-slate-500/10 px-3 py-1.5 text-xs font-bold text-slate-400">Отдых</span>
              )}
            </div>
          </div>

          {/* Steps + Sleep targets */}
          <div className="mt-3 grid grid-cols-2 gap-3">
            <div className="flex items-center gap-2.5 rounded-xl border border-ink-700 bg-ink-850 p-3">
              <Footprints className="h-4 w-4 text-lime-400" />
              <div>
                <p className="text-sm font-bold text-white">{STEP_TARGET.toLocaleString('ru-RU')}</p>
                <p className="text-xs text-slate-400">шагов</p>
              </div>
            </div>
            <div className="flex items-center gap-2.5 rounded-xl border border-ink-700 bg-ink-850 p-3">
              <Moon className="h-4 w-4 text-sky-300" />
              <div>
                <p className="text-sm font-bold text-white">{SLEEP_TARGET}/5</p>
                <p className="text-xs text-slate-400">качество сна</p>
              </div>
            </div>
          </div>
        </Card>
      )}

      {/* ── 3. TODAY'S PROGRESS ── */}
      <Card className="p-5">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold text-white">Прогресс сегодня</h2>
          <div className="flex gap-1.5">
            <button onClick={() => { setNutritionDate(todayISO()); setNutritionModal(true); }} disabled={isDemo} className="flex h-7 w-7 items-center justify-center rounded-lg border border-ink-600 bg-ink-800 text-slate-400 transition-colors hover:border-brand-500/50 hover:text-brand-300 disabled:opacity-30" title="Ввести КБЖУ">
              <Flame className="h-3.5 w-3.5" />
            </button>
            <button onClick={() => setStepsModal(true)} disabled={isDemo} className="flex h-7 w-7 items-center justify-center rounded-lg border border-ink-600 bg-ink-800 text-slate-400 transition-colors hover:border-lime-500/50 hover:text-lime-300 disabled:opacity-30" title="Ввести шаги">
              <Footprints className="h-3.5 w-3.5" />
            </button>
            <button onClick={() => setWeightModal(true)} disabled={isDemo} className="flex h-7 w-7 items-center justify-center rounded-lg border border-ink-600 bg-ink-800 text-slate-400 transition-colors hover:border-brand-500/50 hover:text-brand-300 disabled:opacity-30" title="Записать вес">
              <TrendingDown className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>

        {/* Calories + Protein + Steps + Workout grid */}
        <div className="mt-4 grid grid-cols-2 gap-3">
          <div className="rounded-xl border border-ink-700 bg-ink-850 p-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-400">Калории</span>
              <span className={`text-[11px] font-bold ${statusColor(calPct)}`}>{statusLabel(calPct)}</span>
            </div>
            <p className="mt-1.5 text-lg font-extrabold text-white">
              {(todayLog?.calories ?? 0).toLocaleString('ru-RU')}
              <span className="text-sm text-slate-500"> / {todayCalTarget.toLocaleString('ru-RU')}</span>
            </p>
            <div className="mt-2"><ProgressBar pct={calPct} tone="brand" /></div>
          </div>

          <div className="rounded-xl border border-ink-700 bg-ink-850 p-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-400">Белки</span>
              <span className={`text-[11px] font-bold ${statusColor(proteinPct)}`}>{statusLabel(proteinPct)}</span>
            </div>
            <p className="mt-1.5 text-lg font-extrabold text-white">
              {todayLog?.proteins ?? 0}
              <span className="text-sm text-slate-500"> / {todayProteinTarget} г</span>
            </p>
            <div className="mt-2"><ProgressBar pct={proteinPct} tone="emerald" /></div>
          </div>

          <div className="rounded-xl border border-ink-700 bg-ink-850 p-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-400">Шаги</span>
              <span className={`text-[11px] font-bold ${statusColor(stepPct)}`}>{statusLabel(stepPct)}</span>
            </div>
            <p className="mt-1.5 text-lg font-extrabold text-white">
              {(todayLog?.steps ?? 0).toLocaleString('ru-RU')}
              <span className="text-sm text-slate-500"> / {STEP_TARGET.toLocaleString('ru-RU')}</span>
            </p>
            <div className="mt-2"><ProgressBar pct={stepPct} tone="lime" /></div>
          </div>

          <div className="rounded-xl border border-ink-700 bg-ink-850 p-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-400">Тренировка</span>
              <span className={`text-[11px] font-bold ${workoutDone ? 'text-emerald-400' : isTrainingDay ? 'text-amber-400' : 'text-slate-500'}`}>
                {workoutDone ? 'Готово' : isTrainingDay ? 'Не выполнено' : 'Отдых'}
              </span>
            </div>
            <p className="mt-1.5 text-sm font-bold text-white">
              {workoutDone ? <span className="flex items-center gap-1"><Check className="h-4 w-4 text-emerald-400" /> Выполнено</span> : isTrainingDay ? (workoutName ?? 'Тренировка') : 'День отдыха'}
            </p>
            {!workoutDone && isTrainingDay && (
              <button onClick={onStartWorkout} disabled={isDemo} className="mt-2 flex items-center gap-1 rounded-lg bg-brand-500 px-3 py-1.5 text-xs font-bold text-ink-950 transition-transform hover:scale-[1.03] active:scale-95 disabled:opacity-50">
                <Play className="h-3 w-3 fill-ink-950" /> Старт
              </button>
            )}
          </div>
        </div>

        {/* Sleep */}
        <div className="mt-3 rounded-xl border border-ink-700 bg-ink-850 p-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-400">Сон</span>
            <span className={`text-[11px] font-bold ${(todayLog?.sleep_quality ?? 0) >= 4 ? 'text-emerald-400' : (todayLog?.sleep_quality ?? 0) >= 1 ? 'text-amber-400' : 'text-slate-500'}`}>
              {(todayLog?.sleep_quality ?? 0) >= 4 ? 'Готово' : (todayLog?.sleep_quality ?? 0) >= 1 ? 'Отмечено' : 'Не отмечен'}
            </span>
          </div>
          <p className="mt-1.5 text-lg font-extrabold text-white">
            {todayLog?.sleep_quality ?? '—'}<span className="text-sm text-slate-500"> / {SLEEP_TARGET}</span>
          </p>
          <div className="mt-2 flex items-center gap-1.5">
            {([
              { q: 5, label: 'Выспался', color: 'bg-emerald-500', ring: 'ring-emerald-400' },
              { q: 3, label: 'Недоспал', color: 'bg-amber-500', ring: 'ring-amber-400' },
              { q: 1, label: 'Не выспался', color: 'bg-red-500', ring: 'ring-red-400' },
            ] as const).map((opt) => (
              <button
                key={opt.q}
                onClick={() => saveSleep(opt.q)}
                disabled={isDemo}
                title={opt.label}
                className={`flex-1 flex flex-col items-center gap-1 rounded-lg border py-1.5 transition-all disabled:opacity-30 ${
                  todayLog?.sleep_quality === opt.q
                    ? `border-transparent ${opt.color} ring-2 ${opt.ring}`
                    : 'border-ink-600 bg-ink-800 hover:border-ink-500'
                }`}
              >
                <span className={`h-2.5 w-2.5 rounded-full ${opt.color}`} />
                <span className="text-[10px] font-medium text-slate-300">{opt.label}</span>
              </button>
            ))}
          </div>
        </div>
      </Card>

      {/* ── 4. COACH ASSIGNMENT ── */}
      <Card className="p-4">
        <div className="flex items-center gap-2">
          <Award className="h-5 w-5 text-brand-400" />
          <h2 className="text-base font-bold text-white">Задание от тренера</h2>
        </div>
        <p className="mt-2 text-sm leading-relaxed text-slate-300">{coachInstruction}</p>
        <div className="mt-3 flex items-center gap-3">
          <div className="flex-1"><ProgressBar pct={(completedDays / 7) * 100} tone="brand" /></div>
          <span className="shrink-0 text-sm font-bold text-white">{completedDays} / 7 дней</span>
        </div>
      </Card>

      {/* ── 5. OVERALL PROGRESS ── */}
      <Card className="p-5">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold text-white">Ваш прогресс</h2>
          <button
            onClick={() => setWeightModal(true)}
            disabled={isDemo}
            className="flex h-7 w-7 items-center justify-center rounded-lg border border-ink-600 bg-ink-800 text-slate-400 transition-colors hover:border-brand-500/50 hover:text-brand-300 disabled:opacity-30"
            title="Записать вес"
          >
            <Plus className="h-4 w-4" />
          </button>
        </div>
        <div className="mt-3 flex items-end justify-between">
          <div>
            <p className="text-3xl font-extrabold text-white">{lastEma.toFixed(1)}<span className="text-base text-slate-500"> кг</span></p>
            <p className={`mt-0.5 text-sm font-medium ${weeklyDelta <= 0 ? 'text-emerald-400' : 'text-amber-400'}`}>
              {weeklyDelta <= 0 ? '' : '+'}{weeklyDelta.toFixed(1)} кг за неделю
            </p>
          </div>
        </div>
        {weightChartLabels.length > 1 && (
          <div className="mt-3">
            <LineChart data={weightChartLabels} height={120} unit=" кг" />
          </div>
        )}
        <div className="mt-4 grid grid-cols-2 gap-3">
          <div className="flex items-center gap-2.5 rounded-xl border border-ink-700 bg-ink-850 p-3">
            <Footprints className="h-4 w-4 text-lime-400" />
            <div>
              <p className="text-sm font-bold text-white">{avgSteps7.toLocaleString('ru-RU')}</p>
              <p className="text-xs text-slate-400">шагов в среднем (7д)</p>
            </div>
          </div>
          <div className="flex items-center gap-2.5 rounded-xl border border-ink-700 bg-ink-850 p-3">
            <Moon className="h-4 w-4 text-sky-300" />
            <div>
              <p className="text-sm font-bold text-white">{avgSleep7 > 0 ? avgSleep7.toFixed(1) : '—'}/5</p>
              <p className="text-xs text-slate-400">сон в среднем (7д)</p>
            </div>
          </div>
        </div>
      </Card>

      {/* ── 6. YESTERDAY (compact) ── */}
      {yLog && (
        <Card className="p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <History className="h-4 w-4 text-slate-500" />
              <h3 className="text-sm font-bold text-white">Вчера — {yPct}%</h3>
            </div>
            <button
              onClick={() => { setNutritionDate(yesterdayISO()); setNutritionModal(true); }}
              disabled={isDemo}
              className="flex h-6 w-6 items-center justify-center rounded-lg border border-ink-600 bg-ink-800 text-slate-400 transition-colors hover:border-brand-500/50 hover:text-brand-300 disabled:opacity-30"
              title="Редактировать КБЖУ"
            >
              <Plus className="h-3.5 w-3.5" />
            </button>
          </div>
          <div className="mt-2.5 flex flex-wrap gap-x-4 gap-y-1 text-xs">
            <span className="font-medium text-slate-300">{yLog.calories.toLocaleString('ru-RU')}<span className="text-slate-500"> / {yCalTarget.toLocaleString('ru-RU')} ккал</span></span>
            <span className="font-medium text-slate-300">{yLog.proteins}<span className="text-slate-500"> / {yProteinTarget} г белка</span></span>
            <span className="font-medium text-slate-300">{yLog.steps.toLocaleString('ru-RU')}<span className="text-slate-500"> / {STEP_TARGET.toLocaleString('ru-RU')} шагов</span></span>
            {yLog.sleep_quality != null && <span className="text-slate-400">Сон {yLog.sleep_quality}/5</span>}
          </div>
        </Card>
      )}

      {/* Quote — subtle footer */}
      <p className="px-4 text-center text-xs italic text-slate-600">{todayQuote}</p>

      {/* ── Modals ── */}
      <NutritionModal
        open={nutritionModal}
        onClose={() => setNutritionModal(false)}
        defaultDate={nutritionDate}
        existing={logs.find((l) => l.date === nutritionDate) ?? null}
        isDemo={isDemo}
        onSaved={(savedDate, patch) => {
          setLogs((prev) => {
            if (!prev) return prev;
            const updated = [...prev];
            const idx = updated.findIndex((l) => l.date === savedDate);
            if (idx >= 0) {
              updated[idx] = { ...updated[idx], ...patch };
            } else {
              updated.push({ id: 'tmp', date: savedDate, weight: null, steps: 0, sleep_quality: null, weight_ema: null, weekly_tdee: null, weekly_target_calories: null, day_type: null, created_at: new Date().toISOString(), ...patch });
              updated.sort((a, b) => a.date.localeCompare(b.date));
            }
            return updated;
          });
        }}
      />

      <StepsModal
        open={stepsModal}
        onClose={() => setStepsModal(false)}
        defaultDate={todayISO()}
        existing={logs.find((l) => l.date === todayISO()) ?? null}
        isDemo={isDemo}
        onSaved={(savedDate, s) => {
          setLogs((prev) => {
            if (!prev) return prev;
            const updated = [...prev];
            const idx = updated.findIndex((l) => l.date === savedDate);
            if (idx >= 0) {
              updated[idx] = { ...updated[idx], steps: s };
            } else {
              updated.push({ id: 'tmp', date: savedDate, weight: null, steps: s, sleep_quality: null, calories: 0, proteins: 0, fats: 0, carbs: 0, weight_ema: null, weekly_tdee: null, weekly_target_calories: null, day_type: null, created_at: new Date().toISOString() });
              updated.sort((a, b) => a.date.localeCompare(b.date));
            }
            return updated;
          });
        }}
      />

      <WeightModal
        open={weightModal}
        onClose={() => setWeightModal(false)}
        defaultDate={todayISO()}
        existing={logs.find((l) => l.date === todayISO()) ?? null}
        isDemo={isDemo}
        onSaved={(savedDate, w) => {
          setLogs((prev) => {
            if (!prev) return prev;
            const updated = [...prev];
            const idx = updated.findIndex((l) => l.date === savedDate);
            if (idx >= 0) {
              updated[idx] = { ...updated[idx], weight: w, weight_ema: w };
            } else {
              updated.push({ id: 'tmp', date: savedDate, weight: w, steps: 0, sleep_quality: null, calories: 0, proteins: 0, fats: 0, carbs: 0, weight_ema: w, weekly_tdee: null, weekly_target_calories: null, day_type: null, created_at: new Date().toISOString() });
              updated.sort((a, b) => a.date.localeCompare(b.date));
            }
            return updated;
          });
        }}
      />

      {showSleepCheckin && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
          <div className="w-full max-w-sm rounded-2xl border border-ink-700 bg-ink-900 p-5">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-sky-500/15 text-sky-300">
                <Moon className="h-5 w-5" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-white">{user?.displayName ? `${user.displayName}, как ты сегодня спал?` : 'Привет! Как ты сегодня спал?'}</h3>
                <p className="mt-0.5 text-sm text-slate-400">Отметь пожалуйста качество твоего сна</p>
              </div>
            </div>
            <div className="mt-5 flex items-center gap-2">
              {([
                { q: 5, label: 'Выспался', color: 'bg-emerald-500', ring: 'ring-emerald-400' },
                { q: 3, label: 'Недоспал', color: 'bg-amber-500', ring: 'ring-amber-400' },
                { q: 1, label: 'Плохо спал', color: 'bg-red-500', ring: 'ring-red-400' },
              ] as const).map((opt) => (
                <button
                  key={opt.q}
                  onClick={() => handleSleepCheckin(opt.q)}
                  disabled={sleepSaving}
                  className="flex-1 flex flex-col items-center gap-2 rounded-xl border border-ink-600 bg-ink-800 py-3 transition-all hover:border-ink-500 disabled:opacity-50"
                >
                  <span className={`h-4 w-4 rounded-full ${opt.color}`} />
                  <span className="text-xs font-medium text-slate-300">{opt.label}</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {toast && <Toast message={toast.message} tone={toast.tone} />}
    </div>
  );
}
