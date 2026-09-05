import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  Dumbbell, Play, X, Trophy, TrendingUp, Check, Calendar, Minus, Plus, Timer,
  Pause, XCircle, Settings, ChevronDown, ChevronUp, Lock, MessageCircle, Video as VideoIcon, Trash2, AlertTriangle, Clock, Sparkles, Save, Loader2, Pencil,
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import type { Exercise, PersonalRecord, WorkoutDay, WorkoutSet, WorkoutTemplate, TemplateExercise } from '@/lib/types';
import { useAuthUser } from '@/lib/useAuthUser';
import { Card, Loader, Badge } from '@/components/ui';
import { epleyE1RM, formatDate, weightFromPercent, youtubeEmbed, todayISO } from '@/lib/calc';

type Mode = 'e1rm' | 'tonnage' | 'kpsh';
const DEFAULT_REST_SECONDS = 90;
const REST_PRESETS = [30, 60, 90, 120, 150, 180];

const MUSCLE_GROUP_LABELS: Record<string, string> = {
  back: 'Спина',
  chest: 'Грудь',
  legs: 'Ноги',
  shoulders: 'Плечи',
  arms: 'Руки',
  biceps: 'Бицепс',
  triceps: 'Трицепс',
  core: 'Пресс',
  glutes: 'Ягодицы',
  general: 'Общее',
  cardio: 'Кардио',
  yoga: 'Йога',
  crossfit: 'Кроссфит',
  running: 'Бег',
  recovery: 'Восстановление',
  functional: 'Функциональный',
};

interface CustomActivity {
  title: string;
  muscle_group: string;
}

const PREDEFINED_ACTIVITIES: CustomActivity[] = [
  { title: 'Йога', muscle_group: 'yoga' },
  { title: 'Бег', muscle_group: 'running' },
  { title: 'Плавание', muscle_group: 'cardio' },
  { title: 'Стретчинг', muscle_group: 'recovery' },
  { title: 'Кроссфит', muscle_group: 'crossfit' },
  { title: 'Велосипед', muscle_group: 'cardio' },
  { title: 'Ходьба', muscle_group: 'cardio' },
  { title: 'Медитация', muscle_group: 'recovery' },
];

const LEGACY_DAY_PATTERNS = ['день а', 'день б', 'день в', 'день с', 'день d', 'день a', 'день b', 'день c'];

function isLegacyDay(d: WorkoutDay): boolean {
  const name = (d.name ?? '').toLowerCase();
  const notes = (d.notes ?? '').toLowerCase();
  return LEGACY_DAY_PATTERNS.some((p) => name.includes(p) || notes.includes(p));
}

function muscleGroupLabel(mg: string | null | undefined): string {
  if (!mg) return 'Общее';
  return MUSCLE_GROUP_LABELS[mg] ?? mg;
}

function groupExercisesByMuscle<T extends { muscle_group?: string | null }>(items: T[]): Map<string, T[]> {
  const map = new Map<string, T[]>();
  for (const item of items) {
    const key = muscleGroupLabel(item.muscle_group);
    const arr = map.get(key) ?? [];
    arr.push(item);
    map.set(key, arr);
  }
  return map;
}

/* ── Rest Timer ── */
function RestTimer({ onClose, seconds }: { onClose: () => void; seconds: number }) {
  const [remaining, setRemaining] = useState(seconds);
  const [paused, setPaused] = useState(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (!paused) {
      intervalRef.current = setInterval(() => {
        setRemaining((r) => {
          if (r <= 1) { if (intervalRef.current) clearInterval(intervalRef.current); onClose(); return 0; }
          return r - 1;
        });
      }, 1000);
    }
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, [paused, onClose]);

  const mins = Math.floor(remaining / 60);
  const secs = remaining % 60;
  const total = seconds;
  const pct = total > 0 ? ((total - remaining) / total) * 100 : 0;
  const r = 26; const c = 2 * Math.PI * r;

  return createPortal(
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/70 p-4">
      <div className="flex items-center gap-3 rounded-2xl border border-brand-500/40 bg-ink-850/95 px-4 py-3 shadow-glow backdrop-blur">
        <div className="relative h-14 w-14">
          <svg viewBox="0 0 64 64" className="h-full w-full -rotate-90">
            <circle cx="32" cy="32" r={r} fill="none" stroke="#1e2b47" strokeWidth="5" />
            <circle cx="32" cy="32" r={r} fill="none" stroke="#34d399" strokeWidth="5" strokeLinecap="round" strokeDasharray={c} strokeDashoffset={c * (1 - pct / 100)} className="transition-all duration-1000 ease-linear" />
          </svg>
          <Timer className="absolute inset-0 m-auto h-5 w-5 text-brand-400" />
        </div>
        <div>
          <p className="text-xs font-semibold text-slate-400">Отдых</p>
          <p className="text-xl font-extrabold tabular-nums text-white">{mins}:{String(secs).padStart(2, '0')}</p>
        </div>
        <button onClick={() => setRemaining((r) => r + 30)} className="flex h-9 w-9 items-center justify-center rounded-lg border border-ink-600 bg-ink-800 text-slate-300 hover:text-brand-300" title="+30 сек"><Plus className="h-4 w-4" /></button>
        <button onClick={() => setPaused((p) => !p)} className="flex h-9 w-9 items-center justify-center rounded-lg border border-ink-600 bg-ink-800 text-slate-300 hover:text-white">{paused ? <Play className="h-4 w-4" /> : <Pause className="h-4 w-4" />}</button>
        <button onClick={onClose} className="flex h-9 w-9 items-center justify-center rounded-lg border border-ink-600 bg-ink-800 text-slate-300 hover:text-red-400"><XCircle className="h-4 w-4" /></button>
      </div>
    </div>,
    document.body,
  );
}

/* ── Settings Modal (metric selector + rest timer toggle) ── */
function SettingsModal({ open, onClose, mode, onModeChange, restTimerEnabled, onRestTimerToggle, restSeconds, onRestSecondsChange }: {
  open: boolean;
  onClose: () => void;
  mode: Mode;
  onModeChange: (m: Mode) => void;
  restTimerEnabled: boolean;
  onRestTimerToggle: (v: boolean) => void;
  restSeconds: number;
  onRestSecondsChange: (s: number) => void;
}) {
  if (!open) return null;
  const modes: [Mode, string, string][] = [['e1rm', 'e1RM', 'Расчётный одноповторный максимум'], ['tonnage', 'Тоннаж', 'Суммарный поднятый вес'], ['kpsh', 'КПШ', 'Количество подъёмов штанги']];
  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4" onClick={onClose}>
      <div className="max-h-[90vh] w-full max-w-sm overflow-y-auto rounded-2xl border border-ink-700 bg-ink-900 p-5" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2"><Settings className="h-5 w-5 text-brand-300" /><h3 className="text-lg font-bold text-white">Настройки тренировки</h3></div>
          <button onClick={onClose} className="text-slate-500 hover:text-slate-300"><X className="h-5 w-5" /></button>
        </div>
        <p className="mt-1 text-sm text-slate-400">Метрика отслеживания прогресса</p>
        <div className="mt-4 space-y-2">
          {modes.map(([m, label, desc]) => (
            <button key={m} onClick={() => onModeChange(m)} className={`flex w-full items-center justify-between rounded-xl border p-3.5 text-left transition-colors ${mode === m ? 'border-brand-500/50 bg-brand-500/15' : 'border-ink-700/60 bg-ink-900/40 hover:border-ink-600'}`}>
              <div><p className="font-semibold text-white">{label}</p><p className="text-xs text-slate-400">{desc}</p></div>
              {mode === m && <Check className="h-5 w-5 text-brand-400" />}
            </button>
          ))}
        </div>
        <div className="mt-4 border-t border-ink-700/60 pt-4">
          <button onClick={() => onRestTimerToggle(!restTimerEnabled)} className="flex w-full items-center justify-between rounded-xl border border-ink-700/60 bg-ink-900/40 p-3.5 text-left transition-colors hover:border-ink-600">
            <div className="flex items-center gap-3">
              <div className={`flex h-9 w-9 items-center justify-center rounded-lg ${restTimerEnabled ? 'bg-brand-500/15 text-brand-300' : 'bg-ink-700 text-slate-500'}`}><Timer className="h-4.5 w-4.5" /></div>
              <div><p className="font-semibold text-white">Таймер отдыха</p><p className="text-xs text-slate-400">Автозапуск после подхода</p></div>
            </div>
            <div className={`relative h-7 w-12 rounded-full transition-colors ${restTimerEnabled ? 'bg-brand-500' : 'bg-ink-700'}`}>
              <span className={`absolute top-1 h-5 w-5 rounded-full bg-white transition-transform ${restTimerEnabled ? 'translate-x-6' : 'translate-x-1'}`} />
            </div>
          </button>
          {restTimerEnabled && (
            <div className="mt-3 rounded-xl border border-ink-700/60 bg-ink-900/40 p-3.5">
              <p className="mb-2.5 text-sm font-semibold text-white">Длительность отдыха по умолчанию</p>
              <div className="flex flex-wrap gap-2">
                {REST_PRESETS.map((s) => (
                  <button key={s} onClick={() => onRestSecondsChange(s)} className={`rounded-lg px-3.5 py-2 text-sm font-bold tabular-nums transition-colors ${restSeconds === s ? 'bg-brand-500 text-ink-950' : 'bg-ink-800 text-slate-400 hover:text-white'}`}>
                    {s < 60 ? `${s}с` : `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>,
    document.body,
  );
}

/* ── Start Workout Modal (template selection + custom activity) ── */
function StartWorkoutModal({ open, onClose, templates, templateExercises, onStartTemplate, onStartCustom }: {
  open: boolean;
  onClose: () => void;
  templates: WorkoutTemplate[];
  templateExercises: Record<string, TemplateExercise[]>;
  onStartTemplate: (t: WorkoutTemplate) => void;
  onStartCustom: (activityTitle: string, durationMin: number) => void;
}) {
  const [view, setView] = useState<'main' | 'custom' | 'duration'>('main');
  const [selectedCustom, setSelectedCustom] = useState<CustomActivity | null>(null);
  const [duration, setDuration] = useState(60);

  useEffect(() => {
    if (!open) { setView('main'); setSelectedCustom(null); setDuration(60); }
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;

  const groupedCustom = groupExercisesByMuscle(PREDEFINED_ACTIVITIES);

  const durationOptions: number[] = [];
  for (let m = 15; m <= 240; m += 15) durationOptions.push(m);

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={onClose}>
      <div className="max-h-[90vh] w-full max-w-md overflow-y-auto rounded-2xl border border-ink-700 bg-ink-900 p-5" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-bold text-white">
            {view === 'main' ? 'Начать тренировку' : view === 'custom' ? 'Другое / активности' : 'Длительность'}
          </h3>
          <button onClick={onClose} className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-500 transition-colors hover:bg-ink-800 hover:text-slate-300"><X className="h-5 w-5" /></button>
        </div>

        {view === 'main' && (
          <>
            <p className="mt-1 text-sm text-slate-400">Выберите шаблон от тренера</p>
            <div className="mt-4 space-y-3">
              {templates.length === 0 && <p className="py-4 text-center text-sm text-slate-500">Шаблоны пока не добавлены</p>}
              {templates.map((t) => {
                const tExes = templateExercises[t.id] ?? [];
                const exList = tExes
                  .map((te) => te.exercises ? { id: te.exercises.id, title: te.exercises.title, muscle_group: te.exercises.muscle_group } : null)
                  .filter((e): e is { id: string; title: string; muscle_group: string | null } => e !== null);
                const grouped = groupExercisesByMuscle(exList);
                return (
                  <button key={t.id} onClick={() => { onStartTemplate(t); onClose(); }} className="flex w-full flex-col gap-2 rounded-xl border border-ink-700/60 bg-ink-900/40 p-3.5 text-left transition-colors hover:border-brand-500/50 hover:bg-brand-500/10">
                    <div className="flex items-center gap-3">
                      <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-ink-700"><Dumbbell className="h-5 w-5 text-brand-300" /></div>
                      <div><p className="font-semibold text-white">{t.title}</p>{t.description && <p className="text-xs text-slate-400">{t.description}</p>}</div>
                    </div>
                    {grouped.size > 0 && (
                      <div className="flex flex-wrap gap-1.5 pl-1">
                        {Array.from(grouped.entries()).map(([group, exs]) => (
                          <span key={group} className="rounded-md bg-ink-700/60 px-2 py-0.5 text-[11px] font-medium text-slate-300">{group}: {exs.map((e) => e.title).join(', ')}</span>
                        ))}
                      </div>
                    )}
                  </button>
                );
              })}
            </div>
            <button onClick={() => setView('custom')} className="mt-3 flex w-full items-center gap-3 rounded-xl border border-ink-700/60 bg-ink-900/40 p-3.5 text-left transition-colors hover:border-brand-500/50 hover:bg-brand-500/10">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-ink-700"><Sparkles className="h-5 w-5 text-brand-300" /></div>
              <div><p className="font-semibold text-white">Другое / активности</p><p className="text-xs text-slate-400">Йога, бег, кроссфит, восстановление</p></div>
            </button>
          </>
        )}

        {view === 'custom' && (
          <>
            <button onClick={() => setView('main')} className="mt-1 flex items-center gap-1 text-sm text-slate-400 hover:text-slate-200"><ChevronDown className="h-4 w-4 rotate-90" /> Назад</button>
            <div className="mt-3 space-y-4">
              {PREDEFINED_ACTIVITIES.length === 0 && <p className="py-4 text-center text-sm text-slate-500">Активности пока не добавлены</p>}
              {Array.from(groupedCustom.entries()).map(([group, exs]) => (
                <div key={group}>
                  <p className="mb-2 text-xs font-bold uppercase tracking-wide text-slate-500">{group}</p>
                  <div className="space-y-2">
                    {exs.map((ex) => (
                      <button key={ex.title} onClick={() => { setSelectedCustom(ex); setView('duration'); }} className="flex w-full items-center gap-3 rounded-xl border border-ink-700/60 bg-ink-900/40 p-3 text-left transition-colors hover:border-brand-500/50 hover:bg-brand-500/10">
                        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-ink-700"><Dumbbell className="h-4.5 w-4.5 text-brand-300" /></div>
                        <p className="font-semibold text-white">{ex.title}</p>
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </>
        )}

        {view === 'duration' && selectedCustom && (
          <>
            <button onClick={() => setView('custom')} className="mt-1 flex items-center gap-1 text-sm text-slate-400 hover:text-slate-200"><ChevronDown className="h-4 w-4 rotate-90" /> Назад</button>
            <div className="mt-6 flex flex-col items-center">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-ink-700"><Clock className="h-5 w-5 text-brand-300" /></div>
              <p className="mt-3 text-sm text-slate-400">{selectedCustom.title}</p>
              <div className="my-6 flex items-baseline gap-1">
                <span className="text-5xl font-extrabold tabular-nums text-white">{duration}</span>
                <span className="text-xl font-bold text-slate-500">мин</span>
              </div>
              <div className="flex items-center gap-3">
                <button onClick={() => setDuration((d) => Math.max(15, d - 15))} className="flex h-12 w-12 items-center justify-center rounded-xl bg-ink-700 text-2xl font-bold text-slate-200 active:scale-90"><Minus className="h-6 w-6" /></button>
                <div className="flex gap-1 px-2 py-1">
                  {durationOptions.slice(Math.max(0, Math.floor(duration / 15) - 3), Math.floor(duration / 15) + 4).map((m) => (
                    <button key={m} onClick={() => setDuration(m)} className={`min-w-[3rem] rounded-lg px-3 py-2 text-sm font-bold tabular-nums transition-colors ${m === duration ? 'bg-brand-500 text-ink-950' : 'bg-ink-800 text-slate-400 hover:text-white'}`}>{m}</button>
                  ))}
                </div>
                <button onClick={() => setDuration((d) => Math.min(240, d + 15))} className="flex h-12 w-12 items-center justify-center rounded-xl bg-ink-700 text-2xl font-bold text-slate-200 active:scale-90"><Plus className="h-6 w-6" /></button>
              </div>
              <button onClick={() => { onStartCustom(selectedCustom.title, duration); onClose(); }} className="mt-6 flex w-full items-center justify-center gap-2 rounded-xl bg-brand-500 py-3.5 font-bold text-ink-950 transition-transform hover:scale-[1.02] active:scale-95">
                <Check className="h-5 w-5" /> Сохранить
              </button>
            </div>
          </>
        )}
      </div>
    </div>,
    document.body,
  );
}

/* ── Confirm Unlock Modal ── */
function ConfirmUnlock({ open, onConfirm, onCancel }: { open: boolean; onConfirm: () => void; onCancel: () => void }) {
  if (!open) return null;
  return createPortal(
    <div className="fixed inset-0 z-[55] flex items-center justify-center bg-black/70 p-4" onClick={onCancel}>
      <div className="w-full max-w-sm rounded-2xl border border-ink-700 bg-ink-900 p-5" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center gap-3"><div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-500/15 text-amber-400"><AlertTriangle className="h-5 w-5" /></div><h3 className="text-lg font-bold text-white">Изменить подход?</h3></div>
        <p className="mt-3 text-sm text-slate-400">Вы уверены, что хотите изменить завершённый подход?</p>
        <div className="mt-5 flex gap-3">
          <button onClick={onCancel} className="flex-1 rounded-xl border border-ink-600 bg-ink-800 py-3 font-bold text-slate-200 hover:bg-ink-700">Отмена</button>
          <button onClick={onConfirm} className="flex-1 rounded-xl bg-amber-500 py-3 font-bold text-ink-950 hover:scale-[1.02] active:scale-95">Изменить</button>
        </div>
      </div>
    </div>,
    document.body,
  );
}

/* ── Confirm Delete Modal ── */
function ConfirmDelete({ open, day, deleting, onConfirm, onCancel }: { open: boolean; day: WorkoutDay | null; deleting: boolean; onConfirm: () => void; onCancel: () => void }) {
  if (!open || !day) return null;
  return (
    <div className="fixed inset-0 z-[55] flex items-center justify-center bg-black/70 p-4" onClick={onCancel}>
      <div className="w-full max-w-sm rounded-2xl border border-ink-700 bg-ink-900 p-5" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center gap-3"><div className="flex h-10 w-10 items-center justify-center rounded-xl bg-red-500/15 text-red-400"><Trash2 className="h-5 w-5" /></div><h3 className="text-lg font-bold text-white">Удалить тренировку?</h3></div>
        <p className="mt-3 text-sm text-slate-400">Вы уверены, что хотите удалить «{day.name ?? 'Тренировка'}»{day.date ? ` от ${formatDate(day.date)}` : ''}? Все подходы будут удалены безвозвратно.</p>
        <div className="mt-5 flex gap-3">
          <button onClick={onCancel} disabled={deleting} className="flex-1 rounded-xl border border-ink-600 bg-ink-800 py-3 font-bold text-slate-200 hover:bg-ink-700 disabled:opacity-60">Отмена</button>
          <button onClick={onConfirm} disabled={deleting} className="flex-1 rounded-xl bg-red-500 py-3 font-bold text-white hover:scale-[1.02] active:scale-95 disabled:opacity-60">{deleting ? <><Loader2 className="mr-1.5 inline h-4 w-4 animate-spin" />Удаление...</> : 'Удалить'}</button>
        </div>
      </div>
    </div>
  );
}

/* ── Set Card (mobile) ── */
function SetCard({ set, planWeight, prevWeight, prevReps, prevNotes, locked, onToggle, onUpdate, onUnlock }: {
  set: WorkoutSet; planWeight: number | null; prevWeight: number | null; prevReps: number | null; prevNotes: string | null; locked: boolean; onToggle: () => void; onUpdate: (patch: Partial<WorkoutSet>) => void; onUnlock: () => void;
}) {
  const filled = set.weight_kg != null && set.reps != null;
  const phW = planWeight ?? prevWeight;
  const phR = set.target_reps ?? prevReps;

  function adjustWeight(delta: number) { const next = Math.max(0, Math.round(((set.weight_kg ?? phW ?? 0) + delta) * 10) / 10); onUpdate({ weight_kg: next }); }
  function adjustReps(delta: number) { const next = Math.max(0, (set.reps ?? phR ?? 0) + delta); onUpdate({ reps: next }); }

  return (
    <div className={`rounded-xl border p-3 transition-colors ${filled ? 'border-brand-500/40 bg-brand-500/10' : 'border-ink-700/60 bg-ink-900/40'} ${locked ? 'opacity-70' : ''}`}>
      <div className="mb-2 flex items-center justify-between">
        <span className="flex h-6 w-6 items-center justify-center rounded-md bg-ink-700 text-xs font-bold text-slate-300">{set.set_number}</span>
        <div className="flex items-center gap-2">
          {locked && <Lock className="h-3.5 w-3.5 text-slate-500" />}
          <span className="text-xs text-slate-500">План: {planWeight ? `${planWeight} × ${set.target_reps}` : prevWeight ? `${prevWeight} × ${prevReps}` : '—'}{set.target_rm_percent ? ` (${set.target_rm_percent}%)` : ''}</span>
        </div>
      </div>
      {prevNotes && <p className="mb-2 text-[11px] text-slate-500">Пред.: {prevNotes}</p>}
      <div className="flex items-center gap-3">
        <div className="flex-1">
          <p className="mb-1 text-center text-[10px] uppercase tracking-wide text-slate-500">Вес, кг</p>
          <div className="flex items-center gap-1.5">
            <button disabled={locked} onClick={() => adjustWeight(-2.5)} className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-ink-700 text-lg font-bold text-slate-200 active:scale-90 disabled:opacity-40"><Minus className="h-5 w-5" /></button>
            <input type="number" inputMode="decimal" disabled={locked} value={set.weight_kg ?? ''} placeholder={phW ? String(phW) : '0'} onChange={(e) => onUpdate({ weight_kg: e.target.value ? Number(e.target.value) : null })} className="w-full rounded-lg border border-ink-600 bg-ink-950 px-2 py-2.5 text-center text-lg font-bold text-white outline-none focus:border-brand-500 disabled:opacity-60" />
            <button disabled={locked} onClick={() => adjustWeight(2.5)} className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-ink-700 text-lg font-bold text-slate-200 active:scale-90 disabled:opacity-40"><Plus className="h-5 w-5" /></button>
          </div>
        </div>
        <div className="flex-1">
          <p className="mb-1 text-center text-[10px] uppercase tracking-wide text-slate-500">Повторы</p>
          <div className="flex items-center gap-1.5">
            <button disabled={locked} onClick={() => adjustReps(-1)} className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-ink-700 text-lg font-bold text-slate-200 active:scale-90 disabled:opacity-40"><Minus className="h-5 w-5" /></button>
            <input type="number" inputMode="numeric" disabled={locked} value={set.reps ?? ''} placeholder={phR ? String(phR) : '0'} onChange={(e) => onUpdate({ reps: e.target.value ? Number(e.target.value) : null })} className="w-full rounded-lg border border-ink-600 bg-ink-950 px-2 py-2.5 text-center text-lg font-bold text-white outline-none focus:border-brand-500 disabled:opacity-60" />
            <button disabled={locked} onClick={() => adjustReps(1)} className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-ink-700 text-lg font-bold text-slate-200 active:scale-90 disabled:opacity-40"><Plus className="h-5 w-5" /></button>
          </div>
        </div>
      </div>
      <input type="text" disabled={locked} value={set.notes ?? ''} placeholder="Заметка к подходу..." onChange={(e) => onUpdate({ notes: e.target.value })} className="mt-2 w-full rounded-lg border border-ink-600 bg-ink-950 px-3 py-2 text-sm text-slate-300 outline-none focus:border-brand-500 disabled:opacity-60" />
      <button onClick={onToggle} className={`mt-2.5 flex w-full items-center justify-center gap-1.5 rounded-lg py-2 text-sm font-bold transition-colors ${filled ? 'bg-brand-500 text-ink-950' : 'border border-ink-600 bg-ink-800 text-slate-300 hover:border-brand-500/50'}`}>
        {locked ? <><Lock className="h-4 w-4" /> Заблокировано — изменить?</> : <><Check className="h-4 w-4" /> {filled ? 'Готово' : 'Отметить подход'}</>}
      </button>
    </div>
  );
}

/* ── Set Row (desktop) ── */
function SetRow({ set, planWeight, prevWeight, prevReps, prevNotes, locked, onUpdate, onUnlock, onToggle }: {
  set: WorkoutSet; planWeight: number | null; prevWeight: number | null; prevReps: number | null; prevNotes: string | null; locked: boolean; onUpdate: (patch: Partial<WorkoutSet>) => void; onUnlock: () => void; onToggle: () => void;
}) {
  const filled = set.weight_kg && set.reps;
  const e1 = filled ? epleyE1RM(Number(set.weight_kg), Number(set.reps)) : 0;
  const phW = planWeight ?? prevWeight;
  const phR = set.target_reps ?? prevReps;
  return (
    <div className="grid grid-cols-[auto_1fr_1fr_1fr_1fr_auto_auto] items-center gap-2 px-4 py-2.5">
      <span className="flex h-6 w-6 items-center justify-center rounded-md bg-ink-700 text-xs font-bold text-slate-300">{set.set_number}{locked && <Lock className="ml-0.5 h-2.5 w-2.5 text-slate-500" />}</span>
      <span className="text-sm text-slate-400">{planWeight ? `${planWeight} × ${set.target_reps}` : prevWeight ? `${prevWeight} × ${prevReps}` : '—'}{set.target_rm_percent ? <span className="ml-1 text-xs text-slate-500">({set.target_rm_percent}%)</span> : null}{prevNotes && <span className="ml-1 text-xs text-slate-600">Пред: {prevNotes}</span>}</span>
      <input type="number" inputMode="decimal" disabled={locked} value={set.weight_kg ?? ''} placeholder={phW ? String(phW) : '0'} onChange={(e) => onUpdate({ weight_kg: e.target.value ? Number(e.target.value) : null })} className="w-full rounded-lg border border-ink-600 bg-ink-900 px-2.5 py-1.5 text-sm text-white outline-none focus:border-brand-500 disabled:opacity-60" />
      <input type="number" inputMode="numeric" disabled={locked} value={set.reps ?? ''} placeholder={phR ? String(phR) : '0'} onChange={(e) => onUpdate({ reps: e.target.value ? Number(e.target.value) : null })} className="w-full rounded-lg border border-ink-600 bg-ink-900 px-2.5 py-1.5 text-sm text-white outline-none focus:border-brand-500 disabled:opacity-60" />
      <input type="text" disabled={locked} value={set.notes ?? ''} placeholder="Заметка..." onChange={(e) => onUpdate({ notes: e.target.value })} className="w-full rounded-lg border border-ink-600 bg-ink-900 px-2.5 py-1.5 text-sm text-slate-300 outline-none focus:border-brand-500 disabled:opacity-60" />
      <span className="flex items-center justify-end gap-1 text-sm font-semibold">{filled ? <><Check className="h-3.5 w-3.5 text-brand-400" /><span className="text-white">{e1.toFixed(0)}</span></> : <span className="text-slate-600">—</span>}</span>
      <button onClick={onToggle} disabled={!filled && !locked} className={`flex h-8 items-center justify-center gap-1 rounded-lg px-3 text-xs font-bold transition-colors disabled:opacity-40 ${locked ? 'border border-ink-600 bg-ink-800 text-slate-400 hover:border-amber-500/50 hover:text-amber-400' : filled ? 'bg-brand-500 text-ink-950 hover:scale-[1.03] active:scale-95' : 'border border-ink-600 bg-ink-800 text-slate-400'}`} title={locked ? 'Изменить подход' : 'Отметить готово'}>
        {locked ? <><Lock className="h-3.5 w-3.5" /> Изменить</> : <><Check className="h-3.5 w-3.5" /> Готово</>}
      </button>
    </div>
  );
}

/* ── Main Workout Component ── */
export default function Workout({ onExerciseComment }: { onExerciseComment?: (exerciseId: string, exerciseTitle: string) => void }) {
  const [days, setDays] = useState<WorkoutDay[] | null>(null);
  const [allSets, setAllSets] = useState<WorkoutSet[]>([]);
  const [exercises, setExercises] = useState<Record<string, Exercise>>({});
  const [prs, setPrs] = useState<Record<string, PersonalRecord>>({});
  const [templates, setTemplates] = useState<WorkoutTemplate[]>([]);
  const [templateExercises, setTemplateExercises] = useState<Record<string, TemplateExercise[]>>({});
  const [activeDay, setActiveDay] = useState<string | null>(null);
  const [mode, setMode] = useState<Mode>('e1rm');
  const [video, setVideo] = useState<string | null>(null);
  const [restActive, setRestActive] = useState(false);
  const [restTimerEnabled, setRestTimerEnabled] = useState(() => {
    try { const v = localStorage.getItem('workout_restTimerEnabled'); return v === null ? true : v === 'true'; } catch { return true; }
  });
  const [restSeconds, setRestSeconds] = useState(() => {
    try { const v = localStorage.getItem('workout_restSeconds'); return v ? Number(v) : DEFAULT_REST_SECONDS; } catch { return DEFAULT_REST_SECONDS; }
  });

  useEffect(() => { try { localStorage.setItem('workout_restTimerEnabled', String(restTimerEnabled)); } catch { /* ignore */ } }, [restTimerEnabled]);
  useEffect(() => { try { localStorage.setItem('workout_restSeconds', String(restSeconds)); } catch { /* ignore */ } }, [restSeconds]);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [startWorkoutOpen, setStartWorkoutOpen] = useState(false);
  const [expandedDay, setExpandedDay] = useState<string | null>(null);
  const [unlockTarget, setUnlockTarget] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [savedFlash, setSavedFlash] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<WorkoutDay | null>(null);
  const [deleting, setDeleting] = useState(false);
  const { user } = useAuthUser();

  const userId = user?.authUser?.id;

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [daysRes, setsRes, exRes, prRes, tmplRes, tmplExRes] = await Promise.all([
          supabase.from('workout_days').select('*').order('date', { ascending: false }),
          supabase.from('workout_sets').select('*'),
          supabase.from('exercises').select('*'),
          supabase.from('personal_records').select('*'),
          supabase.from('workout_templates').select('*').eq('is_custom', false).order('created_at'),
          supabase.from('template_exercises').select('*, exercises(id, title, muscle_group, video_url)').order('order_index'),
        ]);

        if (cancelled) return;

        if (daysRes.error) console.error('[Workout] workout_days error:', daysRes.error);
        if (setsRes.error) console.error('[Workout] workout_sets error:', setsRes.error);
        if (exRes.error) console.error('[Workout] exercises error:', exRes.error);
        if (prRes.error) console.error('[Workout] personal_records error:', prRes.error);
        if (tmplRes.error) console.error('[Workout] workout_templates error:', tmplRes.error);
        if (tmplExRes.error) console.error('[Workout] template_exercises error:', tmplExRes.error);

        console.log('[Workout] fetched:', {
          days: daysRes.data?.length ?? 0,
          sets: setsRes.data?.length ?? 0,
          exercises: exRes.data?.length ?? 0,
          templates: tmplRes.data?.length ?? 0,
          templateExercises: tmplExRes.data?.length ?? 0,
        });

        const flatDays = ((daysRes.data as WorkoutDay[]) ?? []).filter((d) => !isLegacyDay(d));
        const allSetsList = (setsRes.data as WorkoutSet[]) ?? [];
        const exList = (exRes.data as Exercise[]) ?? [];

        const exMap: Record<string, Exercise> = {};
        exList.forEach((e) => { exMap[e.id] = e; });

        const prMap: Record<string, PersonalRecord> = {};
        (prRes.data as PersonalRecord[])?.forEach((p) => (prMap[p.exercise_id] = p));

        setExercises(exMap);
        setPrs(prMap);
        setDays(flatDays);
        setTemplates((tmplRes.data as WorkoutTemplate[]) ?? []);
        setAllSets(allSetsList);
        const tExMap: Record<string, TemplateExercise[]> = {};
        (tmplExRes.data as TemplateExercise[])?.forEach((te) => { (tExMap[te.template_id] ??= []).push(te); });
        setTemplateExercises(tExMap);
      } catch (err) {
        if (!cancelled) {
          console.error('[Workout] fetch failed:', err);
          setDays([]);
        }
      }
    })();
    return () => { cancelled = true; };
  }, [userId]);

  const sets = useMemo(() => allSets.filter((s) => s.workout_day_id === activeDay), [allSets, activeDay]);

  const grouped = useMemo(() => {
    const map = new Map<string, WorkoutSet[]>();
    sets.forEach((s) => { const arr = map.get(s.exercise_id) ?? []; arr.push(s); map.set(s.exercise_id, arr); });
    return Array.from(map.entries()).sort((a, b) => (a[1][0]?.order_index ?? 0) - (b[1][0]?.order_index ?? 0));
  }, [sets]);

  async function updateSet(id: string, patch: Partial<WorkoutSet>) {
    setAllSets((prev) => prev.map((s) => (s.id === id ? { ...s, ...patch } : s)));
    await supabase.from('workout_sets').update(patch).eq('id', id);
  }

  async function completeSet(s: WorkoutSet) {
    if (s.weight_kg == null || s.reps == null) return;
    if (s.is_locked) { setUnlockTarget(s.id); return; }
    await updateSet(s.id, { is_locked: true });
    if (restTimerEnabled) setRestActive(true);
  }

  async function addSet(exerciseId: string, orderIndex: number) {
    const setNum = sets.filter((s) => s.exercise_id === exerciseId).length + 1;
    const { data } = await supabase.from('workout_sets').insert({ workout_day_id: activeDay, exercise_id: exerciseId, order_index: orderIndex, set_number: setNum, is_locked: false }).select().maybeSingle();
    if (data) setAllSets((prev) => [...prev, data as WorkoutSet]);
  }

  async function deleteSet(id: string) {
    await supabase.from('workout_sets').delete().eq('id', id);
    setAllSets((prev) => prev.filter((s) => s.id !== id));
  }

  async function saveWorkout() {
    if (!activeDay) return;
    setSaving(true);
    const daySets = allSets.filter((s) => s.workout_day_id === activeDay);
    for (const s of daySets) {
      const patch: Partial<WorkoutSet> = {
        weight_kg: s.weight_kg,
        reps: s.reps,
        notes: s.notes,
        is_locked: s.is_locked,
      };
      const { error } = await supabase.from('workout_sets').update(patch).eq('id', s.id);
      if (error) console.error('[Workout] save set error:', error, s.id);
    }
    const { error: dayError } = await supabase.from('workout_days').update({ completed: true }).eq('id', activeDay);
    if (dayError) console.error('[Workout] save day error:', dayError);
    setDays((prev) => (prev ?? []).map((d) => d.id === activeDay ? { ...d, completed: true } : d));
    setSaving(false);
    setSavedFlash(true);
    setTimeout(() => {
      setSavedFlash(false);
      setActiveDay(null);
    }, 2500);
  }

  function editPastWorkout(dayId: string) {
    setActiveDay(dayId);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  async function deleteWorkout(dayId: string) {
    setDeleting(true);
    const { error: setsError } = await supabase.from('workout_sets').delete().eq('workout_day_id', dayId);
    if (setsError) console.error('[Workout] delete sets error:', setsError);
    const { error: dayError } = await supabase.from('workout_days').delete().eq('id', dayId);
    if (dayError) console.error('[Workout] delete day error:', dayError);
    setAllSets((prev) => prev.filter((s) => s.workout_day_id !== dayId));
    setDays((prev) => (prev ?? []).filter((d) => d.id !== dayId));
    if (activeDay === dayId) setActiveDay(null);
    setDeleting(false);
    setDeleteTarget(null);
  }

  async function startNewWorkout(template: WorkoutTemplate) {
    const { data: day } = await supabase.from('workout_days').insert({
      week_number: 1, day_name: template.title, title: template.title, name: template.title,
      date: todayISO(), template_id: template.id, user_id: userId, notes: template.title,
    }).select().maybeSingle();
    if (!day) return;
    const tExes = templateExercises[template.id] ?? [];
    const newSets: WorkoutSet[] = [];
    for (const te of tExes) {
      for (let i = 1; i <= te.target_sets; i++) {
        const { data: ws } = await supabase.from('workout_sets').insert({
          workout_day_id: (day as WorkoutDay).id, exercise_id: te.exercise_id, order_index: te.order_index, set_number: i,
          target_weight: te.target_weight, target_reps: te.target_reps, target_rm_percent: te.target_rm_percent, is_locked: false,
        }).select().maybeSingle();
        if (ws) newSets.push(ws as WorkoutSet);
      }
    }
    setDays((prev) => prev ? [day as WorkoutDay, ...prev] : [day as WorkoutDay]);
    setAllSets((prev) => [...prev, ...newSets]);
    setActiveDay((day as WorkoutDay).id);
  }

  async function startCustomActivity(activityTitle: string, durationMin: number) {
    const notes = `${activityTitle} (${durationMin} мин)`;
    const { data: day } = await supabase.from('workout_days').insert({
      week_number: 1, day_name: activityTitle, title: activityTitle, name: activityTitle,
      date: todayISO(), user_id: userId, notes,
    }).select().maybeSingle();
    if (!day) return;
    setDays((prev) => prev ? [day as WorkoutDay, ...prev] : [day as WorkoutDay]);
    setActiveDay((day as WorkoutDay).id);
  }

  function getPrevSession(exerciseId: string): { weight: number | null; reps: number | null; notes: string | null } {
    if (!days) return { weight: null, reps: null, notes: null };
    const prevDays = days.filter((d) => d.id !== activeDay).sort((a, b) => (b.date ?? '').localeCompare(a.date ?? ''));
    for (const d of prevDays) {
      const prevSets = allSets.filter((s) => s.exercise_id === exerciseId && s.workout_day_id === d.id && s.weight_kg != null && s.reps != null);
      if (prevSets.length) {
        const notesStr = prevSets.map((s) => `${Number(s.weight_kg).toFixed(1)}×${s.reps}`).join('/');
        return { weight: Number(prevSets[0].weight_kg), reps: prevSets[0].reps, notes: notesStr };
      }
    }
    return { weight: null, reps: null, notes: null };
  }

  if (!days) return <Loader label="Загрузка тренировок..." />;

  const activeDayObj = days.find((d) => d.id === activeDay);
  const pastDays = days
    .filter((d) => d.id !== activeDay && !isLegacyDay(d))
    .sort((a, b) => (b.date ?? '').localeCompare(a.date ?? ''));

  return (
    <div className="animate-fade-up space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-extrabold text-white">{activeDayObj?.name ?? 'Тренировки'}</h1>
          <p className="mt-0.5 text-sm text-slate-400">{activeDayObj ? (activeDayObj.date ? formatDate(activeDayObj.date) : 'Сегодня') : 'Программа от тренера'}</p>
        </div>
        <button onClick={() => setSettingsOpen(true)} className="flex h-10 w-10 items-center justify-center rounded-xl border border-ink-700 bg-ink-850 text-slate-400 transition-colors hover:border-brand-500/50 hover:text-brand-300" title="Настройки"><Settings className="h-5 w-5" /></button>
      </div>

      {/* Start new workout */}
      <button onClick={() => setStartWorkoutOpen(true)} className="flex w-full items-center justify-center gap-2.5 rounded-xl bg-brand-500 py-4 font-bold text-ink-950 shadow-glow transition-transform hover:scale-[1.02] active:scale-95">
        <Plus className="h-5 w-5" /> Начать тренировку
      </button>

      {/* Empty state */}
      {days.length === 0 && (
        <Card className="flex flex-col items-center gap-3 p-10 text-center">
          <Dumbbell className="h-10 w-10 text-slate-600" />
          <p className="text-slate-400">Тренировок пока нет.</p>
          <p className="text-sm text-slate-500">Нажмите кнопку выше, чтобы начать.</p>
        </Card>
      )}

      {/* Active workout */}
      {activeDayObj && grouped.length > 0 && (
        <div className="space-y-4">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 text-sm font-semibold text-brand-300"><span className={`h-2 w-2 rounded-full ${activeDayObj.completed ? 'bg-emerald-400' : 'bg-brand-400 animate-pulse'}`} /> {activeDayObj.completed ? 'Завершено' : (activeDayObj?.name ?? 'Активная тренировка')}</div>
            {activeDayObj.completed && <span className="rounded-md bg-emerald-500/15 px-2 py-0.5 text-[11px] font-semibold text-emerald-400">Сохранено</span>}
          </div>
          {grouped.map(([exId, exSets]) => {
            const ex = exercises[exId];
            const pr = prs[exId];
            const prMax = pr?.rm1 ? Number(pr.rm1) : 0;
            const prev = getPrevSession(exId);
            const done = exSets.filter((s) => s.weight_kg != null && s.reps != null);
            const bestE1RM = Math.max(0, ...done.map((s) => epleyE1RM(Number(s.weight_kg), Number(s.reps))));
            const tonnage = done.reduce((sum, s) => sum + Number(s.weight_kg) * Number(s.reps), 0);
            const kpsh = done.reduce((sum, s) => sum + Number(s.reps), 0);
            const isNewPR = bestE1RM > prMax && prMax > 0;
            const delta = prMax > 0 ? bestE1RM - prMax : 0;

            return (
              <Card key={exId} className="overflow-hidden">
                <div className="flex items-center justify-between gap-3 border-b border-ink-700/60 p-4">
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-ink-700"><Dumbbell className="h-5 w-5 text-brand-300" /></div>
                    <div>
                      <h3 className="font-bold text-white">{ex?.title ?? 'Упражнение'}</h3>
                      <p className="text-xs text-slate-400">
                        {ex?.muscle_group && <span className="text-brand-400/80">{muscleGroupLabel(ex.muscle_group)}</span>}
                        {ex?.muscle_group && (pr?.rm1 || prev.weight) ? ' · ' : ''}
                        {pr?.rm1 ? `1ПМ: ${Number(pr.rm1).toFixed(0)} кг` : ''}
                        {pr?.rm1 && prev.weight ? ' · ' : ''}
                        {prev.weight ? `Пред.: ${prev.weight}×${prev.reps}` : ''}
                        {!pr?.rm1 && !prev.weight ? 'Рекорд не задан' : ''}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {onExerciseComment && <button onClick={() => onExerciseComment(exId, ex?.title ?? 'Упражнение')} className="flex h-9 w-9 items-center justify-center rounded-lg border border-ink-600 bg-ink-800 text-slate-400 transition-colors hover:border-brand-500/50 hover:text-brand-300" title="Комментарий тренеру"><MessageCircle className="h-4 w-4" /></button>}
                    {ex?.video_url && <button onClick={() => setVideo(youtubeEmbed(ex.video_url))} className="flex h-9 w-9 items-center justify-center rounded-lg border border-ink-600 bg-ink-800 text-slate-400 transition-colors hover:border-brand-500/50 hover:text-brand-300" title="Видео техники"><Play className="h-4 w-4" /></button>}
                  </div>
                </div>

                {prev.notes && (
                  <div className="border-b border-ink-700/40 bg-ink-900/20 px-4 py-2">
                    <p className="text-xs text-slate-500">Предыдущая сессия: {prev.notes}</p>
                  </div>
                )}

                {/* Desktop table */}
                <div className="hidden divide-y divide-ink-700/40 sm:block">
                  <div className="grid grid-cols-[auto_1fr_1fr_1fr_1fr_auto_auto] gap-2 px-4 py-2 text-[11px] font-semibold uppercase tracking-wide text-slate-500"><span>Сет</span><span>План</span><span>Вес, кг</span><span>Повторы</span><span>Заметка</span><span className="text-right">e1RM</span><span className="text-right">Готово</span></div>
                  {exSets.map((s) => {
                    const planWeight = s.target_weight ?? (pr?.rm1 && s.target_rm_percent ? weightFromPercent(Number(pr.rm1), s.target_rm_percent) : null);
                    return <SetRow key={s.id} set={s} planWeight={planWeight} prevWeight={prev.weight} prevReps={prev.reps} prevNotes={prev.notes} locked={s.is_locked} onUpdate={(patch) => updateSet(s.id, patch)} onUnlock={() => setUnlockTarget(s.id)} onToggle={() => completeSet(s)} />;
                  })}
                </div>

                {/* Mobile cards */}
                <div className="space-y-2.5 p-3 sm:hidden">
                  {exSets.map((s) => {
                    const planWeight = s.target_weight ?? (pr?.rm1 && s.target_rm_percent ? weightFromPercent(Number(pr.rm1), s.target_rm_percent) : null);
                    return <SetCard key={s.id} set={s} planWeight={planWeight} prevWeight={prev.weight} prevReps={prev.reps} prevNotes={prev.notes} locked={s.is_locked} onUpdate={(patch) => updateSet(s.id, patch)} onToggle={() => completeSet(s)} onUnlock={() => setUnlockTarget(s.id)} />;
                  })}
                </div>

                {/* Add/remove set + media — desktop only */}
                <div className="hidden items-center gap-2 border-t border-ink-700/60 bg-ink-900/40 p-3 md:flex">
                  <button onClick={() => addSet(exId, exSets[0]?.order_index ?? 0)} className="flex items-center gap-1.5 rounded-lg border border-ink-600 bg-ink-800 px-3 py-2 text-xs font-semibold text-slate-200 hover:border-brand-500/50 hover:text-brand-300"><Plus className="h-3.5 w-3.5" /> Добавить сет</button>
                  {exSets.length > 1 && <button onClick={() => deleteSet(exSets[exSets.length - 1].id)} className="flex items-center gap-1.5 rounded-lg border border-ink-600 bg-ink-800 px-3 py-2 text-xs font-semibold text-slate-200 hover:border-red-500/50 hover:text-red-400"><Trash2 className="h-3.5 w-3.5" /> Удалить</button>}
                  <button className="ml-auto flex items-center gap-1.5 rounded-lg border border-ink-600 bg-ink-800 px-3 py-2 text-xs font-semibold text-slate-200 hover:border-brand-500/50 hover:text-brand-300"><VideoIcon className="h-3.5 w-3.5" /> Видео</button>
                </div>

                {/* Summary */}
                <div className="flex flex-wrap items-center gap-3 border-t border-ink-700/60 bg-ink-900/40 p-4">
                  {mode === 'e1rm' && bestE1RM > 0 && (<><Badge tone="brand"><TrendingUp className="h-3 w-3" /> e1RM {bestE1RM.toFixed(0)} кг</Badge>{prMax > 0 && !isNewPR && <span className="text-xs text-slate-400">{delta >= 0 ? '+' : ''}{delta.toFixed(1)} кг к рекорду</span>}{isNewPR && <Badge tone="amber"><Trophy className="h-3 w-3" /> Новый рекорд! +{delta.toFixed(1)} кг</Badge>}</>)}
                  {mode === 'tonnage' && <Badge tone="sky">Тоннаж: {tonnage.toLocaleString('ru-RU')} кг</Badge>}
                  {mode === 'kpsh' && <Badge tone="sky">КПШ: {kpsh} подъёмов</Badge>}
                  {bestE1RM === 0 && <span className="text-xs text-slate-500">Внесите фактические подходы</span>}
                </div>
              </Card>
            );
          })}
          {/* Save workout button */}
          <button onClick={saveWorkout} disabled={saving} className={`flex w-full items-center justify-center gap-2.5 rounded-xl py-4 font-bold shadow-glow transition-transform hover:scale-[1.02] active:scale-95 disabled:opacity-60 disabled:hover:scale-100 ${savedFlash ? 'bg-emerald-500 text-white' : 'bg-brand-500 text-ink-950'}`}>
            {saving ? <><Loader2 className="h-5 w-5 animate-spin" /> Сохранение...</> : savedFlash ? <><Check className="h-5 w-5" /> Сохранено!</> : <><Save className="h-5 w-5" /> Сохранить тренировку</>}
          </button>
        </div>
      )}

      {/* Custom activity days (no sets) */}
      {activeDayObj && grouped.length === 0 && activeDayObj.notes && (
        <Card className="flex items-center gap-4 p-5">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-brand-500/15"><Clock className="h-6 w-6 text-brand-300" /></div>
          <div>
            <p className="font-bold text-white">{activeDayObj.name ?? 'Активность'}</p>
            <p className="text-sm text-slate-400">{activeDayObj.notes}</p>
          </div>
        </Card>
      )}

      {/* Past workouts feed */}
      {pastDays.length > 0 && (
        <div className="space-y-3">
          <h2 className="text-sm font-bold uppercase tracking-wide text-slate-500">История тренировок</h2>
          {pastDays.map((d) => {
            const daySets = allSets.filter((s) => s.workout_day_id === d.id);
            const isExpanded = expandedDay === d.id;
            const dayExes = new Map<string, WorkoutSet[]>();
            daySets.forEach((s) => { const arr = dayExes.get(s.exercise_id) ?? []; arr.push(s); dayExes.set(s.exercise_id, arr); });
            const totalTonnage = daySets.reduce((sum, s) => sum + (s.weight_kg ? Number(s.weight_kg) * Number(s.reps ?? 0) : 0), 0);
            const totalKpsh = daySets.reduce((sum, s) => sum + (s.reps ?? 0), 0);
            const exerciseCount = dayExes.size;
            const isCustomActivity = daySets.length === 0 && d.notes;
            return (
              <Card key={d.id} className="overflow-hidden">
                <button onClick={() => setExpandedDay(isExpanded ? null : d.id)} className="flex w-full items-center justify-between p-4 text-left">
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-ink-700">{isCustomActivity ? <Clock className="h-5 w-5 text-slate-400" /> : <Calendar className="h-5 w-5 text-slate-400" />}</div>
                    <div>
                      <p className="font-bold text-white">{d.name ?? 'Тренировка'}</p>
                      <p className="text-xs text-slate-400">
                        {d.date ? formatDate(d.date) : '—'}
                        {isCustomActivity && d.notes ? ` · ${d.notes}` : ''}
                        {exerciseCount > 0 && ` · ${exerciseCount} упр.`}
                        {totalTonnage > 0 && ` · ${totalTonnage.toLocaleString('ru-RU')} кг`}
                        {totalKpsh > 0 && ` · ${totalKpsh} подъёмов`}
                      </p>
                    </div>
                  </div>
                  {isExpanded ? <ChevronUp className="h-5 w-5 text-slate-500" /> : <ChevronDown className="h-5 w-5 text-slate-500" />}
                </button>
                {isExpanded && !isCustomActivity && (
                  <div className="space-y-3 border-t border-ink-700/60 p-4">
                    {dayExes.size === 0 && <p className="text-sm text-slate-500">Нет записанных подходов</p>}
                    {Array.from(dayExes.entries()).map(([exId, exSets]) => {
                      const ex = exercises[exId];
                      const done = exSets.filter((s) => s.weight_kg != null && s.reps != null);
                      const bestE1 = Math.max(0, ...done.map((s) => epleyE1RM(Number(s.weight_kg), Number(s.reps))));
                      const setsSummary = `${exSets.length} сет.: ${exSets.map((s) => `${s.weight_kg != null ? `${Number(s.weight_kg).toFixed(1)} кг` : '—'} × ${s.reps ?? '—'}`).join(', ')}`;
                      return (
                        <div key={exId} className="rounded-xl border border-ink-700/60 bg-ink-900/40 p-3">
                          <div className="flex items-center justify-between">
                            <p className="font-semibold text-white">{ex?.title ?? 'Упражнение'}</p>
                            {bestE1 > 0 && <span className="text-xs font-semibold text-brand-400">e1RM {bestE1.toFixed(0)} кг</span>}
                          </div>
                          <p className="mt-1.5 text-xs text-slate-400">{setsSummary}</p>
                        </div>
                      );
                    })}
                    <div className="flex gap-2">
                      <button onClick={() => editPastWorkout(d.id)} className="flex flex-1 items-center justify-center gap-2 rounded-lg border border-ink-600 bg-ink-800 py-2.5 text-sm font-semibold text-slate-200 transition-colors hover:border-brand-500/50 hover:text-brand-300">
                        <Pencil className="h-4 w-4" /> Редактировать
                      </button>
                      <button onClick={() => setDeleteTarget(d)} className="flex items-center justify-center gap-2 rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-2.5 text-sm font-semibold text-red-400 transition-colors hover:border-red-500/60 hover:bg-red-500/20" title="Удалить тренировку">
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                )}
                {isExpanded && isCustomActivity && (
                  <div className="space-y-3 border-t border-ink-700/60 p-4">
                    <button onClick={() => setDeleteTarget(d)} className="flex w-full items-center justify-center gap-2 rounded-lg border border-red-500/30 bg-red-500/10 py-2.5 text-sm font-semibold text-red-400 transition-colors hover:border-red-500/60 hover:bg-red-500/20">
                      <Trash2 className="h-4 w-4" /> Удалить активность
                    </button>
                  </div>
                )}
              </Card>
            );
          })}
        </div>
      )}

      {/* Overlays */}
      {restActive && <RestTimer onClose={() => setRestActive(false)} seconds={restSeconds} />}
      <SettingsModal open={settingsOpen} onClose={() => setSettingsOpen(false)} mode={mode} onModeChange={setMode} restTimerEnabled={restTimerEnabled} onRestTimerToggle={setRestTimerEnabled} restSeconds={restSeconds} onRestSecondsChange={setRestSeconds} />
      <StartWorkoutModal open={startWorkoutOpen} onClose={() => setStartWorkoutOpen(false)} templates={templates} templateExercises={templateExercises} onStartTemplate={startNewWorkout} onStartCustom={startCustomActivity} />
      <ConfirmUnlock open={!!unlockTarget} onConfirm={() => { if (unlockTarget) updateSet(unlockTarget, { is_locked: false }); setUnlockTarget(null); }} onCancel={() => setUnlockTarget(null)} />
      <ConfirmDelete open={!!deleteTarget} day={deleteTarget} deleting={deleting} onConfirm={() => { if (deleteTarget) deleteWorkout(deleteTarget.id); }} onCancel={() => setDeleteTarget(null)} />

      {/* Video modal */}
      {video && createPortal(
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4" onClick={() => setVideo(null)}>
          <div className="relative w-full max-w-3xl overflow-hidden rounded-2xl border border-ink-700 bg-ink-900" onClick={(e) => e.stopPropagation()}>
            <button onClick={() => setVideo(null)} className="absolute right-3 top-3 z-10 flex h-9 w-9 items-center justify-center rounded-full bg-ink-950/80 text-slate-300 hover:text-white"><X className="h-5 w-5" /></button>
            <div className="aspect-video w-full"><iframe src={video} title="Техника упражнения" className="h-full w-full" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowFullScreen /></div>
          </div>
        </div>,
        document.body,
      )}
    </div>
  );
}
