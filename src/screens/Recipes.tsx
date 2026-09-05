import { useEffect, useMemo, useState } from 'react';
import { UtensilsCrossed, Play, X, Flame, Search, Crown, Filter } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import type { Recipe } from '@/lib/types';
import { Card, Loader, Badge } from '@/components/ui';
import { youtubeEmbed } from '@/lib/calc';

type SortKey = 'calories-asc' | 'calories-desc' | 'protein-desc';

export default function Recipes() {
  const [recipes, setRecipes] = useState<Recipe[] | null>(null);
  const [query, setQuery] = useState('');
  const [sort, setSort] = useState<SortKey>('protein-desc');
  const [onlyVideo, setOnlyVideo] = useState(false);
  const [maxCal, setMaxCal] = useState<number | null>(null);
  const [video, setVideo] = useState<string | null>(null);
  const [selected, setSelected] = useState<Recipe | null>(null);

  useEffect(() => {
    supabase
      .from('recipes')
      .select('*')
      .order('created_at')
      .then(({ data }) => setRecipes((data as Recipe[]) ?? []));
  }, []);

  const filtered = useMemo(() => {
    if (!recipes) return [];
    let list = recipes.filter((r) => r.language === 'ru');
    if (query.trim()) {
      const q = query.toLowerCase();
      list = list.filter(
        (r) =>
          r.title.toLowerCase().includes(q) ||
          (r.description ?? '').toLowerCase().includes(q) ||
          (r.ingredients ?? '').toLowerCase().includes(q)
      );
    }
    if (onlyVideo) list = list.filter((r) => !!r.video_url);
    if (maxCal != null) list = list.filter((r) => r.calories <= maxCal);
    list = [...list].sort((a, b) => {
      if (sort === 'calories-asc') return a.calories - b.calories;
      if (sort === 'calories-desc') return b.calories - a.calories;
      return b.proteins - a.proteins;
    });
    return list;
  }, [recipes, query, sort, onlyVideo, maxCal]);

  if (!recipes) return <Loader />;

  return (
    <div className="animate-fade-up space-y-6">
      <div>
        <h1 className="text-2xl font-extrabold text-white">Рецепты и лайфхаки</h1>
        <p className="mt-0.5 text-sm text-slate-400">
          Фильтруйте по КБЖУ, языку и наличию видеоинструкции
        </p>
      </div>

      {/* Filters */}
      <Card className="space-y-4 p-4">
        <div className="flex items-center gap-2">
          <Search className="h-4 w-4 shrink-0 text-slate-500" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Поиск по названию или ингредиентам..."
            className="flex-1 bg-transparent text-sm text-white outline-none placeholder:text-slate-500"
          />
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-1.5">
            <Filter className="h-3.5 w-3.5 text-slate-500" />
            <span className="text-xs font-semibold text-slate-400">Сортировка:</span>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {(
              [
                ['protein-desc', 'Больше белка'],
                ['calories-asc', 'Меньше ккал'],
                ['calories-desc', 'Больше ккал'],
              ] as [SortKey, string][]
            ).map(([key, label]) => (
              <button
                key={key}
                onClick={() => setSort(key)}
                className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors ${
                  sort === key
                    ? 'bg-brand-500 text-ink-950'
                    : 'border border-ink-600 text-slate-400 hover:text-slate-200'
                }`}
              >
                {label}
              </button>
            ))}
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={() => setOnlyVideo((v) => !v)}
              className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors ${
                onlyVideo
                  ? 'bg-brand-500/20 text-brand-300'
                  : 'border border-ink-600 text-slate-400 hover:text-slate-200'
              }`}
            >
              <Play className="h-3 w-3" />
              С видео
            </button>
            <select
              value={maxCal ?? ''}
              onChange={(e) => setMaxCal(e.target.value ? Number(e.target.value) : null)}
              className="rounded-lg border border-ink-600 bg-ink-900 px-3 py-1.5 text-xs font-semibold text-slate-300 outline-none focus:border-brand-500"
            >
              <option value="">Любые ккал</option>
              <option value="500">≤ 500 ккал</option>
              <option value="600">≤ 600 ккал</option>
            </select>
          </div>
        </div>
      </Card>

      {/* Grid */}
      {filtered.length === 0 ? (
        <Card className="p-10 text-center text-slate-500">
          Ничего не найдено. Попробуйте изменить фильтры.
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {filtered.map((r) => (
            <Card key={r.id} className="group overflow-hidden">
              <div className="relative aspect-[16/10] overflow-hidden">
                <img
                  src={r.image_url ?? ''}
                  alt={r.title}
                  className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-ink-950/90 via-transparent to-transparent" />
                {r.is_premium && (
                  <div className="absolute right-3 top-3">
                    <Badge tone="amber">
                      <Crown className="h-3 w-3" /> PRO
                    </Badge>
                  </div>
                )}
                {r.video_url && (
                  <button
                    onClick={() => setVideo(youtubeEmbed(r.video_url))}
                    className="absolute bottom-3 left-3 flex items-center gap-1.5 rounded-full bg-ink-950/80 px-3 py-1.5 text-xs font-semibold text-white backdrop-blur transition-colors hover:bg-brand-500 hover:text-ink-950"
                  >
                    <Play className="h-3 w-3" /> Видео-рецепт
                  </button>
                )}
                <div className="absolute bottom-3 right-3 flex items-center gap-1 rounded-full bg-ink-950/80 px-2.5 py-1 text-xs font-bold text-amber-300 backdrop-blur">
                  <Flame className="h-3 w-3" /> {r.calories} ккал
                </div>
              </div>

              <div className="p-4">
                <h3 className="font-bold text-white">{r.title}</h3>
                <p className="mt-1 line-clamp-2 text-sm text-slate-400">{r.description}</p>

                <div className="mt-3 flex gap-2">
                  <span className="flex-1 rounded-lg bg-brand-500/10 py-1.5 text-center text-xs font-bold text-brand-300">
                    Б {r.proteins} г
                  </span>
                  <span className="flex-1 rounded-lg bg-amber-500/10 py-1.5 text-center text-xs font-bold text-amber-300">
                    Ж {r.fats} г
                  </span>
                  <span className="flex-1 rounded-lg bg-sky-500/10 py-1.5 text-center text-xs font-bold text-sky-300">
                    У {r.carbs} г
                  </span>
                </div>

                <button
                  onClick={() => setSelected(r)}
                  className="mt-3 w-full rounded-lg border border-ink-600 py-2 text-sm font-semibold text-slate-300 transition-colors hover:border-brand-500/50 hover:text-brand-300"
                >
                  Подробнее
                </button>
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* Recipe detail modal */}
      {selected && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 p-0 sm:items-center sm:p-4"
          onClick={() => setSelected(null)}
        >
          <div
            className="max-h-[85vh] w-full max-w-lg overflow-y-auto rounded-t-2xl border border-ink-700 bg-ink-900 sm:rounded-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="relative">
              <img src={selected.image_url ?? ''} alt={selected.title} className="h-48 w-full object-cover" />
              <button
                onClick={() => setSelected(null)}
                className="absolute right-3 top-3 flex h-9 w-9 items-center justify-center rounded-full bg-ink-950/80 text-slate-300 hover:text-white"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="p-5">
              <div className="flex items-center gap-2">
                <h2 className="text-xl font-extrabold text-white">{selected.title}</h2>
                {selected.is_premium && (
                  <Badge tone="amber">
                    <Crown className="h-3 w-3" /> PRO
                  </Badge>
                )}
              </div>
              <p className="mt-2 text-sm text-slate-400">{selected.description}</p>

              <div className="mt-4 grid grid-cols-4 gap-2">
                <div className="rounded-xl bg-ink-800 p-2.5 text-center">
                  <p className="text-lg font-extrabold text-amber-300">{selected.calories}</p>
                  <p className="text-[11px] text-slate-500">ккал</p>
                </div>
                <div className="rounded-xl bg-ink-800 p-2.5 text-center">
                  <p className="text-lg font-extrabold text-brand-300">{selected.proteins}</p>
                  <p className="text-[11px] text-slate-500">Б, г</p>
                </div>
                <div className="rounded-xl bg-ink-800 p-2.5 text-center">
                  <p className="text-lg font-extrabold text-amber-300">{selected.fats}</p>
                  <p className="text-[11px] text-slate-500">Ж, г</p>
                </div>
                <div className="rounded-xl bg-ink-800 p-2.5 text-center">
                  <p className="text-lg font-extrabold text-sky-300">{selected.carbs}</p>
                  <p className="text-[11px] text-slate-500">У, г</p>
                </div>
              </div>

              <div className="mt-5">
                <h3 className="flex items-center gap-2 text-sm font-bold text-white">
                  <UtensilsCrossed className="h-4 w-4 text-brand-300" />
                  Ингредиенты
                </h3>
                <p className="mt-2 whitespace-pre-line text-sm leading-relaxed text-slate-300">
                  {selected.ingredients}
                </p>
              </div>

              {selected.video_url && (
                <button
                  onClick={() => {
                    setVideo(youtubeEmbed(selected.video_url));
                    setSelected(null);
                  }}
                  className="mt-5 flex w-full items-center justify-center gap-2 rounded-xl bg-brand-500 py-3 font-bold text-ink-950 transition-transform hover:scale-[1.02] active:scale-95"
                >
                  <Play className="h-4 w-4 fill-ink-950" /> Смотреть видео-рецепт
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Video modal */}
      {video && (
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center bg-black/85 p-4"
          onClick={() => setVideo(null)}
        >
          <div
            className="relative w-full max-w-3xl overflow-hidden rounded-2xl border border-ink-700 bg-ink-900"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              onClick={() => setVideo(null)}
              className="absolute right-3 top-3 z-10 flex h-9 w-9 items-center justify-center rounded-full bg-ink-950/80 text-slate-300 hover:text-white"
            >
              <X className="h-5 w-5" />
            </button>
            <div className="aspect-video w-full">
              <iframe
                src={video}
                title="Видео-рецепт"
                className="h-full w-full"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
