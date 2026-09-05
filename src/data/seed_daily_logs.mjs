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
  const m = dateStr.match(/(\d{1,2})\.(\d{2})\.(\d{4})/);
  if (!m) return null;
  return `${m[3]}-${m[2]}-${m[1].padStart(2, '0')}`;
}

function toNum(val) {
  if (!val || val.trim() === '') return null;
  const cleaned = val.replace(/\s/g, '').replace(/\xa0/g, '').replace(',', '.');
  const n = parseFloat(cleaned);
  return Number.isNaN(n) ? null : n;
}

function toInt(val) {
  const n = toNum(val);
  return n !== null ? Math.round(n) : 0;
}

function sleepQuality(val) {
  if (!val) return null;
  if (val.includes('🟢')) return 5;
  if (val.includes('🟡')) return 3;
  if (val.includes('🔴')) return 1;
  return null;
}

const csv = readFileSync('src/data/daily_logs.csv', 'utf-8');
const lines = csv.split('\n').filter(l => l.trim());

// Row 0: header
// Row 1+: data rows starting with "тест-неделя" or date
// Columns: [0]=week label, [1]=date, [2]=weight, [3]=calories, [4]=protein, [5]=fats, [6]=carbs, [7]=fiber, [8]=sleep, [9]=steps, [10]=training, [11]=questionnaire, [12]=questionnaire_answer, [13]=weight_ema, [14]=tdee, [15]=weight_delta, [16]=avg_calories, [17]=avg_weight, [18]=weekly_delta, [19]=target_rate, [20]=plan_calories

const logs = [];
for (let i = 1; i < lines.length; i++) {
  const cols = parseCSVLine(lines[i]);
  const dateStr = cols[1];
  if (!dateStr) continue;
  const iso = toISO(dateStr);
  if (!iso) continue;

  const weight = toNum(cols[2]);
  const calories = toInt(cols[3]);
  const proteins = toInt(cols[4]);
  const fats = toInt(cols[5]);
  const carbs = toInt(cols[6]);
  const sleep = sleepQuality(cols[8]);
  const steps = toInt(cols[9]);
  const weightEma = toNum(cols[13]);
  const weeklyTdee = toNum(cols[14]);
  const weeklyTargetCalories = toNum(cols[20]);

  // Skip rows with no weight and no calories (empty future rows)
  if (weight === null && calories === 0) continue;

  logs.push({
    date: iso,
    weight,
    steps,
    sleep_quality: sleep,
    calories,
    proteins,
    fats,
    carbs,
    weight_ema: weightEma,
    weekly_tdee: weeklyTdee,
    weekly_target_calories: weeklyTargetCalories,
  });
}

console.log(`Parsed ${logs.length} daily log entries`);
console.log(`First: ${logs[0].date} weight=${logs[0].weight}`);
console.log(`Last: ${logs[logs.length - 1].date} weight=${logs[logs.length - 1].weight}`);

// Generate SQL
let sql = `/*\n# Seed daily_logs from CSV\n\nImports historical daily log data (weight, calories, macros, steps, sleep, EMA, TDEE)\nfrom March to August 2026.\n*/\n\n`;

sql += `DELETE FROM daily_logs;\n\n`;

for (const l of logs) {
  const cols = ['date', 'weight', 'steps', 'sleep_quality', 'calories', 'proteins', 'fats', 'carbs', 'weight_ema', 'weekly_tdee', 'weekly_target_calories'];
  const vals = [
    `'${l.date}'`,
    l.weight !== null ? l.weight : 'NULL',
    l.steps,
    l.sleep_quality !== null ? l.sleep_quality : 'NULL',
    l.calories,
    l.proteins,
    l.fats,
    l.carbs,
    l.weight_ema !== null ? l.weight_ema : 'NULL',
    l.weekly_tdee !== null ? l.weekly_tdee : 'NULL',
    l.weekly_target_calories !== null ? l.weekly_target_calories : 'NULL',
  ];
  sql += `INSERT INTO daily_logs (${cols.join(', ')}) VALUES (${vals.join(', ')});\n`;
}

writeFileSync('/tmp/seed_daily_logs.sql', sql);
console.log(`\nSQL written to /tmp/seed_daily_logs.sql`);
