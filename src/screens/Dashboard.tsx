import { useEffect, useState } from 'react';
import { Flame, TrendingDown, Footprints, Moon, Play, Plus, X, Check, RefreshCw, Dumbbell, Clock } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import type { DailyLog, NutritionTargets, WorkoutDay } from '@/lib/types';
import { Card, Loader, Toast } from '@/components/ui';
import { todayISO } from '@/lib/calc';
import { initiateGoogleFitAuth, trySyncFromSession, fetchStepsForRange, getCachedProviderToken } from '@/lib/googleFit';
import { useAuthUser } from '@/lib/useAuthUser';

function mergeStepsIntoLogs(prev: DailyLog[] | null, perDay: { date: string; steps: number }[]): DailyLog[] | null {
  if (!prev) return prev;
  const updated = [...prev];
  for (const day of perDay) {
    const idx = updated.findIndex((l) => l.date === day.date);
    if (idx >= 0) {
      updated[idx] = { ...updated[idx], steps: day.steps };
    } else {
      updated.push({ id: 'tmp', date: day.date, weight: null, steps: day.steps, sleep_quality: null, calories: 0, proteins: 0, fats: 0, carbs: 0, weight_ema: null, weekly_tdee: null, weekly_target_calories: null });
    }
  }
  updated.sort((a, b) => a.date.localeCompare(b.date));
  return updated;
}

function WeightModal({
  open,
  onClose,
  currentWeight,
  onSaved,
}: {
  open: boolean;
  onClose: () => void;
  currentWeight: number | null;
  onSaved: (w: number) => void;
}) {
  const [value, setValue] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) setValue(currentWeight ? String(currentWeight) : '');
  }, [open, currentWeight]);

  async function save() {
    const w = Number(value);
    if (!value || Number.isNaN(w)) return;
    setSaving(true);
    const { data: existing } = await supabase
      .from('daily_logs')
      .select('id')
      .eq('date', todayISO())
      .maybeSingle();
    if (existing) {
      await supabase.from('daily_logs').update({ weight: w }).eq('id', existing.id);
    } else {
      await supabase.from('daily_logs').insert({ date: todayISO(), weight: w });
    }
    onSaved(w);
    setSaving(false);
    onClose();
  }

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4" onClick={onClose}>
      <div className="w-full max-w-sm rounded-2xl border border-ink-700 bg-ink-900 p-5" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-bold text-white">Записать вес</h3>
          <button onClick={onClose} className="text-slate-500 hover:text-slate-300">
            <X className="h-5 w-5" />
          </button>
        </div>
        <p className="mt-1 text-sm text-slate-400">Сегодня, {new Date().toLocaleDateString('ru-RU', { day: 'numeric', month: 'long' })}</p>
        <div className="mt-4">
          <label className="text-xs font-semibold text-slate-400">Вес, кг</label>
          <input
            type="number"
            inputMode="decimal"
            step="0.1"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            autoFocus
            placeholder="80.0"
            className="mt-1.5 w-full rounded-xl border border-ink-600 bg-ink-950 px-4 py-3 text-lg font-bold text-white outline-none focus:border-brand-500"
          />
        </div>
        <button
          onClick={save}
          disabled={saving || !value}
          className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl bg-brand-500 py-3 font-bold text-ink-950 transition-transform hover:scale-[1.02] active:scale-95 disabled:opacity-40"
        >
          <Check className="h-4 w-4" />
          Сохранить
        </button>
      </div>
    </div>
  );
}

function MiniStat({ icon: Icon, label, value, sub, tint }: { icon: typeof Flame; label: string; value: string; sub?: string; tint: string }) {
  return (
    <Card className="p-4">
      <div className={`flex h-9 w-9 items-center justify-center rounded-lg ${tint}`}>
        <Icon className="h-4.5 w-4.5" />
      </div>
      <p className="mt-3 text-2xl font-extrabold text-white">{value}</p>
      <p className="text-sm text-slate-400">{label}</p>
      {sub && <p className="mt-0.5 text-xs text-slate-500">{sub}</p>}
    </Card>
  );
}

export default function Dashboard({ onStartWorkout }: { onStartWorkout: () => void }) {
  const { user } = useAuthUser();
  const [logs, setLogs] = useState<DailyLog[] | null>(null);
  const [targets, setTargets] = useState<NutritionTargets | null>(null);
  const [weightModal, setWeightModal] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [stepsSyncing, setStepsSyncing] = useState(false);
  const [toast, setToast] = useState<{ message: string; tone: 'success' | 'error' } | null>(null);
  const [todayWorkout, setTodayWorkout] = useState<WorkoutDay | null>(null);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 4000);
    return () => clearTimeout(t);
  }, [toast]);

  useEffect(() => {
    (async () => {
      const { data: logData } = await supabase.from('daily_logs').select('*').order('date', { ascending: true });
      const { data: targetData } = await supabase.from('nutrition_targets').select('*').maybeSingle();
      setLogs((logData as DailyLog[]) ?? []);
      setTargets(targetData as NutritionTargets | null);

      const { data: workoutData } = await supabase.from('workout_days').select('*').eq('date', todayISO()).order('created_at', { ascending: false }).limit(1).maybeSingle();
      setTodayWorkout(workoutData as WorkoutDay | null);

      const syncedSteps = await trySyncFromSession();
      if (syncedSteps != null) {
        setLogs((prev) => {
          if (!prev) return prev;
          const updated = [...prev];
          const last = updated[updated.length - 1];
          if (last && last.date === todayISO()) {
            updated[updated.length - 1] = { ...last, steps: syncedSteps };
          } else {
            updated.push({ id: 'tmp', date: todayISO(), weight: null, steps: syncedSteps, sleep_quality: null, calories: 0, proteins: 0, fats: 0, carbs: 0, weight_ema: null, weekly_tdee: null, weekly_target_calories: null });
          }
          return updated;
        });
        setToast({ message: `Синхронизировано ${syncedSteps.toLocaleString('ru-RU')} шагов за сегодня!`, tone: 'success' });
      }

      // Silent background sync: if a provider token with fitness scope exists, refresh steps automatically
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
  }, []);

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
      const providerToken = sessionData.session?.provider_token ?? getCachedProviderToken();
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
  const target = targets
    ? targets.mode === 'split'
      ? targets.training_calories
      : targets.uniform_calories
    : today.weekly_target_calories ?? 2350;
  const calPct = Math.min((today.calories / target) * 100, 100);

  const weightLogs = logs.filter((l) => l.weight != null);
  const emaData = weightLogs.slice(-30).map((l) => Number(l.weight_ema ?? l.weight));
  const lastEma = emaData[emaData.length - 1] ?? 0;
  const recent7 = emaData.slice(-7);
  const prev7 = emaData.slice(-14, -7);
  const recentAvg = recent7.length ? recent7.reduce((a, b) => a + b, 0) / recent7.length : 0;
  const prevAvg = prev7.length ? prev7.reduce((a, b) => a + b, 0) / prev7.length : 0;
  const weeklyDelta = prevAvg ? recentAvg - prevAvg : 0;

  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Доброе утро' : hour < 18 ? 'Добрый день' : 'Добрый вечер';

  return (
    <div className="animate-fade-up space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="text-sm text-slate-400">{greeting},</p>
          <h1 className="text-2xl font-extrabold text-white">{user?.displayName ?? 'Гость'}</h1>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handleSync}
            disabled={syncing}
            className="flex items-center gap-2 rounded-xl border border-ink-700 bg-ink-850 px-4 py-3 text-sm font-bold text-slate-200 transition-colors hover:border-brand-500/50 hover:text-brand-300 disabled:opacity-50"
          >
            <RefreshCw className={`h-4 w-4 ${syncing ? 'animate-spin' : ''}`} />
            {syncing ? 'Синхронизация...' : 'Синхр. данные'}
          </button>
          <button
            onClick={onStartWorkout}
            className="flex items-center gap-2.5 rounded-xl bg-brand-500 px-5 py-3 font-bold text-ink-950 shadow-glow transition-transform hover:scale-[1.03] active:scale-95"
          >
            <Play className="h-4 w-4 fill-ink-950" />
            Старт тренировки
          </button>
        </div>
      </div>

      {/* Today's workout status banner — only shown if a session exists for today */}
      {todayWorkout && (
        <Card className="flex items-center gap-4 border-brand-500/30 bg-brand-500/10 p-5">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-brand-500/20">
            {todayWorkout.notes && /\(\d+\s*мин\)/.test(todayWorkout.notes) ? (
              <Clock className="h-6 w-6 text-brand-300" />
            ) : (
              <Dumbbell className="h-6 w-6 text-brand-300" />
            )}
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-brand-400">Сегодня выполнено</p>
            <p className="text-lg font-bold text-white">{todayWorkout.notes ?? todayWorkout.name ?? 'Тренировка'}</p>
          </div>
          <Check className="ml-auto h-6 w-6 text-brand-400" />
        </Card>
      )}

      {/* Calories summary */}
      <Card className="p-5 sm:p-6">
        <div className="flex items-center gap-2">
          <Flame className="h-5 w-5 text-brand-400" />
          <h2 className="text-lg font-bold text-white">Калории сегодня</h2>
        </div>
        <div className="mt-4 flex items-end justify-between">
          <div>
            <p className="text-4xl font-extrabold text-white">
              {today.calories.toLocaleString('ru-RU')}
              <span className="ml-1.5 text-lg font-semibold text-slate-500">/ {target} ккал</span>
            </p>
            <p className="mt-1 text-sm text-slate-400">
              {today.calories > target ? `Перебор на ${today.calories - target} ккал` : `Осталось ${target - today.calories} ккал`}
            </p>
          </div>
          <span className="text-sm font-bold text-brand-400">{calPct.toFixed(0)}%</span>
        </div>
        <div className="mt-3 h-2 overflow-hidden rounded-full bg-ink-700">
          <div className="h-full rounded-full bg-gradient-to-r from-brand-500 to-brand-400 transition-all duration-700" style={{ width: `${calPct}%` }} />
        </div>
      </Card>

      {/* Quick stats */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-3">
        <Card className="p-4">
          <div className="flex items-start justify-between">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-brand-500/15 text-brand-300">
              <TrendingDown className="h-4.5 w-4.5" />
            </div>
            <button
              onClick={() => setWeightModal(true)}
              className="flex h-7 w-7 items-center justify-center rounded-lg border border-ink-600 bg-ink-800 text-slate-400 transition-colors hover:border-brand-500/50 hover:text-brand-300"
              title="Записать вес"
            >
              <Plus className="h-4 w-4" />
            </button>
          </div>
          <p className="mt-3 text-2xl font-extrabold text-white">{lastEma.toFixed(1)} кг</p>
          <p className="text-sm text-slate-400">Вес (EMA)</p>
          <p className="mt-0.5 text-xs text-slate-500">{weeklyDelta <= 0 ? '' : '+'}{weeklyDelta.toFixed(1)} кг за неделю</p>
        </Card>
        <Card className="p-4">
          <div className="flex items-start justify-between">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-lime-500/15 text-lime-400">
              <Footprints className="h-4.5 w-4.5" />
            </div>
            <button
              onClick={handleStepsSync}
              disabled={stepsSyncing}
              className="flex h-7 w-7 items-center justify-center rounded-lg border border-ink-600 bg-ink-800 text-slate-400 transition-colors hover:border-lime-500/50 hover:text-lime-300 disabled:opacity-50"
              title="Синхронизировать шаги с Google Fit"
            >
              <RefreshCw className={`h-4 w-4 ${stepsSyncing ? 'animate-spin' : ''}`} />
            </button>
          </div>
          <p className="mt-3 text-2xl font-extrabold text-white">{today.steps.toLocaleString('ru-RU')}</p>
          <p className="text-sm text-slate-400">Шаги</p>
          <p className="mt-0.5 text-xs text-slate-500">{stepsSyncing ? 'Синхр. Google Fit...' : 'Google Fit'}</p>
        </Card>
        <MiniStat icon={Moon} label="Сон" value={`${today.sleep_quality ?? '—'}/5`} sub="Zepp" tint="bg-sky-500/15 text-sky-300" />
      </div>

      <WeightModal
        open={weightModal}
        onClose={() => setWeightModal(false)}
        currentWeight={today.weight ? Number(today.weight) : null}
        onSaved={(w) => {
          setLogs((prev) => {
            if (!prev) return prev;
            const updated = [...prev];
            const last = updated[updated.length - 1];
            if (last && last.date === todayISO()) {
              updated[updated.length - 1] = { ...last, weight: w };
            } else {
              updated.push({ id: 'tmp', date: todayISO(), weight: w, steps: 0, sleep_quality: null, calories: 0, proteins: 0, fats: 0, carbs: 0, weight_ema: w, weekly_tdee: null, weekly_target_calories: null });
            }
            return updated;
          });
        }}
      />

      {toast && <Toast message={toast.message} tone={toast.tone} />}
    </div>
  );
}
