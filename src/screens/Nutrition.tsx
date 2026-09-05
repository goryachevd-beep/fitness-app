import { useEffect, useMemo, useState } from 'react';
import { Flame, Settings, X, Check, Scale, Plus, Footprints } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import type { DailyLog, NutritionTargets } from '@/lib/types';
import { Card, Loader } from '@/components/ui';
import { LineChart } from '@/components/LineChart';
import { formatShortDate, todayISO, calcEma } from '@/lib/calc';

type RangeKey = '7D' | '2W' | '1M' | '3M' | 'YTD' | 'All' | 'Custom';

const RANGE_OPTIONS: { key: RangeKey; label: string }[] = [
  { key: '7D', label: '7D' },
  { key: '2W', label: '2W' },
  { key: '1M', label: '1M' },
  { key: '3M', label: '3M' },
  { key: 'YTD', label: 'YTD' },
  { key: 'All', label: 'All' },
  { key: 'Custom', label: 'Custom' },
];

function rangeStart(range: RangeKey, lastDate: string, customStart?: string, customEnd?: string): string | null {
  if (range === 'All') return null;
  if (range === 'Custom') return customStart ?? null;
  const end = new Date(lastDate + 'T00:00:00');
  const d = new Date(end);
  if (range === '7D') d.setDate(d.getDate() - 7);
  else if (range === '2W') d.setDate(d.getDate() - 14);
  else if (range === '1M') d.setMonth(d.getMonth() - 1);
  else if (range === '3M') d.setMonth(d.getMonth() - 3);
  else if (range === 'YTD') d.setMonth(0), d.setDate(1);
  return d.toISOString().slice(0, 10);
}

function rangeEnd(range: RangeKey, lastDate: string, customEnd?: string): string {
  if (range === 'Custom' && customEnd) return customEnd;
  return lastDate;
}

function Macro({ label, value, target, color }: { label: string; value: number; target: number; color: string }) {
  const pct = Math.min((value / target) * 100, 100);
  return (
    <div className="flex-1">
      <div className="flex items-baseline justify-between">
        <span className="text-xs font-semibold text-slate-300">{label}</span>
        <span className="text-xs text-slate-500">{value}/{target}</span>
      </div>
      <p className="mt-0.5 text-lg font-extrabold text-white">{value}<span className="ml-0.5 text-xs font-normal text-slate-500">г</span></p>
      <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-ink-700">
        <div className="h-full rounded-full transition-all duration-700" style={{ width: `${pct}%`, backgroundColor: color }} />
      </div>
    </div>
  );
}

function TargetsModal({ open, onClose, targets, onSaved }: { open: boolean; onClose: () => void; targets: NutritionTargets | null; onSaved: (t: NutritionTargets) => void }) {
  const [form, setForm] = useState<NutritionTargets | null>(targets);
  const [saving, setSaving] = useState(false);

  useEffect(() => { setForm(targets); }, [targets, open]);

  if (!open || !form) return null;

  function update(patch: Partial<NutritionTargets>) {
    setForm((f) => f ? { ...f, ...patch } : f);
  }

  async function save() {
    if (!form) return;
    setSaving(true);
    const { data } = await supabase.from('nutrition_targets').update(form).eq('id', form.id).select().maybeSingle();
    if (data) onSaved(data as NutritionTargets);
    setSaving(false);
    onClose();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4" onClick={onClose}>
      <div className="max-h-[85vh] w-full max-w-lg overflow-y-auto rounded-2xl border border-ink-700 bg-ink-900 p-5" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Settings className="h-5 w-5 text-brand-300" />
            <h3 className="text-lg font-bold text-white">Настройки целей питания</h3>
          </div>
          <button onClick={onClose} className="text-slate-500 hover:text-slate-300"><X className="h-5 w-5" /></button>
        </div>

        <div className="mt-4">
          <p className="mb-2 text-xs font-semibold text-slate-400">Режим целей</p>
          <div className="flex rounded-xl border border-ink-700 bg-ink-850 p-1 text-sm font-semibold">
            <button onClick={() => update({ mode: 'uniform' })} className={`flex-1 rounded-lg px-3 py-2 transition-colors ${form.mode === 'uniform' ? 'bg-brand-500 text-ink-950' : 'text-slate-400'}`}>Единые цели</button>
            <button onClick={() => update({ mode: 'split' })} className={`flex-1 rounded-lg px-3 py-2 transition-colors ${form.mode === 'split' ? 'bg-brand-500 text-ink-950' : 'text-slate-400'}`}>Тренировочный / отдых</button>
          </div>
        </div>

        <div className="mt-4 space-y-3">
          {form.mode === 'uniform' ? (
            <div>
              <label className="text-xs font-semibold text-slate-400">Калории, ккал</label>
              <input type="number" value={form.uniform_calories} onChange={(e) => update({ uniform_calories: Number(e.target.value) })} className="mt-1 w-full rounded-xl border border-ink-600 bg-ink-950 px-4 py-3 text-lg font-bold text-white outline-none focus:border-brand-500" />
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-semibold text-slate-400">Тренировочный день, ккал</label>
                <input type="number" value={form.training_calories} onChange={(e) => update({ training_calories: Number(e.target.value) })} className="mt-1 w-full rounded-xl border border-ink-600 bg-ink-950 px-4 py-3 text-lg font-bold text-white outline-none focus:border-brand-500" />
              </div>
              <div>
                <label className="text-xs font-semibold text-slate-400">День отдыха, ккал</label>
                <input type="number" value={form.rest_calories} onChange={(e) => update({ rest_calories: Number(e.target.value) })} className="mt-1 w-full rounded-xl border border-ink-600 bg-ink-950 px-4 py-3 text-lg font-bold text-white outline-none focus:border-brand-500" />
              </div>
            </div>
          )}
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="text-xs font-semibold text-slate-400">Белки, г</label>
              <input type="number" value={form.protein} onChange={(e) => update({ protein: Number(e.target.value) })} className="mt-1 w-full rounded-xl border border-ink-600 bg-ink-950 px-4 py-3 font-bold text-white outline-none focus:border-brand-500" />
            </div>
            {form.mode === 'split' ? (
              <>
                <div>
                  <label className="text-xs font-semibold text-slate-400">Углеводы (тр.), г</label>
                  <input type="number" value={form.training_carbs} onChange={(e) => update({ training_carbs: Number(e.target.value) })} className="mt-1 w-full rounded-xl border border-ink-600 bg-ink-950 px-4 py-3 font-bold text-white outline-none focus:border-brand-500" />
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-400">Углеводы (отд.), г</label>
                  <input type="number" value={form.rest_carbs} onChange={(e) => update({ rest_carbs: Number(e.target.value) })} className="mt-1 w-full rounded-xl border border-ink-600 bg-ink-950 px-4 py-3 font-bold text-white outline-none focus:border-brand-500" />
                </div>
              </>
            ) : (
              <div>
                <label className="text-xs font-semibold text-slate-400">Углеводы, г</label>
                <input type="number" value={form.training_carbs} onChange={(e) => update({ training_carbs: Number(e.target.value), rest_carbs: Number(e.target.value) })} className="mt-1 w-full rounded-xl border border-ink-600 bg-ink-950 px-4 py-3 font-bold text-white outline-none focus:border-brand-500" />
              </div>
            )}
          </div>
          <div>
            <label className="text-xs font-semibold text-slate-400">Жиры, г</label>
            <input type="number" value={form.fats} onChange={(e) => update({ fats: Number(e.target.value) })} className="mt-1 w-full rounded-xl border border-ink-600 bg-ink-950 px-4 py-3 font-bold text-white outline-none focus:border-brand-500" />
          </div>
        </div>

        <button onClick={save} disabled={saving} className="mt-5 flex w-full items-center justify-center gap-2 rounded-xl bg-brand-500 py-3 font-bold text-ink-950 transition-transform hover:scale-[1.02] active:scale-95 disabled:opacity-40">
          <Check className="h-4 w-4" /> Сохранить
        </button>
      </div>
    </div>
  );
}

function NutritionModal({ open, onClose, current, onSaved }: { open: boolean; onClose: () => void; current: { calories: number; proteins: number; fats: number; carbs: number } | null; onSaved: (v: { calories: number; proteins: number; fats: number; carbs: number }) => void }) {
  const [calories, setCalories] = useState(0);
  const [proteins, setProteins] = useState(0);
  const [fats, setFats] = useState(0);
  const [carbs, setCarbs] = useState(0);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) {
      setCalories(current?.calories ?? 0);
      setProteins(current?.proteins ?? 0);
      setFats(current?.fats ?? 0);
      setCarbs(current?.carbs ?? 0);
    }
  }, [open, current]);

  if (!open) return null;

  async function save() {
    setSaving(true);
    const { data: existing } = await supabase.from('daily_logs').select('id').eq('date', todayISO()).maybeSingle();
    if (existing) {
      await supabase.from('daily_logs').update({ calories, proteins, fats, carbs }).eq('id', existing.id);
    } else {
      await supabase.from('daily_logs').insert({ date: todayISO(), calories, proteins, fats, carbs });
    }
    onSaved({ calories, proteins, fats, carbs });
    setSaving(false);
    onClose();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4" onClick={onClose}>
      <div className="w-full max-w-md rounded-2xl border border-ink-700 bg-ink-900 p-5" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Flame className="h-5 w-5 text-brand-300" />
            <h3 className="text-lg font-bold text-white">Записать КБЖУ за сегодня</h3>
          </div>
          <button onClick={onClose} className="text-slate-500 hover:text-slate-300"><X className="h-5 w-5" /></button>
        </div>

        <div className="mt-4 space-y-3">
          <div>
            <label className="text-xs font-semibold text-slate-400">Калории, ккал</label>
            <input type="number" value={calories} onChange={(e) => setCalories(Number(e.target.value))} className="mt-1 w-full rounded-xl border border-ink-600 bg-ink-950 px-4 py-3 text-lg font-bold text-white outline-none focus:border-brand-500" />
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="text-xs font-semibold text-slate-400">Белки, г</label>
              <input type="number" value={proteins} onChange={(e) => setProteins(Number(e.target.value))} className="mt-1 w-full rounded-xl border border-ink-600 bg-ink-950 px-4 py-3 font-bold text-white outline-none focus:border-brand-500" />
            </div>
            <div>
              <label className="text-xs font-semibold text-slate-400">Жиры, г</label>
              <input type="number" value={fats} onChange={(e) => setFats(Number(e.target.value))} className="mt-1 w-full rounded-xl border border-ink-600 bg-ink-950 px-4 py-3 font-bold text-white outline-none focus:border-brand-500" />
            </div>
            <div>
              <label className="text-xs font-semibold text-slate-400">Углеводы, г</label>
              <input type="number" value={carbs} onChange={(e) => setCarbs(Number(e.target.value))} className="mt-1 w-full rounded-xl border border-ink-600 bg-ink-950 px-4 py-3 font-bold text-white outline-none focus:border-brand-500" />
            </div>
          </div>
        </div>

        <button onClick={save} disabled={saving} className="mt-5 flex w-full items-center justify-center gap-2 rounded-xl bg-brand-500 py-3 font-bold text-ink-950 transition-transform hover:scale-[1.02] active:scale-95 disabled:opacity-40">
          <Check className="h-4 w-4" /> Сохранить
        </button>
      </div>
    </div>
  );
}

export default function Nutrition() {
  const [logs, setLogs] = useState<DailyLog[] | null>(null);
  const [targets, setTargets] = useState<NutritionTargets | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [nutritionOpen, setNutritionOpen] = useState(false);
  const [range, setRange] = useState<RangeKey>('1M');
  const [customStart, setCustomStart] = useState('');
  const [customEnd, setCustomEnd] = useState('');

  useEffect(() => {
    (async () => {
      const { data: logData } = await supabase.from('daily_logs').select('*').order('date', { ascending: true });
      const { data: targetData } = await supabase.from('nutrition_targets').select('*').maybeSingle();
      setLogs((logData as DailyLog[]) ?? []);
      setTargets(targetData as NutritionTargets | null);
    })();
  }, []);

  const weightLogs = logs ? logs.filter((l) => l.weight != null) : [];

  const lastDate = logs && logs.length ? logs[logs.length - 1].date : todayISO();
  const startDate = rangeStart(range, lastDate, customStart, customEnd);
  const endDate = rangeEnd(range, lastDate, customEnd);

  const filteredLogs = useMemo(() => {
    if (!startDate) return weightLogs;
    return weightLogs.filter((l) => l.date >= startDate && l.date <= endDate);
  }, [weightLogs, startDate, endDate]);

  const filteredAllLogs = useMemo(() => {
    if (!logs) return [];
    if (!startDate) return logs;
    return logs.filter((l) => l.date >= startDate && l.date <= endDate);
  }, [logs, startDate, endDate]);

  if (!logs) return <Loader />;
  if (logs.length === 0) return <p className="py-20 text-center text-slate-500">Дневник пуст</p>;

  const today = logs[logs.length - 1];
  const isTrainingDay = true;
  const calTarget = targets ? (targets.mode === 'split' ? (isTrainingDay ? targets.training_calories : targets.rest_calories) : targets.uniform_calories) : today.weekly_target_calories ?? 2350;
  const carbTarget = targets ? (targets.mode === 'split' ? (isTrainingDay ? targets.training_carbs : targets.rest_carbs) : targets.training_carbs) : 240;
  const proteinTarget = targets?.protein ?? 160;
  const fatTarget = targets?.fats ?? 70;
  const calPct = Math.min((today.calories / calTarget) * 100, 100);

  const weightData = filteredLogs.map((l) => ({ label: formatShortDate(l.date), value: Number(l.weight) }));
  const emaData = filteredLogs.map((l) => Number(l.weight_ema ?? l.weight));
  const lastEma = emaData[emaData.length - 1] ?? 0;
  const firstEma = emaData[0] ?? 0;
  const emaDelta = lastEma - firstEma;

  const recent7 = emaData.slice(-7);
  const prev7 = emaData.slice(-14, -7);
  const recentAvg = recent7.length ? recent7.reduce((a, b) => a + b, 0) / recent7.length : 0;
  const prevAvg = prev7.length ? prev7.reduce((a, b) => a + b, 0) / prev7.length : 0;
  const weeklyDelta = prevAvg ? recentAvg - prevAvg : 0;

  const allValues = [...weightData.map((d) => d.value), ...emaData];
  const yMin = allValues.length ? Math.min(...allValues) - 1.5 : undefined;
  const yMax = allValues.length ? Math.max(...allValues) + 1.5 : undefined;

  const caloriesData = filteredAllLogs.map((l) => ({ label: formatShortDate(l.date), value: l.calories }));
  const calTargetLine = filteredAllLogs.map(() => calTarget);
  const stepsData = filteredAllLogs.map((l) => ({ label: formatShortDate(l.date), value: l.steps }));

  const avgCalories = filteredAllLogs.length ? Math.round(filteredAllLogs.reduce((s, l) => s + l.calories, 0) / filteredAllLogs.length) : 0;
  const avgProtein = filteredAllLogs.length ? Math.round(filteredAllLogs.reduce((s, l) => s + l.proteins, 0) / filteredAllLogs.length) : 0;
  const avgFat = filteredAllLogs.length ? Math.round(filteredAllLogs.reduce((s, l) => s + l.fats, 0) / filteredAllLogs.length) : 0;
  const avgCarbs = filteredAllLogs.length ? Math.round(filteredAllLogs.reduce((s, l) => s + l.carbs, 0) / filteredAllLogs.length) : 0;
  const avgSteps = filteredAllLogs.length ? Math.round(filteredAllLogs.reduce((s, l) => s + l.steps, 0) / filteredAllLogs.length) : 0;

  async function logWeight(w: number) {
    const { data: existing } = await supabase.from('daily_logs').select('id, weight_ema').eq('date', todayISO()).maybeSingle();
    const prevEma = weightLogs.length ? Number(weightLogs[weightLogs.length - 1].weight_ema ?? weightLogs[weightLogs.length - 1].weight) : null;
    const newEma = calcEma(w, prevEma);
    if (existing) {
      await supabase.from('daily_logs').update({ weight: w, weight_ema: newEma }).eq('id', existing.id);
    } else {
      await supabase.from('daily_logs').insert({ date: todayISO(), weight: w, weight_ema: newEma });
    }
    setLogs((prev) => {
      if (!prev) return prev;
      const updated = [...prev];
      const last = updated[updated.length - 1];
      if (last && last.date === todayISO()) {
        updated[updated.length - 1] = { ...last, weight: w, weight_ema: newEma };
      } else {
        updated.push({ id: 'tmp', date: todayISO(), weight: w, steps: 0, sleep_quality: null, calories: 0, proteins: 0, fats: 0, carbs: 0, weight_ema: newEma, weekly_tdee: null, weekly_target_calories: null });
      }
      return updated;
    });
  }

  return (
    <div className="animate-fade-up space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-extrabold text-white">Питание и вес</h1>
          <p className="mt-0.5 text-sm text-slate-400">КБЖУ, тренд веса и цели от тренера</p>
        </div>
        <button onClick={() => setSettingsOpen(true)} className="flex h-10 w-10 items-center justify-center rounded-xl border border-ink-700 bg-ink-850 text-slate-400 transition-colors hover:border-brand-500/50 hover:text-brand-300" title="Настройки целей">
          <Settings className="h-5 w-5" />
        </button>
      </div>

      {/* Calorie targets section */}
      <Card className="p-5 sm:p-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Flame className="h-5 w-5 text-brand-400" />
            <h2 className="text-lg font-bold text-white">Цели на день</h2>
          </div>
          <button onClick={() => setNutritionOpen(true)} className="flex h-7 w-7 items-center justify-center rounded-lg border border-ink-600 bg-ink-800 text-slate-400 transition-colors hover:border-brand-500/50 hover:text-brand-300" title="Записать КБЖУ">
            <Plus className="h-4 w-4" />
          </button>
        </div>
        {targets && (
          <div className="mt-3 flex flex-wrap gap-2">
            {targets.mode === 'split' ? (
              <>
                <span className="rounded-lg border border-brand-500/30 bg-brand-500/10 px-3 py-1.5 text-sm font-semibold text-brand-300">Тренировочный: {targets.training_calories} ккал</span>
                <span className="rounded-lg border border-slate-500/30 bg-slate-500/10 px-3 py-1.5 text-sm font-semibold text-slate-300">Отдых: {targets.rest_calories} ккал</span>
              </>
            ) : (
              <span className="rounded-lg border border-brand-500/30 bg-brand-500/10 px-3 py-1.5 text-sm font-semibold text-brand-300">Единая цель: {targets.uniform_calories} ккал</span>
            )}
            <span className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3 py-1.5 text-sm font-semibold text-emerald-300">Б: {targets.protein}г</span>
            <span className="rounded-lg border border-sky-500/30 bg-sky-500/10 px-3 py-1.5 text-sm font-semibold text-sky-300">У: {targets.mode === 'split' ? `${targets.rest_carbs}/${targets.training_carbs}г` : `${targets.training_carbs}г`}</span>
            <span className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-1.5 text-sm font-semibold text-amber-300">Ж: {targets.fats}г</span>
          </div>
        )}

        <div className="mt-4 flex items-end justify-between">
          <div>
            <p className="text-4xl font-extrabold text-white">{today.calories.toLocaleString('ru-RU')}<span className="ml-1.5 text-lg font-semibold text-slate-500">/ {calTarget} ккал</span></p>
            <p className="mt-1 text-sm text-slate-400">{today.calories > calTarget ? `Перебор на ${today.calories - calTarget} ккал` : `Осталось ${calTarget - today.calories} ккал`}</p>
          </div>
          <span className="text-sm font-bold text-brand-400">{calPct.toFixed(0)}%</span>
        </div>
        <div className="mt-3 h-2 overflow-hidden rounded-full bg-ink-700">
          <div className="h-full rounded-full bg-gradient-to-r from-brand-500 to-brand-400 transition-all duration-700" style={{ width: `${calPct}%` }} />
        </div>
        <div className="mt-5 flex gap-4 sm:gap-6">
          <Macro label="Белки" value={today.proteins} target={proteinTarget} color="#34d399" />
          <Macro label="Жиры" value={today.fats} target={fatTarget} color="#f59e0b" />
          <Macro label="Углеводы" value={today.carbs} target={carbTarget} color="#38bdf8" />
        </div>
      </Card>

      {/* Shared range selector for all history charts */}
      <Card className="p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-lg font-bold text-white">История за период</h2>
          <div className="flex rounded-lg border border-ink-700 bg-ink-850 p-0.5">
            {RANGE_OPTIONS.map((opt) => (
              <button
                key={opt.key}
                onClick={() => setRange(opt.key)}
                className={`rounded-md px-2.5 py-1 text-xs font-bold transition-colors ${range === opt.key ? 'bg-brand-500 text-ink-950' : 'text-slate-400 hover:text-slate-200'}`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>
        {range === 'Custom' && (
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <input
              type="date"
              value={customStart}
              onChange={(e) => setCustomStart(e.target.value)}
              className="rounded-lg border border-ink-600 bg-ink-950 px-3 py-1.5 text-sm text-white outline-none focus:border-brand-500"
            />
            <span className="text-slate-500">—</span>
            <input
              type="date"
              value={customEnd}
              onChange={(e) => setCustomEnd(e.target.value)}
              className="rounded-lg border border-ink-600 bg-ink-950 px-3 py-1.5 text-sm text-white outline-none focus:border-brand-500"
            />
          </div>
        )}
      </Card>

      {/* Calories & macros history */}
      <Card className="p-5 sm:p-6">
        <h2 className="flex items-center gap-2 text-lg font-bold text-white"><Flame className="h-5 w-5 text-orange-400" /> Калории и КБЖУ за период</h2>
        <div className="mt-4 grid grid-cols-2 gap-4 sm:grid-cols-4">
          <div>
            <p className="text-xs text-slate-500">Средние ккал</p>
            <p className="text-xl font-extrabold text-white">{avgCalories.toLocaleString('ru-RU')}</p>
          </div>
          <div>
            <p className="text-xs text-slate-500">Средние белки</p>
            <p className="text-xl font-extrabold text-emerald-400">{avgProtein} г</p>
          </div>
          <div>
            <p className="text-xs text-slate-500">Средние жиры</p>
            <p className="text-xl font-extrabold text-amber-400">{avgFat} г</p>
          </div>
          <div>
            <p className="text-xs text-slate-500">Средние углеводы</p>
            <p className="text-xl font-extrabold text-sky-400">{avgCarbs} г</p>
          </div>
        </div>
        <div className="mt-4">
          <LineChart data={caloriesData} secondary={calTargetLine} color="#f97316" secondaryColor="#475569" unit=" ккал" />
        </div>
        <div className="mt-2 flex items-center gap-5 text-xs text-slate-400">
          <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full bg-orange-500" /> Калории</span>
          <span className="flex items-center gap-1.5"><span className="h-0.5 w-4 rounded bg-slate-500" /> Цель: {calTarget} ккал</span>
        </div>
      </Card>

      {/* Steps history */}
      <Card className="p-5 sm:p-6">
        <h2 className="flex items-center gap-2 text-lg font-bold text-white"><Footprints className="h-5 w-5 text-lime-400" /> Активность (шаги) за период</h2>
        <div className="mt-4 grid grid-cols-2 gap-4">
          <div>
            <p className="text-xs text-slate-500">Средние шаги</p>
            <p className="text-xl font-extrabold text-white">{avgSteps.toLocaleString('ru-RU')}</p>
          </div>
          <div>
            <p className="text-xs text-slate-500">Дней в периоде</p>
            <p className="text-xl font-extrabold text-white">{filteredAllLogs.length}</p>
          </div>
        </div>
        <div className="mt-4">
          <LineChart data={stepsData} color="#84cc16" />
        </div>
      </Card>

      {/* Weight trend chart */}
      <Card className="p-5 sm:p-6">
        <div>
          <h2 className="flex items-center gap-2 text-lg font-bold text-white"><Scale className="h-5 w-5 text-brand-300" /> Динамика веса (EMA)</h2>
          <p className="mt-0.5 text-sm text-slate-400">Факт и сглаженный тренд · EMA = 0.15 × вес + 0.85 × EMA(пред.)</p>
        </div>

        <div className="mt-4 grid grid-cols-3 gap-4">
          <div>
            <p className="text-xs text-slate-500">Текущий EMA</p>
            <p className="text-xl font-extrabold text-white">{lastEma.toFixed(1)} кг</p>
          </div>
          <div>
            <p className="text-xs text-slate-500">За период</p>
            <p className={`text-xl font-extrabold ${emaDelta <= 0 ? 'text-brand-400' : 'text-amber-400'}`}>{emaDelta <= 0 ? '' : '+'}{emaDelta.toFixed(1)} кг</p>
          </div>
          <div>
            <p className="text-xs text-slate-500">За неделю</p>
            <p className={`text-xl font-extrabold ${weeklyDelta <= 0 ? 'text-brand-400' : 'text-amber-400'}`}>{weeklyDelta <= 0 ? '' : '+'}{weeklyDelta.toFixed(1)} кг</p>
          </div>
        </div>
        <div className="mt-4">
          <LineChart data={weightData} secondary={emaData} unit=" кг" yMin={yMin} yMax={yMax} />
        </div>
        <div className="mt-2 flex items-center gap-5 text-xs text-slate-400">
          <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full bg-brand-400" /> Факт</span>
          <span className="flex items-center gap-1.5"><span className="h-0.5 w-4 rounded bg-slate-500" /> Тренд EMA</span>
        </div>
      </Card>

      <TargetsModal open={settingsOpen} onClose={() => setSettingsOpen(false)} targets={targets} onSaved={(t) => setTargets(t)} />
      <NutritionModal
        open={nutritionOpen}
        onClose={() => setNutritionOpen(false)}
        current={{ calories: today.calories, proteins: today.proteins, fats: today.fats, carbs: today.carbs }}
        onSaved={(v) => {
          setLogs((prev) => {
            if (!prev) return prev;
            const updated = [...prev];
            const last = updated[updated.length - 1];
            if (last && last.date === todayISO()) {
              updated[updated.length - 1] = { ...last, calories: v.calories, proteins: v.proteins, fats: v.fats, carbs: v.carbs };
            } else {
              updated.push({ id: 'tmp', date: todayISO(), weight: null, steps: 0, sleep_quality: null, calories: v.calories, proteins: v.proteins, fats: v.fats, carbs: v.carbs, weight_ema: null, weekly_tdee: null, weekly_target_calories: null });
            }
            return updated;
          });
        }}
      />
    </div>
  );
}
