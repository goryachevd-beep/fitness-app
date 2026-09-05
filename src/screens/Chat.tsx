import { useEffect, useRef, useState } from 'react';
import { Send, Reply, X, Video, Dumbbell, Apple, Ruler, MessageCircle, Pin, Target } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import type { ChatThread, Message, Profile } from '@/lib/types';
import { Card, Loader } from '@/components/ui';
import { formatTime } from '@/lib/calc';
import { DEMO_THREADS, DEMO_MESSAGES } from '@/lib/demoData';

const CATEGORY_META: Record<
  string,
  { icon: typeof MessageCircle; label: string; tint: string }
> = {
  general: { icon: MessageCircle, label: 'Общий', tint: 'bg-slate-500/15 text-slate-300' },
  workout: { icon: Dumbbell, label: 'Тренировки', tint: 'bg-brand-500/15 text-brand-300' },
  nutrition: { icon: Apple, label: 'Питание', tint: 'bg-amber-500/15 text-amber-300' },
  metrics: { icon: Ruler, label: 'Замеры', tint: 'bg-sky-500/15 text-sky-300' },
};

function formatDayLabel(dateStr: string): string {
  const d = new Date(dateStr);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);
  const msgDate = new Date(d);
  msgDate.setHours(0, 0, 0, 0);
  if (msgDate.getTime() === today.getTime()) return 'Сегодня';
  if (msgDate.getTime() === yesterday.getTime()) return 'Вчера';
  return d.toLocaleDateString('ru-RU', { day: 'numeric', month: 'long' });
}

export default function Chat({
  athlete,
  coach,
  exerciseContext,
  isDemo,
}: {
  athlete: Profile | null;
  coach: Profile | null;
  exerciseContext: { id: string; title: string } | null;
  isDemo: boolean;
}) {
  const [threads, setThreads] = useState<ChatThread[] | null>(null);
  const [activeThread, setActiveThread] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [draft, setDraft] = useState('');
  const [replyTo, setReplyTo] = useState<Message | null>(null);
  const [sending, setSending] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isDemo) {
      setThreads(DEMO_THREADS);
      if (exerciseContext) {
        const workoutThread = DEMO_THREADS.find((t) => t.category === 'workout');
        if (workoutThread) { setActiveThread(workoutThread.id); return; }
      }
      setActiveThread(DEMO_THREADS[0].id);
      return;
    }
    supabase
      .from('chat_threads')
      .select('*')
      .order('created_at')
      .then(({ data }) => {
        setThreads((data as ChatThread[]) ?? []);
        if (data && data.length) {
          if (exerciseContext) {
            const workoutThread = (data as ChatThread[]).find((t) => t.category === 'workout');
            if (workoutThread) { setActiveThread(workoutThread.id); return; }
          }
          setActiveThread(data[0].id);
        }
      });
  }, [exerciseContext, isDemo]);

  useEffect(() => {
    if (isDemo) {
      setMessages(DEMO_MESSAGES.filter((m) => m.thread_id === activeThread));
      return;
    }
    if (!activeThread) return;
    supabase
      .from('messages')
      .select('*')
      .eq('thread_id', activeThread)
      .order('created_at', { ascending: true })
      .then(({ data }) => setMessages((data as Message[]) ?? []));
  }, [activeThread, isDemo]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages]);

  async function send() {
    if (!draft.trim() || !activeThread || sending) return;
    setSending(true);
    const text = draft.trim();
    setDraft('');
    const replyText = replyTo?.text ?? null;
    setReplyTo(null);

    const tempId = `tmp-${Date.now()}`;
    const now = new Date().toISOString();
    setMessages((prev) => [
      ...prev,
      {
        id: tempId,
        thread_id: activeThread,
        sender_role: 'athlete',
        text,
        reply_to_text: replyText,
        created_at: now,
      },
    ]);

    const { data } = await supabase
      .from('messages')
      .insert({
        thread_id: activeThread,
        sender_role: 'athlete',
        text,
        reply_to_text: replyText,
      })
      .select()
      .maybeSingle();

    if (data) {
      setMessages((prev) =>
        prev.map((m) => (m.id === tempId ? (data as Message) : m))
      );
    }
    setSending(false);
  }

  if (!threads) return <Loader />;

  const active = threads.find((t) => t.id === activeThread);

  return (
    <div className="animate-fade-up">
      <div className="mb-5">
        <h1 className="text-2xl font-extrabold text-white">Чат с тренером</h1>
        <p className="mt-0.5 text-sm text-slate-400">
          {coach ? `Марина Ковалёва · ваш тренер` : 'Контекстные ветви по темам'}
        </p>
      </div>

      <div className="grid gap-4 lg:grid-cols-[260px_1fr]">
        {/* Thread list */}
        <div className="flex gap-2 overflow-x-auto no-scrollbar lg:flex-col lg:gap-1.5 lg:overflow-visible">
          {threads.map((t) => {
            const meta = CATEGORY_META[t.category] ?? CATEGORY_META.general;
            const Icon = meta.icon;
            const isActive = t.id === activeThread;
            return (
              <button
                key={t.id}
                onClick={() => setActiveThread(t.id)}
                className={`flex shrink-0 items-center gap-2.5 rounded-xl border px-3.5 py-3 text-left transition-all lg:shrink ${
                  isActive
                    ? 'border-brand-500/50 bg-brand-500/15'
                    : 'border-ink-700 bg-ink-850 hover:border-ink-600'
                }`}
              >
                <span className={`flex h-8 w-8 items-center justify-center rounded-lg ${meta.tint}`}>
                  <Icon className="h-4 w-4" />
                </span>
                <div className="min-w-0">
                  <p className={`text-sm font-bold ${isActive ? 'text-brand-300' : 'text-white'}`}>
                    {t.title}
                  </p>
                  <p className="hidden text-xs text-slate-500 lg:block">{meta.label}</p>
                </div>
              </button>
            );
          })}
        </div>

        {/* Chat panel */}
        <Card className="flex h-[calc(100vh-220px)] min-h-[420px] flex-col overflow-hidden lg:h-[calc(100vh-180px)]">
          {/* Pinned task banner */}
          <div className="flex items-center gap-3 border-b border-brand-500/30 bg-gradient-to-r from-brand-500/15 to-brand-500/5 px-4 py-3">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-brand-500/20 text-brand-300">
              <Pin className="h-4.5 w-4.5" />
            </div>
            <div className="min-w-0">
              <p className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wide text-brand-300">
                <Target className="h-3 w-3" />
                Актуальная задача от тренера
              </p>
              <p className="mt-0.5 truncate text-sm font-semibold text-white">
                На этой неделе держим 2350 ккал и фокус на технике в приседе
              </p>
            </div>
          </div>

          {/* Exercise context banner (from workout) */}
          {exerciseContext && (
            <div className="flex items-center gap-3 border-b border-amber-500/30 bg-amber-500/10 px-4 py-3">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-amber-500/20 text-amber-300">
                <Dumbbell className="h-4.5 w-4.5" />
              </div>
              <div className="min-w-0">
                <p className="text-xs font-bold uppercase tracking-wide text-amber-300">Контекст из тренировки</p>
                <p className="mt-0.5 truncate text-sm font-semibold text-white">{exerciseContext.title}</p>
              </div>
            </div>
          )}

          {/* Header */}
          <div className="flex items-center gap-3 border-b border-ink-700/60 p-4">
            {coach && (
              <img
                src={coach.avatar_url ?? ''}
                alt={coach.name}
                className="h-10 w-10 rounded-full object-cover"
              />
            )}
            <div>
              <p className="font-bold text-white">{active?.title ?? 'Чат'}</p>
              <p className="flex items-center gap-1.5 text-xs text-brand-400">
                <span className="h-2 w-2 rounded-full bg-brand-400" />
                Марина в сети
              </p>
            </div>
          </div>

          {/* Messages */}
          <div ref={scrollRef} className="flex-1 space-y-3 overflow-y-auto p-4">
            {messages.length === 0 && (
              <p className="py-10 text-center text-sm text-slate-500">
                Сообщений пока нет. Напишите тренеру!
              </p>
            )}
            {messages.map((m, i) => {
              const mine = m.sender_role === 'athlete';
              const prevMsg = messages[i - 1];
              const showDateSep = !prevMsg || new Date(prevMsg.created_at).toDateString() !== new Date(m.created_at).toDateString();
              return (
                <div key={m.id}>
                  {showDateSep && (
                    <div className="my-3 flex items-center gap-3">
                      <div className="h-px flex-1 bg-ink-700/60" />
                      <span className="text-xs font-semibold text-slate-500">{formatDayLabel(m.created_at)}</span>
                      <div className="h-px flex-1 bg-ink-700/60" />
                    </div>
                  )}
                  <div className={`flex ${mine ? 'justify-end' : 'justify-start'}`}>
                    <div className={`max-w-[80%] ${mine ? 'order-2' : ''}`}>
                    <div
                      className={`rounded-2xl px-4 py-2.5 text-sm leading-relaxed ${
                        mine
                          ? 'rounded-br-md bg-brand-500 text-ink-950'
                          : 'rounded-bl-md bg-ink-800 text-slate-200'
                      }`}
                    >
                      {m.reply_to_text && (
                        <div
                          className={`mb-1.5 border-l-2 pl-2 text-xs italic ${
                            mine ? 'border-ink-950/40 text-ink-950/70' : 'border-brand-400/60 text-slate-400'
                          }`}
                        >
                          {m.reply_to_text}
                        </div>
                      )}
                      {m.text}
                    </div>
                    <div
                      className={`mt-1 flex items-center gap-2 px-1 ${
                        mine ? 'justify-end' : 'justify-start'
                      }`}
                    >
                      <span className="text-[11px] text-slate-500">{formatTime(m.created_at)}</span>
                      {!mine && (
                        <button
                          onClick={() => setReplyTo(m)}
                          className="text-[11px] text-slate-500 transition-colors hover:text-brand-400"
                        >
                          Ответить
                        </button>
                      )}
                    </div>
                  </div>
                </div>
                </div>
              );
            })}
          </div>

          {/* Reply banner */}
          {replyTo && (
            <div className="flex items-center gap-2 border-t border-ink-700/60 bg-ink-900/60 px-4 py-2">
              <Reply className="h-4 w-4 shrink-0 text-brand-400" />
              <p className="flex-1 truncate text-xs text-slate-400">
                Ответ на: <span className="text-slate-300">{replyTo.text}</span>
              </p>
              <button onClick={() => setReplyTo(null)} className="text-slate-500 hover:text-slate-300">
                <X className="h-4 w-4" />
              </button>
            </div>
          )}

          {/* Input */}
          <div className="flex items-center gap-2 border-t border-ink-700/60 p-3">
            <button
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-ink-600 bg-ink-800 text-slate-400 transition-colors hover:border-brand-500/50 hover:text-brand-300"
              title="Видео-сообщение"
            >
              <Video className="h-5 w-5" />
            </button>
            <input
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  send();
                }
              }}
              placeholder={isDemo ? 'Недоступно в демо-режиме' : 'Сообщение тренеру...'}
              disabled={isDemo}
              className="flex-1 rounded-xl border border-ink-600 bg-ink-900 px-4 py-2.5 text-sm text-white outline-none focus:border-brand-500 disabled:opacity-50"
            />
            <button
              onClick={send}
              disabled={!draft.trim() || sending || isDemo}
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-brand-500 text-ink-950 transition-transform hover:scale-105 active:scale-95 disabled:opacity-40"
            >
              <Send className="h-5 w-5" />
            </button>
          </div>
        </Card>
      </div>

      {athlete && (
        <p className="mt-3 text-center text-xs text-slate-600">
          Вы вошли как {athlete.name}
        </p>
      )}
    </div>
  );
}
