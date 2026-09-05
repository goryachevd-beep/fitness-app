import { supabase } from '@/lib/supabase';
import { todayISO } from '@/lib/calc';

const FITNESS_SCOPE = 'https://www.googleapis.com/auth/fitness.activity.read';
const FIT_API = 'https://www.googleapis.com/fitness/v1/users/me/dataset:aggregate';

const SYNC_FLAG = 'googlefit_sync_pending';

const PROVIDER_TOKEN_KEY = 'googlefit_provider_token';

export function setCachedProviderToken(token: string | null) {
  if (token) {
    sessionStorage.setItem(PROVIDER_TOKEN_KEY, token);
  } else {
    sessionStorage.removeItem(PROVIDER_TOKEN_KEY);
  }
}

export function getCachedProviderToken(): string | null {
  return sessionStorage.getItem(PROVIDER_TOKEN_KEY);
}

export function initiateGoogleFitAuth() {
  sessionStorage.setItem(SYNC_FLAG, '1');
  supabase.auth.signInWithOAuth({
    provider: 'google',
    options: {
      scopes: FITNESS_SCOPE,
      redirectTo: window.location.origin,
      queryParams: {
        access_type: 'offline',
        prompt: 'consent',
      },
    },
  });
}

export async function trySyncFromSession(): Promise<number | null> {
  if (!sessionStorage.getItem(SYNC_FLAG)) return null;

  const { data: sessionData } = await supabase.auth.getSession();
  const providerToken = sessionData.session?.provider_token ?? getCachedProviderToken();
  if (!providerToken) return null;

  sessionStorage.removeItem(SYNC_FLAG);
  const result = await fetchStepsForRange(providerToken);
  return result.todaySteps;
}

interface StepSyncResult {
  todaySteps: number;
  perDay: { date: string; steps: number }[];
}

export async function fetchStepsForRange(providerToken: string, days = 14): Promise<StepSyncResult> {
  const now = new Date();
  const start = new Date(now);
  start.setHours(0, 0, 0, 0);
  start.setDate(start.getDate() - (days - 1));

  const startTimeMillis = start.getTime();
  const endTimeMillis = now.getTime();

  const res = await fetch(FIT_API, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${providerToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      aggregateBy: [
        {
          dataTypeName: 'com.google.step_count.delta',
        },
      ],
      bucketByTime: { durationMillis: 86400000 },
      startTimeMillis,
      endTimeMillis,
    }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Google Fit API error (${res.status}): ${text}`);
  }

  const json = await res.json();
  const buckets: Array<{ startTimeMillis: string; dataset: Array<{ point: Array<{ value: Array<{ intVal?: number }> }> }> }> =
    json.bucket ?? [];

  const perDay: { date: string; steps: number }[] = [];
  for (const bucket of buckets) {
    let bucketSteps = 0;
    for (const ds of bucket.dataset ?? []) {
      for (const point of ds.point ?? []) {
        for (const v of point.value ?? []) {
          if (v.intVal) bucketSteps += v.intVal;
        }
      }
    }
    const date = new Date(Number(bucket.startTimeMillis)).toISOString().slice(0, 10);
    perDay.push({ date, steps: bucketSteps });
  }

  for (const day of perDay) {
    const { data: existing } = await supabase
      .from('daily_logs')
      .select('id')
      .eq('date', day.date)
      .maybeSingle();

    if (existing) {
      await supabase.from('daily_logs').update({ steps: day.steps }).eq('id', existing.id);
    } else {
      await supabase.from('daily_logs').insert({ date: day.date, steps: day.steps });
    }
  }

  const today = todayISO();
  const todayEntry = perDay.find((d) => d.date === today);
  const todaySteps = todayEntry?.steps ?? 0;

  return { todaySteps, perDay };
}

export async function fetchStepsAndUpdate(providerToken: string): Promise<number> {
  const result = await fetchStepsForRange(providerToken);
  return result.todaySteps;
}
