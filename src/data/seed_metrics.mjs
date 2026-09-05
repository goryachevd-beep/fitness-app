import { readFileSync, writeFileSync } from 'node:fs';
import { randomUUID } from 'node:crypto';

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

const csv = readFileSync('src/data/metrics.csv.csv', 'utf-8');
const lines = csv.split('\n').filter(l => l.trim());

// Find the header line (contains "Метрика") and date line (follows it)
let headerIdx = -1;
for (let i = 0; i < lines.length; i++) {
  if (lines[i].includes('Метрика')) { headerIdx = i; break; }
}
const dateLine = lines[headerIdx + 1];
const dateCols = parseCSVLine(dateLine);

// Dates start at col[3] (after empty, empty, empty)
const dates = [];
for (let i = 3; i < dateCols.length; i++) {
  const iso = toISO(dateCols[i]);
  if (iso) dates.push(iso);
  else break;
}
console.log('Dates:', dates.length, dates[0], '...', dates[dates.length - 1]);

// Data rows start after the date line
const metrics = [];
for (let i = headerIdx + 2; i < lines.length; i++) {
  const cols = parseCSVLine(lines[i]);
  const name = cols[2];
  if (!name) continue;
  // Stop when we hit the "Нормы" section
  if (name.includes('Нормы') || name.includes('Рекомпозиция')) break;

  const instruction = cols[1] || null;
  const values = [];
  for (let d = 0; d < dates.length; d++) {
    const raw = cols[3 + d];
    const num = toNum(raw);
    if (num !== null) {
      values.push({ date: dates[d], value: num });
    }
  }

  if (values.length === 0) continue;

  metrics.push({
    id: randomUUID(),
    name,
    instruction,
    unit: 'см',
    is_active: true,
    order_index: metrics.length,
    values,
  });
}

console.log(`Parsed ${metrics.length} metrics`);
for (const m of metrics) {
  console.log(`  ${m.name}: ${m.values.length} entries, ${m.values[0]?.value} -> ${m.values[m.values.length - 1]?.value}`);
}

let sql = `/*\n# Seed custom_metrics and metric_logs from CSV\n\nImports all body measurement metrics (Талия, Грудь, Бедро, etc.)\nwith weekly historical data from March to July 2026.\n*/\n\n`;

sql += `DELETE FROM metric_logs;\nDELETE FROM custom_metrics;\n\n`;

for (const m of metrics) {
  const instr = m.instruction ? `'${m.instruction.replace(/'/g, "''")}'` : 'NULL';
  sql += `INSERT INTO custom_metrics (id, name, instruction, unit, is_active, order_index) VALUES ('${m.id}', '${m.name.replace(/'/g, "''")}', ${instr}, '${m.unit}', ${m.is_active}, ${m.order_index});\n`;
}
sql += '\n';

let logCount = 0;
for (const m of metrics) {
  for (const v of m.values) {
    sql += `INSERT INTO metric_logs (metric_id, date, value) VALUES ('${m.id}', '${v.date}', ${v.value}) ON CONFLICT DO NOTHING;\n`;
    logCount++;
  }
}

writeFileSync('/tmp/seed_metrics.sql', sql);
console.log(`\nGenerated ${logCount} metric_log INSERT statements`);
