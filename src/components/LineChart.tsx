interface Point {
  label: string;
  value: number;
}

export function LineChart({
  data,
  height = 160,
  color = '#34d399',
  secondary,
  secondaryColor = '#64748b',
  unit = '',
  yMin,
  yMax,
}: {
  data: Point[];
  height?: number;
  color?: string;
  secondary?: number[];
  secondaryColor?: string;
  unit?: string;
  yMin?: number;
  yMax?: number;
}) {
  if (data.length === 0) {
    return <p className="py-10 text-center text-sm text-slate-500">Нет данных</p>;
  }

  const width = 640;
  const pad = 28;
  const cleanValues = (arr: number[]) => arr.filter((v) => v != null && !Number.isNaN(v));
  const values = [...cleanValues(data.map((d) => d.value)), ...cleanValues(secondary ?? [])];
  if (values.length === 0) {
    return <p className="py-10 text-center text-sm text-slate-500">Нет данных</p>;
  }
  const autoMin = Math.min(...values);
  const autoMax = Math.max(...values);
  const min = yMin != null ? yMin : autoMin;
  const max = yMax != null ? yMax : autoMax;
  const range = max - min || 1;

  const x = (i: number) => pad + (i * (width - pad * 2)) / Math.max(data.length - 1, 1);
  const y = (v: number) => pad + (height - pad * 2) * (1 - (v - min) / range);

  const path = (arr: number[]) =>
    arr
      .map((v, i) => {
        if (v == null || Number.isNaN(v)) return null;
        return `${i === 0 ? 'M' : 'L'} ${x(i).toFixed(1)} ${y(v).toFixed(1)}`;
      })
      .filter(Boolean)
      .join(' ');

  const mainPath = path(data.map((d) => d.value));
  const secondaryPath = secondary ? path(secondary) : '';
  const areaPath = mainPath
    ? mainPath + ` L ${x(data.length - 1).toFixed(1)} ${height - pad} L ${x(0).toFixed(1)} ${height - pad} Z`
    : '';

  const step = Math.max(1, Math.ceil(data.length / 6));

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      className="w-full"
      preserveAspectRatio="none"
      style={{ height }}
    >
      <defs>
        <linearGradient id="areaFill" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.28" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>

      {areaPath && <path d={areaPath} fill="url(#areaFill)" />}

      {secondaryPath && (
        <path
          d={secondaryPath}
          fill="none"
          stroke={secondaryColor}
          strokeWidth="2"
          strokeDasharray="5 5"
          strokeLinecap="round"
        />
      )}

      {mainPath && (
        <path
          d={mainPath}
          fill="none"
          stroke={color}
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      )}

      {data.map((d, i) =>
        i % step === 0 || i === data.length - 1 ? (
          <g key={i}>
            <circle cx={x(i)} cy={y(d.value)} r="3" fill={color} />
            <text
              x={x(i)}
              y={height - 8}
              textAnchor="middle"
              className="fill-slate-500"
              style={{ fontSize: 11 }}
            >
              {d.label}
            </text>
          </g>
        ) : null
      )}

      <text x={pad} y={pad - 10} className="fill-slate-400" style={{ fontSize: 11 }}>
        {max.toFixed(1)}
        {unit}
      </text>
    </svg>
  );
}
