import { useEffect, useState } from 'react';
import { Settings, X, Check } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import type { DailyLog, NutritionTargets } from '@/lib/types';
import { Card, Loader } from '@/components/ui';
import { AnalyticsMatrix } from '@/components/AnalyticsMatrix';
import { DEMO_LOGS, DEMO_TARGETS } from '@/lib/demoData';

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
      <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl border border-ink-700 bg-ink-900 p-6" onClick={(e) => e.stopPropagation()}>
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

export default function Nutrition({ isDemo }: { isDemo: boolean }) {
  const [logs, setLogs] = useState<DailyLog[] | null>(null);
  const [targets, setTargets] = useState<NutritionTargets | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);

  useEffect(() => {
    if (isDemo) {
      setLogs(DEMO_LOGS);
      setTargets(DEMO_TARGETS);
      return;
    }
    (async () => {
      const { data: logData } = await supabase.from('daily_logs').select('*').order('date', { ascending: true });
      const { data: targetData } = await supabase.from('nutrition_targets').select('*').maybeSingle();
      setLogs((logData as DailyLog[]) ?? []);
      setTargets(targetData as NutritionTargets | null);
    })();
  }, [isDemo]);

  if (!logs) return <Loader />;
  if (logs.length === 0) return <p className="py-20 text-center text-slate-500">Дневник пуст</p>;

  return (
    <>
      <div className="animate-fade-up space-y-6">
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-2xl font-extrabold text-white">Аналитика</h1>
            <p className="mt-0.5 text-sm text-slate-400">КБЖУ, сон, шаги и тренд веса</p>
          </div>
          <button onClick={() => setSettingsOpen(true)} disabled={isDemo} className="flex h-10 w-10 items-center justify-center rounded-xl border border-ink-700 bg-ink-850 text-slate-400 transition-colors hover:border-brand-500/50 hover:text-brand-300 disabled:opacity-30 disabled:hover:text-slate-400" title={isDemo ? 'Недоступно в демо-режиме' : 'Настройки целей'}>
            <Settings className="h-5 w-5" />
          </button>
        </div>

        <AnalyticsMatrix logs={logs} targets={targets} isDemo={isDemo} />
      </div>

      <TargetsModal open={settingsOpen} onClose={() => setSettingsOpen(false)} targets={targets} onSaved={(t) => setTargets(t)} />
    </>
  );
}
