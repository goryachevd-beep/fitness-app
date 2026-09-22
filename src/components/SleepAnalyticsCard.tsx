import { Moon } from 'lucide-react';
import type { DailyLog } from '@/lib/types';
import { Card } from '@/components/ui';
import { formatShortDate } from '@/lib/calc';

const SLEEP_STYLES: Record<number, { dot: string; label: string; text: string }> = {
  5: { dot: 'bg-emerald-500', label: 'Выспался', text: 'text-emerald-400' },
  3: { dot: 'bg-amber-500', label: 'Недоспал', text: 'text-amber-400' },
  1: { dot: 'bg-red-500', label: 'Не выспался', text: 'text-red-400' },
};

export function SleepAnalyticsCard({ logs }: { logs: DailyLog[] }) {
  const sleepLogs = logs.filter((l) => l.sleep_quality != null);

  const total = sleepLogs.length;
  const avgScore = total ? sleepLogs.reduce((s, l) => s + (l.sleep_quality as number), 0) / total : 0;
  const goodDays = sleepLogs.filter((l) => l.sleep_quality === 5).length;
  const okDays = sleepLogs.filter((l) => l.sleep_quality === 3).length;
  const badDays = sleepLogs.filter((l) => l.sleep_quality === 1).length;
  const qualityPct = total ? Math.round((goodDays / total) * 100) : 0;

  if (total === 0) {
    return (
      <Card className="p-5 sm:p-6">
        <h2 className="flex items-center gap-2 text-lg font-bold text-white">
          <Moon className="h-5 w-5 text-sky-400" /> Сон за период
        </h2>
        <p className="py-10 text-center text-sm text-slate-500">Нет данных за период</p>
      </Card>
    );
  }

  const width = 640;
  const height = 160;
  const pad = 28;
  const chartHeight = height - pad * 2;
  const innerWidth = width - pad * 2;

  const x = (i: number) => pad + (i * innerWidth) / Math.max(total - 1, 1);
  const yFor = (q: number) => pad + chartHeight * (1 - (q - 1) / 4);

  const step = Math.max(1, Math.ceil(total / 6));

  return (
    <Card className="p-5 sm:p-6">
      <h2 className="flex items-center gap-2 text-lg font-bold text-white">
        <Moon className="h-5 w-5 text-sky-400" /> Сон за период
      </h2>

      <div className="mt-4 grid grid-cols-3 gap-4">
        <div>
          <p className="text-xs text-slate-500">Средняя оценка</p>
          <p className="text-xl font-extrabold text-white">{avgScore.toFixed(1)}<span className="text-sm font-normal text-slate-500">/5</span></p>
        </div>
        <div>
          <p className="text-xs text-slate-500">Дней выспался</p>
          <p className="text-xl font-extrabold text-emerald-400">{goodDays}</p>
        </div>
        <div>
          <p className="text-xs text-slate-500">Качество сна</p>
          <p className="text-xl font-extrabold text-white">{qualityPct}%</p>
        </div>
      </div>

      <div className="mt-4">
        <svg viewBox={`0 0 ${width} ${height}`} className="w-full" preserveAspectRatio="none" style={{ height }}>
          {[1, 3, 5].map((q) => (
            <g key={q}>
              <line
                x1={pad}
                x2={width - pad}
                y1={yFor(q)}
                y2={yFor(q)}
                stroke="#1e293b"
                strokeWidth="1"
                strokeDasharray="3 4"
              />
              <text x={pad - 6} y={yFor(q) + 3} textAnchor="end" className="fill-slate-600" style={{ fontSize: 10 }}>
                {q}
              </text>
            </g>
          ))}

          {sleepLogs.map((l, i) => {
            const q = l.sleep_quality as number;
            const cx = x(i);
            const cy = yFor(q);
            const fill = q === 5 ? '#10b981' : q === 3 ? '#f59e0b' : '#ef4444';
            return (
              <g key={i}>
                {i > 0 && sleepLogs[i - 1] && (
                  <line
                    x1={x(i - 1)}
                    y1={yFor(sleepLogs[i - 1].sleep_quality as number)}
                    x2={cx}
                    y2={cy}
                    stroke="#334155"
                    strokeWidth="1.5"
                  />
                )}
                <circle cx={cx} cy={cy} r="5" fill={fill} stroke="#0f172a" strokeWidth="1.5" />
                {(i % step === 0 || i === total - 1) && (
                  <text x={cx} y={height - 8} textAnchor="middle" className="fill-slate-500" style={{ fontSize: 11 }}>
                    {formatShortDate(l.date)}
                  </text>
                )}
              </g>
            );
          })}
        </svg>
      </div>

      <div className="mt-2 flex flex-wrap items-center gap-4 text-xs text-slate-400">
        <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full bg-emerald-500" /> Выспался ({goodDays})</span>
        <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full bg-amber-500" /> Недоспал ({okDays})</span>
        <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full bg-red-500" /> Не выспался ({badDays})</span>
      </div>
    </Card>
  );
}
