import { useEffect, useState } from 'react';
import {
  LayoutDashboard,
  Dumbbell,
  Ruler,
  MessageCircle,
  UtensilsCrossed,
  Activity,
  Crown,
  Scale,
  Settings,
  Loader2,
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import type { Profile } from '@/lib/types';
import { useAuthUser } from '@/lib/useAuthUser';
import Dashboard from '@/screens/Dashboard';
import Nutrition from '@/screens/Nutrition';
import Workout from '@/screens/Workout';
import Metrics from '@/screens/Metrics';
import Chat from '@/screens/Chat';
import Recipes from '@/screens/Recipes';
import ProfileSettingsModal from '@/components/ProfileSettingsModal';

function SignIn() {
  const [busy, setBusy] = useState(false);
  const [demoBusy, setDemoBusy] = useState(false);

  async function handleSignIn() {
    setBusy(true);
    await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: window.location.origin },
    });
  }

  async function handleDemoSignIn() {
    setDemoBusy(true);
    await supabase.auth.signInWithPassword({
      email: 'demo@forma-app.com',
      password: '89022285379',
    });
    setDemoBusy(false);
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-ink-950 px-6 text-center">
      <div className="flex flex-col items-center gap-8">
        <div className="flex h-20 w-20 items-center justify-center rounded-3xl bg-brand-500 shadow-glow">
          <Activity className="h-10 w-10 text-ink-950" strokeWidth={2.5} />
        </div>
        <div>
          <h1 className="text-4xl font-extrabold tracking-tight text-white">ФОРМА</h1>
          <p className="mt-2 text-base text-slate-400">Тренер в кармане</p>
        </div>
        <button
          onClick={handleSignIn}
          disabled={busy}
          className="flex items-center justify-center gap-3 rounded-xl bg-brand-500 px-8 py-4 text-base font-bold text-ink-950 shadow-glow transition-transform hover:scale-[1.02] active:scale-95 disabled:opacity-60 disabled:hover:scale-100"
        >
          {busy ? <Loader2 className="h-5 w-5 animate-spin" /> : <Activity className="h-5 w-5" strokeWidth={2.5} />}
          Войти через Google
        </button>
        <button
          onClick={handleDemoSignIn}
          disabled={demoBusy}
          className="flex items-center justify-center gap-2 rounded-xl border border-slate-700 px-6 py-3 text-sm font-semibold text-slate-300 transition-colors hover:border-slate-600 hover:text-slate-200 disabled:opacity-60"
        >
          {demoBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
          Войти как Гость (Demo)
        </button>
      </div>
    </div>
  );
}

type Tab = 'today' | 'nutrition' | 'workout' | 'metrics' | 'chat' | 'recipes';

const NAV: { id: Tab; label: string; icon: typeof LayoutDashboard }[] = [
  { id: 'today', label: 'Сегодня', icon: LayoutDashboard },
  { id: 'nutrition', label: 'Питание и вес', icon: Scale },
  { id: 'workout', label: 'Тренировки', icon: Dumbbell },
  { id: 'metrics', label: 'Замеры', icon: Ruler },
  { id: 'chat', label: 'Чат', icon: MessageCircle },
  { id: 'recipes', label: 'Рецепты', icon: UtensilsCrossed },
];

function Avatar({ name, url, size = 'md' }: { name: string; url: string | null; size?: 'sm' | 'md' }) {
  const dim = size === 'sm' ? 'h-9 w-9 text-sm' : 'h-10 w-10 text-base';
  const initials = name.trim().charAt(0).toUpperCase() || '?';
  if (url) {
    return <img src={url} alt={name} className={`${dim} rounded-full object-cover`} />;
  }
  return (
    <div className={`${dim} flex items-center justify-center rounded-full bg-brand-500/15 font-extrabold text-brand-300`}>
      {initials}
    </div>
  );
}

function App() {
  const [tab, setTab] = useState<Tab>('today');
  const [coach, setCoach] = useState<Profile | null>(null);
  const [exerciseContext, setExerciseContext] = useState<{ id: string; title: string } | null>(null);
  const [profileOpen, setProfileOpen] = useState(false);

  const { user, loading, reload, isDemo } = useAuthUser();

  useEffect(() => {
    supabase
      .from('profiles')
      .select('*')
      .then(({ data }) => {
        if (!data) return;
        setCoach(data.find((p) => p.role === 'coach') ?? null);
      });
  }, []);

  function handleExerciseComment(exerciseId: string, exerciseTitle: string) {
    setExerciseContext({ id: exerciseId, title: exerciseTitle });
    setTab('chat');
  }

  const displayName = user?.displayName ?? 'Гость';
  const avatarUrl = user?.avatarUrl ?? null;

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-ink-950">
        <Loader2 className="h-8 w-8 animate-spin text-brand-400" />
      </div>
    );
  }

  if (!user?.authUser) {
    return <SignIn />;
  }

  return (
    <div className="min-h-screen bg-ink-950 text-slate-200">
      {isDemo && (
        <div className="w-full bg-amber-500/15 px-4 py-2 text-center text-sm font-medium text-amber-300">
          Демо-режим: только просмотр
        </div>
      )}
      <div className="mx-auto flex max-w-6xl">
        {/* Sidebar (desktop) */}
        <aside className="sticky top-0 hidden h-screen w-64 shrink-0 flex-col border-r border-ink-800 px-5 py-7 lg:flex">
          <div className="flex items-center gap-2.5">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-500 shadow-glow">
              <Activity className="h-5 w-5 text-ink-950" strokeWidth={2.5} />
            </div>
            <div>
              <p className="text-base font-extrabold leading-none text-white">ФОРМА</p>
              <p className="mt-1 text-xs text-slate-500">Тренер в кармане</p>
            </div>
          </div>

          <nav className="mt-9 flex flex-col gap-1">
            {NAV.map((item) => {
              const active = tab === item.id;
              const Icon = item.icon;
              return (
                <button
                  key={item.id}
                  onClick={() => setTab(item.id)}
                  className={`flex items-center gap-3 rounded-xl px-3.5 py-2.5 text-sm font-semibold transition-all ${
                    active
                      ? 'bg-brand-500/15 text-brand-300'
                      : 'text-slate-400 hover:bg-ink-800 hover:text-slate-200'
                  }`}
                >
                  <Icon className="h-5 w-5" strokeWidth={active ? 2.4 : 2} />
                  {item.label}
                </button>
              );
            })}
          </nav>

          <div className="mt-auto rounded-2xl border border-brand-500/25 bg-brand-500/10 p-4">
            <div className="flex items-center gap-2 text-brand-300">
              <Crown className="h-4 w-4" />
              <span className="text-sm font-bold">Тариф PRO</span>
            </div>
            <p className="mt-1.5 text-xs leading-relaxed text-slate-400">
              Авто-расчёт TDEE, синхронизация весов Zepp и аналитика рекордов активны.
            </p>
          </div>

          {user && (
            <button
              onClick={() => setProfileOpen(true)}
              className="mt-4 flex w-full items-center gap-3 rounded-xl bg-ink-800/60 p-2.5 text-left transition-colors hover:bg-ink-800"
            >
              <Avatar name={displayName} url={avatarUrl} size="sm" />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold text-white">{displayName}</p>
                <p className="text-xs text-slate-500">Атлет</p>
              </div>
              <Settings className="h-4 w-4 shrink-0 text-slate-500" />
            </button>
          )}
        </aside>

        {/* Main */}
        <main className="min-h-screen w-full pb-24 lg:pb-10">
          {/* Mobile header */}
          <header className="sticky top-0 z-20 flex items-center justify-between border-b border-ink-800 bg-ink-950/90 px-5 py-4 backdrop-blur lg:hidden">
            <div className="flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand-500">
                <Activity className="h-4 w-4 text-ink-950" strokeWidth={2.5} />
              </div>
              <span className="text-base font-extrabold text-white">ФОРМА</span>
            </div>
            {user && (
              <button onClick={() => setProfileOpen(true)} className="transition-transform active:scale-95">
                <Avatar name={displayName} url={avatarUrl} size="sm" />
              </button>
            )}
          </header>

          <div className="px-5 py-6 lg:px-10 lg:py-8">
            {tab === 'today' && <Dashboard onStartWorkout={() => setTab('workout')} isDemo={isDemo} />}
            {tab === 'nutrition' && <Nutrition isDemo={isDemo} />}
            {tab === 'workout' && <Workout onExerciseComment={handleExerciseComment} isDemo={isDemo} />}
            {tab === 'metrics' && <Metrics />}
            {tab === 'chat' && <Chat athlete={user?.profile ?? null} coach={coach} exerciseContext={exerciseContext} isDemo={isDemo} />}
            {tab === 'recipes' && <Recipes />}
          </div>
        </main>
      </div>

      {/* Bottom nav (mobile) */}
      <nav className="fixed bottom-0 left-0 right-0 z-30 flex border-t border-ink-800 bg-ink-900/95 backdrop-blur lg:hidden">
        {NAV.map((item) => {
          const active = tab === item.id;
          const Icon = item.icon;
          return (
            <button
              key={item.id}
              onClick={() => setTab(item.id)}
              className={`flex flex-1 flex-col items-center gap-1 py-2.5 text-[10px] font-semibold transition-colors ${
                active ? 'text-brand-400' : 'text-slate-500'
              }`}
            >
              <Icon className="h-5 w-5" strokeWidth={active ? 2.4 : 2} />
              {item.label}
            </button>
          );
        })}
      </nav>

      {user && (
        <ProfileSettingsModal
          open={profileOpen}
          onClose={() => setProfileOpen(false)}
          user={user}
          onSaved={reload}
        />
      )}
    </div>
  );
}

export default App;
