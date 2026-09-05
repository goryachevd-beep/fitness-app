import fs from 'fs';

// ── Helpers ──
function parseNum(s) {
  if (!s) return null;
  s = String(s).trim().replace(/\s/g, '').replace(/\u00A0/g, '').replace(',', '.');
  if (s === '' || s === '-' || /отказ|МАКС|макс/i.test(s)) return null;
  const n = parseFloat(s);
  return isNaN(n) ? null : n;
}

function parseInt(s) {
  if (!s) return 0;
  s = String(s).trim().replace(/\s/g, '').replace(/\u00A0/g, '').replace(/\./g, '');
  const n = parseInt0(s);
  return isNaN(n) ? 0 : n;
}

function parseInt0(s) {
  return Number.parseInt(String(s).replace(/[^0-9-]/g, ''), 10);
}

function parseDate(s) {
  if (!s) return null;
  s = String(s).trim();
  const m = s.match(/^(\d{1,2})\.(\d{2})\.(\d{2,4})$/);
  if (!m) return null;
  let [, d, mo, y] = m;
  if (y.length === 2) y = '20' + y;
  return `${y}-${mo.padStart(2, '0')}-${d.padStart(2, '0')}`;
}

function sleepToQuality(s) {
  if (!s) return null;
  s = String(s);
  if (s.includes('🟢')) return 5;
  if (s.includes('🟡')) return 3;
  if (s.includes('🔴')) return 1;
  return null;
}

function esc(s) {
  if (s == null) return 'NULL';
  return "'" + String(s).replace(/'/g, "''") + "'";
}

// ── Parse daily_logs.csv ──
const dailyRaw = fs.readFileSync('src/data/daily_logs.csv', 'utf8');
const dailyLines = dailyRaw.split('\n').map(l => l.trim());

const dailyRows = [];
for (const line of dailyLines) {
  // Skip header lines, empty, or lines that don't start with a date pattern
  if (!line) continue;
  // CSV with commas — but values contain commas inside quotes; use simple split since structure is known
  // The columns: col0=week label, col1=date, col2=weight, col3=calories, col4=protein, col5=fat, col6=carbs, col7=fiber, col8=sleep, col9=steps, ...
  // We need to handle quoted fields
  const parts = [];
  let cur = '';
  let inQ = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') { inQ = !inQ; continue; }
    if (ch === ',' && !inQ) { parts.push(cur); cur = ''; continue; }
    cur += ch;
  }
  parts.push(cur);

  const date = parseDate(parts[1]);
  if (!date) continue;

  const weight = parseNum(parts[2]);
  const calories = parseNum(parts[3]);
  const proteins = parseNum(parts[4]);
  const fats = parseNum(parts[5]);
  const carbs = parseNum(parts[6]);
  const sleepQuality = sleepToQuality(parts[8]);
  const steps = parseInt(parts[9]);
  const ema = parseNum(parts[12]);
  const tdee = parseNum(parts[13]);
  const target = parseNum(parts[20]); // "Планка" column

  dailyRows.push({ date, weight, calories: calories || 0, proteins: proteins || 0, fats: fats || 0, carbs: carbs || 0, sleepQuality, steps, ema, tdee, target });
}

// Compute EMA if missing
let prevEma = null;
for (const r of dailyRows) {
  if (r.ema != null) { prevEma = r.ema; continue; }
  if (r.weight != null && prevEma != null) {
    r.ema = Math.round((r.weight * 0.3 + prevEma * 0.7) * 100) / 100;
    prevEma = r.ema;
  } else if (r.weight != null) {
    r.ema = r.weight;
    prevEma = r.ema;
  } else {
    r.ema = prevEma;
  }
}

// ── Parse metrics.csv ──
const metricsRaw = fs.readFileSync('src/data/metrics.csv.csv', 'utf8');
const metricsLines = metricsRaw.split('\n').map(l => l.trim());

// Row 3 (index 2): dates
// Row 4+: data rows
// Find the date row
let dateRow = null;
let dateRowIndex = -1;
for (let i = 0; i < metricsLines.length; i++) {
  const parts = [];
  let cur = '';
  let inQ = false;
  for (const ch of metricsLines[i]) {
    if (ch === '"') { inQ = !inQ; continue; }
    if (ch === ',' && !inQ) { parts.push(cur); cur = ''; continue; }
    cur += ch;
  }
  parts.push(cur);
  if (parts[3] && parseDate(parts[3])) {
    dateRow = parts;
    dateRowIndex = i;
    break;
  }
}

const metricDates = [];
if (dateRow) {
  for (let c = 3; c < dateRow.length; c++) {
    const d = parseDate(dateRow[c]);
    if (d) metricDates.push(d);
  }
}

// Parse metric rows (after date row, until empty section)
const metricDefs = [];
const metricLogs = [];

for (let i = dateRowIndex + 1; i < metricsLines.length; i++) {
  const line = metricsLines[i];
  if (!line) continue;
  const parts = [];
  let cur = '';
  let inQ = false;
  for (const ch of line) {
    if (ch === '"') { inQ = !inQ; continue; }
    if (ch === ',' && !inQ) { parts.push(cur); cur = ''; continue; }
    cur += ch;
  }
  parts.push(cur);

  const name = parts[2]?.trim();
  if (!name) continue;
  // Stop at non-metric rows
  if (name.includes('Нормы') || name.includes('Похудение') || name.includes('Уровень') || name.includes('Рекомпозиция')) break;

  const instruction = parts[1]?.trim() || null;
  const startVal = parseNum(parts[3]);

  // Create metric def
  const metricId = `metric_${i}`;
  metricDefs.push({ id: metricId, name, instruction, unit: 'см', is_active: true, order_index: metricDefs.length });

  // Start value
  if (startVal != null && metricDates.length > 0) {
    metricLogs.push({ metric_id: metricId, date: metricDates[0], value: startVal });
  }

  // Weekly values (columns 4+)
  for (let c = 4; c < parts.length && (c - 4) < metricDates.length; c++) {
    const v = parseNum(parts[c]);
    if (v != null) {
      metricLogs.push({ metric_id: metricId, date: metricDates[c - 4], value: v });
    }
  }
}

// ── Parse trainings_logs.csv ──
const trainRaw = fs.readFileSync('src/data/trainings_logs.csv', 'utf8');
const trainLines = trainRaw.split('\n').map(l => l.replace(/\r/g, ''));

// Find date rows and exercise rows
// Structure: date rows have "Дата" in col0, dates in cols 9+
// Exercise rows have exercise name in col1, data in cols 9+
const exercises = new Map();
const workoutDays = [];
const workoutSets = [];

// Three training blocks, each with a "Дата" row and exercise rows
let currentWorkoutNum = 0;
let currentDates = [];
let currentDayIds = [];

for (let i = 0; i < trainLines.length; i++) {
  const line = trainLines[i];
  if (!line.trim()) continue;

  const parts = [];
  let cur = '';
  let inQ = false;
  for (const ch of line) {
    if (ch === '"') { inQ = !inQ; continue; }
    if (ch === ',' && !inQ) { parts.push(cur); cur = ''; continue; }
    cur += ch;
  }
  parts.push(cur);

  // Check if this is a date row
  if (parts[0]?.trim() === 'Дата') {
    currentWorkoutNum++;
    currentDates = [];
    currentDayIds = [];

    for (let c = 9; c < parts.length; c++) {
      const d = parseDate(parts[c]);
      if (d) {
        currentDates.push(d);
        const dayId = `wd_${currentWorkoutNum}_${currentDates.length}`;
        const dayName = `Тренировка ${currentWorkoutNum}`;
        const title = `День ${currentWorkoutNum}`;
        workoutDays.push({ id: dayId, week_number: 1, day_name: dayName, title, date: d });
        currentDayIds.push(dayId);
      }
    }
    continue;
  }

  // Check if this is an exercise row
  const exName = parts[1]?.trim();
  if (exName && currentDates.length > 0 && parts[2]) {
    // Create exercise if not exists
    if (!exercises.has(exName)) {
      const exId = `ex_${exercises.size + 1}`;
      exercises.set(exName, { id: exId, title: exName, category: parts[2]?.trim() || 'general', video_url: null, is_custom: true });
    }
    const exId = exercises.get(exName).id;

    // Parse each workout date column
    for (let c = 9; c < parts.length && (c - 9) < currentDates.length; c++) {
      const cell = parts[c]?.trim();
      if (!cell) continue;
      const dayId = currentDayIds[c - 9];
      if (!dayId) continue;

      // Parse "weight x reps/reps/reps" format
      // Examples: "17,5 x 8/8/8", "20 х 8/8/8", "100х8/7/6"
      // Also: "(+8 кг) на 3 Х4" etc — complex, skip those for now
      const setMatch = cell.match(/(\d+[.,]?\d*)\s*[xхХ×]\s*(\d+(?:\/\d+)*)/);
      if (setMatch) {
        const weight = parseFloat(setMatch[1].replace(',', '.'));
        const repsArr = setMatch[2].split('/').map(r => parseInt0(r));
        repsArr.forEach((reps, idx) => {
          if (weight > 0 && reps > 0) {
            workoutSets.push({
              id: `ws_${workoutSets.length + 1}`,
              workout_day_id: dayId,
              exercise_id: exId,
              order_index: exercises.size,
              set_number: idx + 1,
              target_weight: null,
              target_reps: null,
              target_rm_percent: null,
              actual_weight: weight,
              actual_reps: reps,
            });
          }
        });
      }
    }
  }
}

// ── Generate SQL ──
let sql = '-- Auto-generated from CSV import\n';
sql += '-- Clear existing demo data\n';
sql += 'DELETE FROM workout_sets;\n';
sql += 'DELETE FROM workout_days;\n';
sql += 'DELETE FROM personal_records;\n';
sql += 'DELETE FROM metric_logs;\n';
sql += 'DELETE FROM custom_metrics;\n';
sql += 'DELETE FROM daily_logs;\n';
sql += 'DELETE FROM exercises WHERE is_custom = true;\n\n';

// Daily logs
sql += '-- Daily logs\n';
for (const r of dailyRows) {
  sql += `INSERT INTO daily_logs (date, weight, steps, sleep_quality, calories, proteins, fats, carbs, weight_ema, weekly_tdee, weekly_target_calories) VALUES (${esc(r.date)}, ${r.weight ?? 'NULL'}, ${r.steps}, ${r.sleepQuality ?? 'NULL'}, ${r.calories}, ${r.proteins}, ${r.fats}, ${r.carbs}, ${r.ema ?? 'NULL'}, ${r.tdee ?? 'NULL'}, ${r.target ?? 'NULL'});\n`;
}

// Exercises (custom ones from training log)
sql += '\n-- Custom exercises from training log\n';
for (const [, ex] of exercises) {
  sql += `INSERT INTO exercises (id, title, category, video_url, is_custom) VALUES (${esc(ex.id)}, ${esc(ex.title)}, ${esc(ex.category)}, NULL, true) ON CONFLICT (id) DO NOTHING;\n`;
}

// Workout days
sql += '\n-- Workout days\n';
for (const d of workoutDays) {
  sql += `INSERT INTO workout_days (id, week_number, day_name, title, date) VALUES (${esc(d.id)}, ${d.week_number}, ${esc(d.day_name)}, ${esc(d.title)}, ${esc(d.date)}) ON CONFLICT (id) DO NOTHING;\n`;
}

// Workout sets
sql += '\n-- Workout sets\n';
for (const s of workoutSets) {
  sql += `INSERT INTO workout_sets (id, workout_day_id, exercise_id, order_index, set_number, target_weight, target_reps, target_rm_percent, actual_weight, actual_reps) VALUES (${esc(s.id)}, ${esc(s.workout_day_id)}, ${esc(s.exercise_id)}, ${s.order_index}, ${s.set_number}, NULL, NULL, NULL, ${s.actual_weight}, ${s.actual_reps}) ON CONFLICT (id) DO NOTHING;\n`;
}

// Custom metrics
sql += '\n-- Custom metrics\n';
for (const m of metricDefs) {
  sql += `INSERT INTO custom_metrics (id, name, instruction, unit, is_active, order_index) VALUES (${esc(m.id)}, ${esc(m.name)}, ${esc(m.instruction)}, ${esc(m.unit)}, true, ${m.order_index}) ON CONFLICT (id) DO NOTHING;\n`;
}

// Metric logs
sql += '\n-- Metric logs\n';
for (const l of metricLogs) {
  sql += `INSERT INTO metric_logs (metric_id, date, value) VALUES (${esc(l.metric_id)}, ${esc(l.date)}, ${l.value});\n`;
}

fs.writeFileSync('src/data/import.sql', sql);
console.log(`Daily logs: ${dailyRows.length}`);
console.log(`Metrics: ${metricDefs.length} defs, ${metricLogs.length} logs`);
console.log(`Exercises: ${exercises.size}`);
console.log(`Workout days: ${workoutDays.length}`);
console.log(`Workout sets: ${workoutSets.length}`);
console.log(`SQL written to src/data/import.sql`);
