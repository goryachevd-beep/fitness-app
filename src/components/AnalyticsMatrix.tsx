import { useMemo, useState } from 'react';
import { Moon, Footprints, Scale, Flame, TrendingUp, TrendingDown } from 'lucide-react';
import type { DailyLog, NutritionTargets } from '@/lib/types';
import { Card } from '@/components/ui';
import { LineChart } from '@/components/LineChart';
import { formatShortDate, calcEma } from '@/lib/calc';

type PeriodKey = '7D' | '2W' | '1M' | '3M';
type MetricKey = 'sleep' | 'steps' | 'weight' | 'calories';

const PERIOD_OPTIONS: { key: PeriodKey; label: string }[] = [
  { key: '7D', label: '7 дн' },
  { key: '2W', label: '2 нед' },
  { key: '1M', label: 'мес' },
  { key: '3M', label: '3 мес' },
];

const METRIC_OPTIONS: { key: MetricKey; label: string; icon: typeof Moon }[] = [
  { key: 'sleep', label: 'Сон', icon: Moon },
  { key: 'steps', label: 'Шаги', icon: Footprints },
  { key: 'weight', label: 'Вес', icon: Scale },
  { key: 'calories', label: 'Калории', icon: Flame },
];

const PERIOD_LABELS: Record<PeriodKey, string> = { '7D': '7 дн', '2W': '2 нед', '1M': 'мес', '3M': '3 мес' };

function periodStart(period: PeriodKey, lastDate: string): string {
  const d = new Date(lastDate + 'T00:00:00');
  if (period === '7D') d.setDate(d.getDate() - 7);
  else if (period === '2W') d.setDate(d.getDate() - 14);
  else if (period === '1M') d.setMonth(d.getMonth() - 1);
  else if (period === '3M') d.setMonth(d.getMonth() - 3);
  return d.toISOString().slice(0, 10);
}

export function AnalyticsMatrix({ logs, targets, isDemo }: { logs: DailyLog[]; targets: NutritionTargets | null; isDemo: boolean }) {
  const [period, setPeriod] = useState<PeriodKey>('1M');
  const [metric, setMetric] = useState<MetricKey>('weight');

  const lastDate = logs.length ? logs[logs.length - 1].date : new Date().toISOString().slice(0, 10);
  const startDate = periodStart(period, lastDate);

  const filteredLogs = useMemo(
    () => logs.filter((l) => l.date >= startDate && l.date <= lastDate),
    [logs, startDate, lastDate],
  );

  const sleepData = useMemo(() => {
    const sl = filteredLogs.filter((l) => l.sleep_quality != null);
    return sl.map((l) => ({ label: formatShortDate(l.date), value: l.sleep_quality as number }));
  }, [filteredLogs]);

  const stepsData = useMemo(
    () => filteredLogs.map((l) => ({ label: formatShortDate(l.date), value: l.steps ?? 0 })),
    [filteredLogs],
  );

  const weightData = useMemo(() => {
    const wl = filteredLogs.filter((l) => l.weight != null);
    const emaValues: number[] = [];
    let prevEma: number | null = null;
    for (const l of wl) {
      prevEma = calcEma(Number(l.weight), prevEma);
      emaValues.push(prevEma);
    }
    return {
      points: wl.map((l) => ({ label: formatShortDate(l.date), value: Number(l.weight) })),
      ema: emaValues,
    };
  }, [filteredLogs]);

  const today = logs[logs.length - 1];
  const isTrainingDay = today?.day_type !== 'rest';
  const calTarget = targets
    ? targets.mode === 'split'
      ? isTrainingDay ? targets.training_calories : targets.rest_calories
      : targets.uniform_calories
    : today?.weekly_target_calories ?? 2350;

  const caloriesData = useMemo(
    () => filteredLogs.map((l) => ({ label: formatShortDate(l.date), value: l.calories ?? 0 })),
    [filteredLogs],
  );
  const calTargetLine = useMemo(
    () => filteredLogs.map(() => calTarget),
    [filteredLogs, calTarget],
  );

  const summary = useMemo(() => {
    const pl = PERIOD_LABELS[period];
    if (metric === 'sleep') {
      const vals = sleepData.map((d) => d.value);
      const avg = vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : 0;
      const first = vals[0] ?? 0;
      const last = vals[vals.length - 1] ?? 0;
      const delta = last - first;
      return {
        current: `${avg.toFixed(1)}/5`,
        subtitle: `среднее · ${pl}`,
        delta: delta !== 0 ? `${delta > 0 ? '+' : ''}${delta.toFixed(1)}` : '0.0',
        deltaLabel: `за ${pl}`,
        positive: delta >= 0,
      };
    }
    if (metric === 'steps') {
      const vals = stepsData.map((d) => d.value);
      const avg = vals.length ? Math.round(vals.reduce((a, b) => a + b, 0) / vals.length) : 0;
      const first = vals[0] ?? 0;
      const last = vals[vals.length - 1] ?? 0;
      const pct = first ? ((last - first) / first) * 100 : 0;
      return {
        current: avg.toLocaleString('ru-RU'),
        subtitle: `средние шаги · ${pl}`,
        delta: `${pct >= 0 ? '+' : ''}${pct.toFixed(1)}%`,
        deltaLabel: `за ${pl}`,
        positive: pct >= 0,
      };
    }
    if (metric === 'weight') {
      const ema = weightData.ema;
      const last = ema[ema.length - 1] ?? 0;
      const first = ema[0] ?? 0;
      const delta = last - first;
      const pct = first ? (delta / first) * 100 : 0;
      return {
        current: `${last.toFixed(1)} кг`,
        subtitle: `EMA · ${pl}`,
        delta: `${pct >= 0 ? '+' : ''}${pct.toFixed(1)}%`,
        deltaLabel: `за ${pl}`,
        positive: delta <= 0,
      };
    }
    // calories
    const vals = caloriesData.map((d) => d.value);
    const avg = vals.length ? Math.round(vals.reduce((a, b) => a + b, 0) / vals.length) : 0;
    const first = vals[0] ?? 0;
    const last = vals[vals.length - 1] ?? 0;
    const pct = first ? ((last - first) / first) * 100 : 0;
    return {
      current: `${avg.toLocaleString('ru-RU')} ккал`,
      subtitle: `среднее · ${pl}`,
      delta: `${pct >= 0 ? '+' : ''}${pct.toFixed(1)}%`,
      deltaLabel: `за ${pl}`,
      positive: pct <= 0,
    };
  }, [metric, sleepData, stepsData, weightData, caloriesData, period]);

  const chartData = useMemo(() => {
    if (metric === 'sleep') return { data: sleepData, color: '#38bdf8', unit: '/5' };
    if (metric === 'steps') return { data: stepsData, color: '#84cc16', unit: ' шаг' };
    if (metric === 'weight') {
      const allVals = [...weightData.points.map((d) => d.value), ...weightData.ema];
      const yMin = allVals.length ? Math.min(...allVals) - 1.5 : undefined;
      const yMax = allVals.length ? Math.max(...allVals) + 1.5 : undefined;
      return { data: weightData.points, secondary: weightData.ema, color: '#34d399', unit: ' кг', yMin, yMax };
    }
    return { data: caloriesData, secondary: calTargetLine, color: '#f97316', secondaryColor: '#475569', unit: ' ккал' };
  }, [metric, sleepData, stepsData, weightData, caloriesData, calTargetLine]);

  return (
    <Card className="overflow-hidden p-5 sm:p-6">
      <div className="flex items-center gap-2">
        <h2 className="text-lg font-bold text-white">Матрица аналитики</h2>
      </div>

      {/* Period selector */}
      <div className="mt-4 flex rounded-xl border border-ink-700 bg-ink-850 p-0.5">
        {PERIOD_OPTIONS.map((opt) => (
          <button
            key={opt.key}
            onClick={() => setPeriod(opt.key)}
            className={`flex-1 rounded-lg px-2 py-1.5 text-xs font-bold transition-all ${period === opt.key ? 'bg-brand-500 text-ink-950 shadow-sm' : 'text-slate-400 hover:text-slate-200'}`}
          >
            {opt.label}
          </button>
        ))}
      </div>

      {/* Metric selector */}
      <div className="mt-3 grid grid-cols-4 gap-2">
        {METRIC_OPTIONS.map((opt) => {
          const Icon = opt.icon;
          const active = metric === opt.key;
          return (
            <button
              key={opt.key}
              onClick={() => setMetric(opt.key)}
              className={`flex flex-col items-center gap-1.5 rounded-xl border py-3 transition-all ${active ? 'border-brand-500/50 bg-brand-500/10' : 'border-ink-700/60 bg-ink-900/40 hover:border-ink-600'}`}
            >
              <Icon className={`h-5 w-5 transition-colors ${active ? 'text-brand-300' : 'text-slate-500'}`} />
              <span className={`text-xs font-semibold ${active ? 'text-white' : 'text-slate-400'}`}>{opt.label}</span>
            </button>
          );
        })}
      </div>

      {/* Summary + trend badge */}
      <div className="mt-5 flex items-end justify-between gap-3">
        <div>
          <p className="text-3xl font-extrabold text-white">{summary.current}</p>
          <p className="mt-0.5 text-sm text-slate-400">{summary.subtitle}</p>
        </div>
        {summary.deltaLabel && (
          <span className={`flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-sm font-bold ${summary.positive ? 'bg-emerald-500/15 text-emerald-400' : 'bg-amber-500/15 text-amber-400'}`}>
            {summary.positive ? <TrendingDown className="h-4 w-4" /> : <TrendingUp className="h-4 w-4" />}
            {summary.delta}
            <span className="text-xs font-medium opacity-70">{summary.deltaLabel}</span>
          </span>
        )}
      </div>

      {/* Chart */}
      <div className="mt-4">
        <LineChart
          data={chartData.data}
          secondary={chartData.secondary}
          color={chartData.color}
          secondaryColor={chartData.secondaryColor}
          unit={chartData.unit}
          yMin={chartData.yMin}
          yMax={chartData.yMax}
        />
      </div>

      {/* Legend */}
      <div className="mt-2 flex flex-wrap items-center gap-4 text-xs text-slate-400">
        {metric === 'weight' && (
          <>
            <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full bg-brand-400" /> Факт</span>
            <span className="flex items-center gap-1.5"><span className="h-0.5 w-4 rounded bg-slate-500" /> EMA тренд</span>
          </>
        )}
        {metric === 'sleep' && (
          <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full bg-sky-400" /> Оценка сна (1–5)</span>
        )}
        {metric === 'steps' && (
          <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full bg-lime-400" /> Шаги в день</span>
        )}
        {metric === 'calories' && (
          <>
            <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full bg-orange-500" /> Калории</span>
            <span className="flex items-center gap-1.5"><span className="h-0.5 w-4 rounded bg-slate-500" /> Цель: {calTarget} ккал</span>
          </>
        )}
      </div>
    </Card>
  );
}
