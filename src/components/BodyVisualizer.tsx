import { useRef, useState } from 'react';
import { Upload, Camera, GitCompareArrows, User, ImageOff } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import type { ProgressPhoto } from '@/lib/types';
import { Card } from '@/components/ui';

// ── Types ──────────────────────────────────────────────

export interface MeasurementPoint {
  metricId: string;
  name: string;
  /** SVG coordinates on the silhouette for the anchor dot */
  x: number;
  y: number;
  /** Which side the callout badge goes: left or right */
  side: 'left' | 'right';
  /** Current value in cm */
  current: number | null;
  /** Start value in cm */
  start: number | null;
}

interface Props {
  gender: 'male' | 'female';
  measurements: MeasurementPoint[];
  photos: ProgressPhoto[];
  onPhotoUploaded: () => void;
}

// ── Silhouette paths ────────────────────────────────────
// 320×620 viewBox. Hand-tuned anatomical outlines.

const MALE_PATH = `
M 160 18
C 175 18 187 30 187 45
C 187 53 184 60 179 65
L 196 72
C 214 80 224 96 226 116
L 232 168
C 234 178 230 186 222 188
C 214 190 208 184 206 174
L 198 120
L 192 118
L 195 200
L 200 290
L 206 380
C 207 388 204 394 197 395
C 190 396 185 391 184 383
L 178 300
L 168 210
L 160 210
L 152 210
L 142 300
L 136 383
C 135 391 130 396 123 395
C 116 394 113 388 114 380
L 120 290
L 125 200
L 128 120
L 120 174
C 118 184 112 190 104 188
C 96 186 92 178 94 168
L 100 116
C 102 96 112 80 130 72
L 147 65
C 142 60 139 53 139 45
C 139 30 151 18 160 18
Z
`;

const FEMALE_PATH = `
M 160 18
C 175 18 187 30 187 45
C 187 53 184 60 179 65
L 196 72
C 212 78 222 92 226 112
L 234 160
C 236 170 233 178 225 180
C 217 182 210 177 208 167
L 200 116
L 193 114
L 198 195
C 200 210 210 235 218 260
C 226 285 230 310 228 340
L 226 380
C 225 388 220 393 213 392
C 206 391 202 385 202 377
L 204 330
L 196 270
L 188 215
L 160 215
L 132 215
L 124 270
L 116 330
L 118 377
C 118 385 114 391 107 392
C 100 393 95 388 94 380
L 92 340
C 90 310 94 285 102 260
C 110 235 120 210 122 195
L 127 114
L 120 116
L 112 167
C 110 177 103 182 95 180
C 87 178 84 170 86 160
L 94 112
C 98 92 108 78 124 72
L 141 65
C 136 60 133 53 133 45
C 133 30 145 18 160 18
Z
`;

// ── Helper: delta formatting ────────────────────────────

function deltaInfo(start: number | null, current: number | null) {
  if (start == null || current == null) return null;
  const delta = current - start;
  return {
    delta,
    reduced: delta < 0,
    text: `${delta >= 0 ? '+' : ''}${delta.toFixed(1)} см`,
  };
}

// ── Badge layout engine ─────────────────────────────────
// Stagger badges vertically so they never overlap. Each badge is 48px tall;
// we enforce a minimum vertical gap of 8px between same-side badges.

const BADGE_W = 120;
const BADGE_H = 48;
const MIN_GAP = 8;
const LEFT_BADGE_X = 6;   // left edge of left-side badges
const RIGHT_BADGE_X = 320 - BADGE_W - 6; // left edge of right-side badges

interface PlacedBadge {
  m: MeasurementPoint;
  info: ReturnType<typeof deltaInfo>;
  badgeX: number;
  badgeY: number;
  hasData: boolean;
}

function layoutBadges(measurements: MeasurementPoint[]): PlacedBadge[] {
  const left = measurements.filter((m) => m.side === 'left').sort((a, b) => a.y - b.y);
  const right = measurements.filter((m) => m.side === 'right').sort((a, b) => a.y - b.y);

  function place(items: MeasurementPoint[], badgeX: number): PlacedBadge[] {
    const result: PlacedBadge[] = [];
    let nextMinY = -Infinity;
    for (const m of items) {
      const info = deltaInfo(m.start, m.current);
      const hasData = m.current != null;
      let badgeY = m.y - BADGE_H / 2;
      if (badgeY < nextMinY) badgeY = nextMinY;
      result.push({ m, info, badgeX, badgeY, hasData });
      nextMinY = badgeY + BADGE_H + MIN_GAP;
    }
    return result;
  }

  return [...place(left, LEFT_BADGE_X), ...place(right, RIGHT_BADGE_X)];
}

// ── Silhouette SVG ──────────────────────────────────────

function Silhouette({
  gender,
  showContour,
  measurements,
}: {
  gender: 'male' | 'female';
  showContour: boolean;
  measurements: MeasurementPoint[];
}) {
  const path = gender === 'male' ? MALE_PATH : FEMALE_PATH;
  const contourScale = 1.06;
  const badges = layoutBadges(measurements);

  return (
    <svg viewBox="0 0 320 620" className="h-full w-full" style={{ overflow: 'visible' }}>
      <defs>
        <linearGradient id="bodyGrad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#10B981" stopOpacity="0.08" />
          <stop offset="50%" stopColor="#10B981" stopOpacity="0.03" />
          <stop offset="100%" stopColor="#10B981" stopOpacity="0.06" />
        </linearGradient>
        <filter id="glow" x="-20%" y="-20%" width="140%" height="140%">
          <feGaussianBlur stdDeviation="3" result="blur" />
          <feMerge>
            <feMergeNode in="blur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>

      {/* Start contour (dashed, scaled up) */}
      {showContour && (
        <g transform={`translate(160 310) scale(${contourScale}) translate(-160 -310)`}>
          <path
            d={path}
            fill="none"
            stroke="#10B981"
            strokeWidth="1.5"
            strokeDasharray="6 5"
            strokeOpacity="0.45"
          />
        </g>
      )}

      {/* Current silhouette */}
      <path
        d={path}
        fill="url(#bodyGrad)"
        stroke="#10B981"
        strokeWidth="2"
        strokeOpacity="0.7"
        filter="url(#glow)"
      />

      {/* Anchor dots */}
      {measurements.map((m) => {
        const hasData = m.current != null;
        return (
          <circle
            key={m.metricId}
            cx={m.x}
            cy={m.y}
            r="5"
            fill={hasData ? '#10B981' : '#334155'}
            stroke="#070b14"
            strokeWidth="2"
          />
        );
      })}

      {/* Leader lines + badges */}
      {badges.map(({ m, info, badgeX, badgeY, hasData }) => {
        const badgeCenterY = badgeY + BADGE_H / 2;
        const lineStartX = m.side === 'left' ? m.x - 6 : m.x + 6;
        const badgeEdgeX = m.side === 'left' ? badgeX + BADGE_W : badgeX;
        return (
          <g key={m.metricId}>
            <line
              x1={lineStartX}
              y1={m.y}
              x2={badgeEdgeX}
              y2={badgeCenterY}
              stroke={hasData ? '#10B981' : '#334155'}
              strokeWidth="1"
              strokeOpacity="0.5"
              strokeDasharray="3 3"
            />
            <foreignObject
              x={badgeX}
              y={badgeY}
              width={BADGE_W}
              height={BADGE_H}
              style={{ overflow: 'visible' }}
            >
              <div
                style={{
                  background: 'rgba(11, 17, 32, 0.92)',
                  border: `1px solid ${hasData ? 'rgba(16,185,129,0.35)' : 'rgba(51,65,85,0.5)'}`,
                  borderRadius: '10px',
                  padding: '4px 8px',
                  textAlign: 'center',
                  backdropFilter: 'blur(8px)',
                  height: '100%',
                  boxSizing: 'border-box',
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'center',
                }}
              >
                <div style={{ fontSize: '10px', color: '#94a3b8', fontWeight: 600, lineHeight: '14px' }}>
                  {m.name}
                </div>
                {hasData ? (
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}>
                    <span style={{ fontSize: '13px', color: '#e2e8f0', fontWeight: 700 }}>
                      {m.current!.toFixed(1)}
                    </span>
                    {info && (
                      <span
                        style={{
                          fontSize: '10px',
                          fontWeight: 700,
                          color: info.reduced ? '#10B981' : '#f43f5e',
                        }}
                      >
                        {info.text}
                      </span>
                    )}
                  </div>
                ) : (
                  <div style={{ fontSize: '11px', color: '#475569' }}>—</div>
                )}
              </div>
            </foreignObject>
          </g>
        );
      })}
    </svg>
  );
}

// ── Photo Compare Slider ─────────────────────────────────

export function PhotoCompare({ photos, onPhotoUploaded }: { photos: ProgressPhoto[]; onPhotoUploaded: () => void }) {
  const [pos, setPos] = useState(50);
  const [uploading, setUploading] = useState(false);
  const [uploadLabel, setUploadLabel] = useState<'start' | 'current'>('current');
  const fileRef = useRef<HTMLInputElement>(null);

  const startPhoto = photos.find((p) => p.label === 'start');
  const currentPhoto = photos.find((p) => p.label === 'current');

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const ext = file.name.split('.').pop();
      const fileName = `${uploadLabel}-${Date.now()}.${ext}`;
      const { error: upErr } = await supabase.storage
        .from('progress-photos')
        .upload(fileName, file, { contentType: file.type });
      if (upErr) throw upErr;

      const { data: urlData } = supabase.storage.from('progress-photos').getPublicUrl(fileName);
      const photoUrl = urlData.publicUrl;

      // Remove existing photo with same label
      const existing = photos.find((p) => p.label === uploadLabel);
      if (existing) {
        await supabase.from('progress_photos').delete().eq('id', existing.id);
      }

      await supabase.from('progress_photos').insert({
        photo_url: photoUrl,
        label: uploadLabel,
        taken_date: new Date().toISOString().slice(0, 10),
      });

      onPhotoUploaded();
    } catch {
      // silently fail — user can retry
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  }

  return (
    <Card className="overflow-hidden">
      <div className="flex items-center gap-2 border-b border-ink-700/60 p-4">
        <Camera className="h-5 w-5 text-brand-300" />
        <div>
          <h3 className="font-bold text-white">Сравнение фото «До / После»</h3>
          <p className="text-xs text-slate-400">Загрузите фото и тяните ползунок</p>
        </div>
      </div>

      {/* Upload row */}
      <div className="flex flex-wrap items-center gap-3 p-4">
        <div className="flex rounded-lg border border-ink-600 overflow-hidden">
          <button
            onClick={() => setUploadLabel('start')}
            className={`px-3 py-1.5 text-xs font-semibold transition-colors ${
              uploadLabel === 'start' ? 'bg-brand-500 text-ink-950' : 'bg-ink-800 text-slate-400'
            }`}
          >
            До
          </button>
          <button
            onClick={() => setUploadLabel('current')}
            className={`px-3 py-1.5 text-xs font-semibold transition-colors ${
              uploadLabel === 'current' ? 'bg-brand-500 text-ink-950' : 'bg-ink-800 text-slate-400'
            }`}
          >
            После
          </button>
        </div>
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          onChange={handleFile}
          className="hidden"
        />
        <button
          onClick={() => fileRef.current?.click()}
          disabled={uploading}
          className="flex items-center gap-2 rounded-lg border border-ink-600 bg-ink-800 px-4 py-2 text-sm font-semibold text-slate-200 transition-colors hover:border-brand-500/50 hover:text-brand-300 disabled:opacity-50"
        >
          <Upload className="h-4 w-4" />
          {uploading ? 'Загрузка...' : `Загрузить фото «${uploadLabel === 'start' ? 'До' : 'После'}»`}
        </button>
      </div>

      {/* Slider */}
      <div className="relative mx-auto max-w-md select-none px-4 pb-6">
        <div className="relative aspect-[3/4] overflow-hidden rounded-xl bg-ink-900">
          {currentPhoto ? (
            <img src={currentPhoto.photo_url} alt="После" className="absolute inset-0 h-full w-full object-cover" />
          ) : (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 text-slate-600">
              <ImageOff className="h-8 w-8" />
              <span className="text-sm">Нет текущего фото</span>
            </div>
          )}
          {startPhoto && (
            <div className="absolute inset-0 overflow-hidden" style={{ width: `${pos}%` }}>
              <img
                src={startPhoto.photo_url}
                alt="До"
                className="absolute inset-0 h-full max-w-none object-cover"
                style={{ width: `${10000 / Math.max(pos, 1)}%` }}
              />
            </div>
          )}
          {startPhoto && (
            <>
              <div className="absolute left-3 top-3 rounded-full bg-black/60 px-2.5 py-1 text-xs font-semibold text-white">
                {new Date(startPhoto.taken_date).toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' })}
              </div>
              <div className="absolute right-3 top-3 rounded-full bg-brand-500/90 px-2.5 py-1 text-xs font-semibold text-ink-950">
                {currentPhoto
                  ? new Date(currentPhoto.taken_date).toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' })
                  : '—'}
              </div>
              <div className="absolute top-0 h-full w-0.5 bg-white shadow" style={{ left: `${pos}%` }}>
                <span className="absolute top-1/2 flex h-8 w-8 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border-2 border-ink-900 bg-white text-ink-900">
                  ⇆
                </span>
              </div>
            </>
          )}
        </div>
        {startPhoto && currentPhoto && (
          <input
            type="range"
            min="0"
            max="100"
            value={pos}
            onChange={(e) => setPos(Number(e.target.value))}
            className="mt-4 w-full accent-brand-500"
          />
        )}
      </div>
    </Card>
  );
}

// ── Silhouette Card ─────────────────────────────────────

export function SilhouetteCard({ gender, measurements }: { gender: 'male' | 'female'; measurements: MeasurementPoint[] }) {
  const [showContour, setShowContour] = useState(false);

  return (
    <Card className="overflow-visible">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-ink-700/60 p-4">
        <div className="flex items-center gap-2">
          <User className="h-5 w-5 text-brand-300" />
          <div>
            <h3 className="font-bold text-white">Визуализатор прогресса</h3>
            <p className="text-xs text-slate-400">
              {gender === 'male' ? 'Мужская антропометрия' : 'Женская антропометрия'} · кликайте на точки
            </p>
          </div>
        </div>
        <button
          onClick={() => setShowContour((v) => !v)}
          className={`flex items-center gap-2 rounded-lg border px-3.5 py-2 text-sm font-semibold transition-all ${
            showContour
              ? 'border-brand-500 bg-brand-500/15 text-brand-300'
              : 'border-ink-600 bg-ink-800 text-slate-400 hover:border-brand-500/50 hover:text-brand-300'
          }`}
        >
          <GitCompareArrows className="h-4 w-4" />
          Сравнить контуры
        </button>
      </div>

      <div className="flex justify-center p-4 sm:p-6">
        <div className="relative h-[560px] w-full max-w-[420px] sm:h-[620px]">
          <Silhouette gender={gender} showContour={showContour} measurements={measurements} />
        </div>
      </div>

      {/* Legend */}
      <div className="flex flex-wrap items-center gap-4 border-t border-ink-700/60 px-4 py-3">
        <div className="flex items-center gap-2">
          <span className="h-2.5 w-2.5 rounded-full bg-brand-500" />
          <span className="text-xs text-slate-400">Текущий контур</span>
        </div>
        {showContour && (
          <div className="flex items-center gap-2">
            <span className="h-0 w-5 border-t-2 border-dashed border-brand-500/50" />
            <span className="text-xs text-slate-400">Начальный контур</span>
          </div>
        )}
        <div className="flex items-center gap-2">
          <span className="text-xs font-bold text-brand-400">−см</span>
          <span className="text-xs text-slate-400">Уменьшение</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs font-bold text-rose-500">+см</span>
          <span className="text-xs text-slate-400">Увеличение</span>
        </div>
      </div>
    </Card>
  );
}

// ── Main Component (backwards-compatible wrapper) ───────

export default function BodyVisualizer({ gender, measurements, photos, onPhotoUploaded }: Props) {
  return (
    <div className="space-y-6">
      <SilhouetteCard gender={gender} measurements={measurements} />
      <PhotoCompare photos={photos} onPhotoUploaded={onPhotoUploaded} />
    </div>
  );
}
