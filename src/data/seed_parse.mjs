import { readFileSync, writeFileSync } from 'node:fs';

function parseCSVLine(line) {
  const result = [];
  let current = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') { current += '"'; i++; }
      else inQuotes = !inQuotes;
    } else if (ch === ',' && !inQuotes) {
      result.push(current.trim());
      current = '';
    } else {
      current += ch;
    }
  }
  result.push(current.trim());
  return result;
}

function toISO(dateStr) {
  const m = dateStr.match(/(\d{2})\.(\d{2})\.(\d{4})/);
  if (!m) return null;
  return `${m[3]}-${m[2]}-${m[1]}`;
}

function toNum(val) {
  if (!val || val.trim() === '') return null;
  const cleaned = val.replace(/\s/g, '').replace(/\xa0/g, '').replace(',', '.');
  const n = parseFloat(cleaned);
  return Number.isNaN(n) ? null : n;
}

function parseSleep(val) {
  if (!val) return null;
  if (val.includes('🟢')) return 5;
  if (val.includes('🟡')) return 3;
  if (val.includes('🔴')) return 1;
  return null;
}

const csv = readFileSync('src/data/daily_logs.csv', 'utf-8');
const lines = csv.split('\n').filter(l => l.trim());

const records = [];
for (const line of lines) {
  const cols = parseCSVLine(line);
  if (cols.length < 4) continue;
  const dateStr = cols[1];
  if (!dateStr || !dateStr.match(/\d{2}\.\d{2}\.\d{4}/)) continue;
  const date = toISO(dateStr);
  const weight = toNum(cols[2]);
  const calories = toNum(cols[3]);
  const proteins = toNum(cols[4]);
  const fats = toNum(cols[5]);
  const carbs = toNum(cols[6]);
  const sleepQuality = parseSleep(cols[8]);
  const steps = cols[9] ? Math.round(toNum(cols[9]) || 0) : 0;

  if (weight === null && calories === null && steps === 0) continue;

  records.push({
    date,
    weight,
    calories: calories ?? 0,
    proteins: proteins ?? 0,
    fats: fats ?? 0,
    carbs: carbs ?? 0,
    steps,
    sleep_quality: sleepQuality,
  });
}

records.sort((a, b) => a.date.localeCompare(b.date));

// Calculate EMA: EMA_today = 0.15 * Weight_today + 0.85 * EMA_previous
let prevEma = null;
for (const r of records) {
  if (r.weight !== null) {
    if (prevEma === null) {
      r.weight_ema = r.weight;
    } else {
      r.weight_ema = Math.round((0.15 * r.weight + 0.85 * prevEma) * 100) / 100;
    }
    prevEma = r.weight_ema;
  } else {
    r.weight_ema = prevEma;
  }
}

let sql = '/*\n# Seed daily_logs from CSV\n\nImports all daily log entries from the athlete\'s CSV spreadsheet.\nEMA weight trend calculated as: EMA_today = 0.15 * Weight_today + 0.85 * EMA_previous.\nColumns mapped: Date, Weight, Calories, Protein, Fats, Carbs, Sleep quality, Steps.\n*/\n\n';
sql += "DELETE FROM daily_logs WHERE date <= '2026-12-31';\n\n";

for (const r of records) {
  const w = r.weight !== null ? r.weight : 'NULL';
  const ema = r.weight_ema !== null ? r.weight_ema : 'NULL';
  const sq = r.sleep_quality !== null ? r.sleep_quality : 'NULL';
  sql += `INSERT INTO daily_logs (date, weight, steps, sleep_quality, calories, proteins, fats, carbs, weight_ema) VALUES ('${r.date}', ${w}, ${r.steps}, ${sq}, ${r.calories}, ${r.proteins}, ${r.fats}, ${r.carbs}, ${ema}) ON CONFLICT DO NOTHING;\n`;
}

writeFileSync('/tmp/seed_daily_logs.sql', sql);
console.log(`Generated ${records.length} INSERT statements`);
console.log(`Date range: ${records[0].date} to ${records[records.length - 1].date}`);
console.log(`First: ${JSON.stringify(records[0])}`);
console.log(`Last with weight: ${JSON.stringify(records.filter(r => r.weight !== null).slice(-1)[0])}`);
