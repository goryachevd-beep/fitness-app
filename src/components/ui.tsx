import { ReactNode } from 'react';

export function Card({
  children,
  className = '',
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`rounded-2xl border border-ink-700/60 bg-ink-850/80 backdrop-blur ${className}`}
    >
      {children}
    </div>
  );
}

export function SectionTitle({
  title,
  subtitle,
  action,
}: {
  title: string;
  subtitle?: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex items-end justify-between gap-4">
      <div>
        <h2 className="text-lg font-bold text-white">{title}</h2>
        {subtitle && <p className="mt-0.5 text-sm text-slate-400">{subtitle}</p>}
      </div>
      {action}
    </div>
  );
}

export function Badge({
  children,
  tone = 'brand',
}: {
  children: ReactNode;
  tone?: 'brand' | 'amber' | 'slate' | 'sky';
}) {
  const tones: Record<string, string> = {
    brand: 'bg-brand-500/15 text-brand-300 border-brand-500/30',
    amber: 'bg-amber-500/15 text-amber-300 border-amber-500/30',
    slate: 'bg-slate-500/15 text-slate-300 border-slate-500/30',
    sky: 'bg-sky-500/15 text-sky-300 border-sky-500/30',
  };
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs font-semibold ${tones[tone]}`}
    >
      {children}
    </span>
  );
}

export function Loader({ label = 'Загрузка...' }: { label?: string }) {
  return (
    <div className="flex items-center justify-center gap-3 py-20 text-slate-400">
      <span className="h-5 w-5 animate-spin rounded-full border-2 border-brand-400 border-t-transparent" />
      {label}
    </div>
  );
}

export function Toast({ message, tone = 'success' }: { message: string; tone?: 'success' | 'error' }) {
  return (
    <div
      className={`fixed bottom-6 left-1/2 z-50 -translate-x-1/2 animate-fade-up rounded-xl border px-5 py-3 text-sm font-semibold shadow-lg backdrop-blur ${
        tone === 'success'
          ? 'border-brand-500/40 bg-brand-500/15 text-brand-200'
          : 'border-rose-500/40 bg-rose-500/15 text-rose-200'
      }`}
    >
      {message}
    </div>
  );
}
