// Одноповторный максимум по формуле Эпли
export function epleyE1RM(weight: number, reps: number): number {
  if (!weight || !reps) return 0;
  return weight * (1 + reps / 30);
}

// Рабочий вес от процента 1ПМ, округлённый до 2.5 кг
export function weightFromPercent(oneRepMax: number, percent: number): number {
  if (!oneRepMax || !percent) return 0;
  const raw = (oneRepMax * percent) / 100;
  return Math.round(raw / 2.5) * 2.5;
}

export function formatDate(iso: string): string {
  const d = new Date(iso + (iso.length === 10 ? 'T00:00:00' : ''));
  return d.toLocaleDateString('ru-RU', { day: 'numeric', month: 'long' });
}

export function formatShortDate(iso: string): string {
  const d = new Date(iso + (iso.length === 10 ? 'T00:00:00' : ''));
  return d.toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit' });
}

export function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
}

export function todayISO(): string {
  return new Date().toISOString().slice(0, 10);
}

export function calcEma(weight: number, prevEma: number | null, alpha = 0.15): number {
  if (prevEma == null) return weight;
  return Math.round((alpha * weight + (1 - alpha) * prevEma) * 100) / 100;
}

export function youtubeEmbed(url: string | null): string | null {
  if (!url) return null;
  if (url.includes('/embed/')) return url;
  const match = url.match(/(?:v=|youtu\.be\/)([\w-]{11})/);
  return match ? `https://www.youtube.com/embed/${match[1]}` : url;
}
