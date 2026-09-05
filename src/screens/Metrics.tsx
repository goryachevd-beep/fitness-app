import { useEffect, useMemo, useState } from 'react';
import { Ruler, Info, Plus, TrendingDown, TrendingUp, Camera, Settings, X } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import type { CustomMetric, MetricLog, Profile, ProgressPhoto } from '@/lib/types';
import { Card, Loader } from '@/components/ui';
import { LineChart } from '@/components/LineChart';
import { formatShortDate, todayISO } from '@/lib/calc';
import BodyVisualizer, { type MeasurementPoint, SilhouetteCard, PhotoCompare } from '@/components/BodyVisualizer';
import { useAuthUser } from '@/lib/useAuthUser';
import { DEMO_METRICS } from '@/lib/demoData';

const BEFORE = 'https://images.pexels.com/photos/8874408/pexels-photo-8874408.jpeg?auto=compress&cs=tinysrgb&h=900&w=600';
const AFTER = 'https://images.pexels.com/photos/27875415/pexels-photo-27875415.jpeg?auto=compress&cs=tinysrgb&h=900&w=600';

// Map metric names (Russian) to body positions on the SVG silhouette
// Coordinates are in the 320×620 viewBox
// Body silhouette spans y=18 (head top) to y=395 (feet) → height ≈ 377
// Y coordinates computed as: 18 + percentage * 377
// LEFT side:  Грудь, Левая рука, Талия (без воздуха), Левое бедро
// RIGHT side: Шея, Правая рука, Талия (по пупку), Живот, Таз (ягодицы), Правое бедро
const METRIC_POSITIONS: Record<string, { x: number; y: number; side: 'left' | 'right' }> = {
  'Шея': { x: 160, y: 71, side: 'right' },           // 14% — physical neck area
  'Грудь': { x: 160, y: 139, side: 'left' },         // 32% — center chest (left to avoid right-arm overlap)
  'Талия (по пупку)': { x: 160, y: 199, side: 'right' },   // 48% — waist at navel
  'Талия (без вохдуха)': { x: 160, y: 199, side: 'left' }, // 48% — waist relaxed (mirrored to left)
  'Живот': { x: 160, y: 222, side: 'right' },        // 54% — lower belly
  'Таз (ягодицы)': { x: 160, y: 252, side: 'right' }, // 62% — hips/glutes
  'Правое бедро': { x: 195, y: 289, side: 'right' },  // 72% — mid-thigh right
  'Левое бедро': { x: 125, y: 289, side: 'left' },    // 72% — mid-thigh left
  'Правая рука': { x: 210, y: 139, side: 'right' },  // 32% — on biceps/upper arm right
  'Левая рука': { x: 110, y: 139, side: 'left' },     // 32% — on biceps/upper arm left
};

function Toggle({ on, onClick }: { on: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={`relative h-6 w-11 rounded-full transition-colors ${on ? 'bg-brand-500' : 'bg-ink-600'}`}
    >
      <span
        className={`absolute top-0.5 h-5 w-5 rounded-full bg-white transition-transform ${
          on ? 'translate-x-5' : 'translate-x-0.5'
        }`}
      />
    </button>
  );
}

function SettingsModal({
  open,
  onClose,
  metrics,
  onToggle,
}: {
  open: boolean;
  onClose: () => void;
  metrics: CustomMetric[];
  onToggle: (m: CustomMetric) => void;
}) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4" onClick={onClose}>
      <div
        className="max-h-[80vh] w-full max-w-md overflow-y-auto rounded-2xl border border-ink-700 bg-ink-900 p-5"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Settings className="h-5 w-5 text-brand-300" />
            <h3 className="text-lg font-bold text-white">Конструктор замеров</h3>
          </div>
          <button onClick={onClose} className="text-slate-500 hover:text-slate-300">
            <X className="h-5 w-5" />
          </button>
        </div>
        <p className="mt-1 text-sm text-slate-400">Включайте нужные параметры тумблерами</p>
        <div className="mt-4 space-y-2">
          {metrics.map((m) => (
            <div
              key={m.id}
              className="flex items-center justify-between gap-3 rounded-xl border border-ink-700/60 bg-ink-900/40 p-3.5"
            >
              <div className="flex items-start gap-3">
                <div className="mt-0.5 flex h-9 w-9 items-center justify-center rounded-lg bg-ink-700">
                  <Ruler className="h-4.5 w-4.5 text-brand-300" />
                </div>
                <div>
                  <p className="font-semibold text-white">{m.name}</p>
                  {m.instruction && (
                    <p className="mt-0.5 flex items-start gap-1 text-xs text-slate-400">
                      <Info className="mt-0.5 h-3 w-3 shrink-0" />
                      {m.instruction}
                    </p>
                  )}
                </div>
              </div>
              <Toggle on={m.is_active} onClick={() => onToggle(m)} />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function BeforeAfter() {
  const [pos, setPos] = useState(50);
  return (
    <Card className="overflow-hidden">
      <div className="flex items-center gap-2 border-b border-ink-700/60 p-4">
        <Camera className="h-5 w-5 text-brand-300" />
        <div>
          <h3 className="font-bold text-white">Фото «До / После»</h3>
          <p className="text-xs text-slate-400">Сравнение раз в месяц · тяните ползунок</p>
        </div>
      </div>
      <div className="relative mx-auto max-w-md select-none p-4">
        <div className="relative aspect-[3/4] overflow-hidden rounded-xl">
          <img src={AFTER} alt="После" className="absolute inset-0 h-full w-full object-cover" />
          <div
            className="absolute inset-0 overflow-hidden"
            style={{ width: `${pos}%` }}
          >
            <img
              src={BEFORE}
              alt="До"
              className="absolute inset-0 h-full max-w-none object-cover"
              style={{ width: `${10000 / Math.max(pos, 1)}%` }}
            />
          </div>
          <div className="absolute left-3 top-3 rounded-full bg-black/60 px-2.5 py-1 text-xs font-semibold text-white">
            Март
          </div>
          <div className="absolute right-3 top-3 rounded-full bg-brand-500/90 px-2.5 py-1 text-xs font-semibold text-ink-950">
            Август
          </div>
          <div
            className="absolute top-0 h-full w-0.5 bg-white shadow"
            style={{ left: `${pos}%` }}
          >
            <span className="absolute top-1/2 -translate-x-1/2 -translate-y-1/2 flex h-8 w-8 items-center justify-center rounded-full border-2 border-ink-900 bg-white text-ink-900">
              ⇆
            </span>
          </div>
        </div>
        <input
          type="range"
          min="0"
          max="100"
          value={pos}
          onChange={(e) => setPos(Number(e.target.value))}
          className="mt-4 w-full accent-brand-500"
        />
      </div>
    </Card>
  );
}

export default function Metrics({ isDemo }: { isDemo: boolean }) {
  const [metrics, setMetrics] = useState<CustomMetric[] | null>(null);
  const [logs, setLogs] = useState<MetricLog[]>([]);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [photos, setPhotos] = useState<ProgressPhoto[]>([]);
  const [draft, setDraft] = useState<Record<string, string>>({});
  const [settingsOpen, setSettingsOpen] = useState(false);
  const { user } = useAuthUser();

  async function load() {
    if (isDemo) {
      setMetrics(DEMO_METRICS.map((m) => ({ id: m.id, name: m.name, unit: m.unit, is_active: m.is_active, order_index: m.order_index, instruction: m.instruction })));
      setLogs(DEMO_METRICS.flatMap((m) => m.logs.map((l, i) => ({ id: `${m.id}-log-${i}`, metric_id: m.id, date: l.date, value: l.value }))));
      setProfile(null);
      setPhotos([]);
      return;
    }
    const [{ data: m }, { data: l }, { data: p }, { data: ph }] = await Promise.all([
      supabase.from('custom_metrics').select('*').order('order_index'),
      supabase.from('metric_logs').select('*').order('date', { ascending: true }),
      supabase.from('profiles').select('*').limit(1).maybeSingle(),
      supabase.from('progress_photos').select('*').order('taken_date', { ascending: true }),
    ]);
    setMetrics((m as CustomMetric[]) ?? []);
    setLogs((l as MetricLog[]) ?? []);
    setProfile(p as Profile | null);
    setPhotos((ph as ProgressPhoto[]) ?? []);
  }

  useEffect(() => {
    load();
  }, [isDemo]);

  const byMetric = useMemo(() => {
    const map: Record<string, MetricLog[]> = {};
    logs.forEach((l) => {
      (map[l.metric_id] ??= []).push(l);
    });
    return map;
  }, [logs]);

  const measurementPoints: MeasurementPoint[] = useMemo(() => {
    if (!metrics) return [];
    return metrics
      .filter((m) => m.is_active)
      .map((m) => {
        const pos = METRIC_POSITIONS[m.name];
        const entries = byMetric[m.id] ?? [];
        const start = entries.length > 0 ? Number(entries[0].value) : null;
        const current = entries.length > 0 ? Number(entries[entries.length - 1].value) : null;
        return {
          metricId: m.id,
          name: m.name,
          x: pos?.x ?? 160,
          y: pos?.y ?? 300,
          side: pos?.side ?? 'right',
          current,
          start,
        };
      });
  }, [metrics, byMetric]);

  async function toggle(m: CustomMetric) {
    if (isDemo) return;
    setMetrics((prev) =>
      prev!.map((x) => (x.id === m.id ? { ...x, is_active: !x.is_active } : x))
    );
    await supabase.from('custom_metrics').update({ is_active: !m.is_active }).eq('id', m.id);
  }

  async function addValue(m: CustomMetric) {
    if (isDemo) return;
    const raw = draft[m.id];
    const value = Number(raw);
    if (!raw || Number.isNaN(value)) return;
    const { data } = await supabase
      .from('metric_logs')
      .insert({ metric_id: m.id, date: todayISO(), value })
      .select()
      .maybeSingle();
    if (data) setLogs((prev) => [...prev, data as MetricLog]);
    setDraft((d) => ({ ...d, [m.id]: '' }));
  }

  if (!metrics) return <Loader />;

  const active = metrics.filter((m) => m.is_active);
  const gender = profile?.gender ?? 'male';

  return (
    <div className="animate-fade-up space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-extrabold text-white">Замеры и фото</h1>
          <p className="mt-0.5 text-sm text-slate-400">Динамика объёмов и прогресс</p>
        </div>
        <button
          onClick={() => setSettingsOpen(true)}
          disabled={isDemo}
          className="flex h-10 w-10 items-center justify-center rounded-xl border border-ink-700 bg-ink-850 text-slate-400 transition-colors hover:border-brand-500/50 hover:text-brand-300 disabled:opacity-30 disabled:hover:text-slate-400"
          title={isDemo ? 'Недоступно в демо-режиме' : 'Настройки замеров'}
        >
          <Settings className="h-5 w-5" />
        </button>
      </div>

      {/* Active metric charts */}
      <div className="grid gap-4 lg:grid-cols-2">
        {active.map((m) => {
          const data = (byMetric[m.id] ?? []).map((l) => ({
            label: formatShortDate(l.date),
            value: Number(l.value),
          }));
          const first = data[0]?.value ?? 0;
          const last = data[data.length - 1]?.value ?? 0;
          const delta = last - first;
          const down = delta <= 0;
          return (
            <Card key={m.id} className="p-5">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-bold text-white">{m.name}</h3>
                  <p className="text-sm text-slate-400">
                    {data.length ? `${last.toFixed(1)} ${m.unit}` : 'Нет данных'}
                  </p>
                </div>
                {data.length > 1 && (
                  <span
                    className={`flex items-center gap-1 text-sm font-semibold ${
                      down ? 'text-brand-400' : 'text-amber-400'
                    }`}
                  >
                    {down ? <TrendingDown className="h-4 w-4" /> : <TrendingUp className="h-4 w-4" />}
                    {delta >= 0 ? '+' : ''}
                    {delta.toFixed(1)} {m.unit}
                  </span>
                )}
              </div>
              <div className="mt-3">
                <LineChart data={data} height={130} unit={` ${m.unit}`} />
              </div>
              <div className="mt-3 flex gap-2">
                <input
                  type="number"
                  inputMode="decimal"
                  disabled={isDemo}
                  value={draft[m.id] ?? ''}
                  onChange={(e) => setDraft((d) => ({ ...d, [m.id]: e.target.value }))}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') addValue(m);
                  }}
                  placeholder={isDemo ? 'Недоступно в демо-режиме' : `Новое значение, ${m.unit}`}
                  className="flex-1 rounded-lg border border-ink-600 bg-ink-900 px-3 py-2 text-sm text-white outline-none focus:border-brand-500 disabled:opacity-50"
                />
                <button
                  onClick={() => addValue(m)}
                  disabled={isDemo}
                  className="flex items-center gap-1.5 rounded-lg bg-brand-500 px-3.5 py-2 text-sm font-bold text-ink-950 transition-transform hover:scale-105 active:scale-95 disabled:opacity-30 disabled:hover:scale-100"
                  title={isDemo ? 'Недоступно в демо-режиме' : undefined}
                >
                  <Plus className="h-4 w-4" />
                  Записать
                </button>
              </div>
            </Card>
          );
        })}
      </div>

      {active.length === 0 && (
        <Card className="flex items-center gap-3 p-5 text-slate-400">
          <Ruler className="h-5 w-5" />
          Нажмите на значок настроек вверху, чтобы включить параметры для отслеживания.
        </Card>
      )}

      {/* Body Silhouette Visualizer */}
      <SilhouetteCard gender={gender} measurements={measurementPoints} />

      {/* Before / After Photo Gallery */}
      {!isDemo && <PhotoCompare photos={photos} onPhotoUploaded={load} />}

      <SettingsModal
        open={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        metrics={metrics}
        onToggle={toggle}
      />
    </div>
  );
}
