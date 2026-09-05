import { readFileSync, writeFileSync } from 'node:fs';
import { randomUUID } from 'node:crypto';

// Existing exercise IDs from DB
const existingExercises = {
  'Жим лёжа': 'cfccf56d-a210-4293-9f19-c1d0fd711691',
  'Жим стоя (армейский)': 'e0afe1fc-45a6-4ff2-869d-0160a31cd1e2',
  'Подтягивания': 'a1bc9861-1e5c-49cf-88f9-51cce4ff569d',
  'Приседания со штангой': 'b44090ba-402c-4b14-978b-0eff95d6ddad',
  'Становая тяга': '09570bb4-f4aa-4f61-81f9-3b06845c1465',
  'Тяга штанги в наклоне': 'bdede432-520a-409a-a971-30ace4e2edd6',
};

const templateIds = {
  '1': '70a30790-f697-46a5-affb-f0d00cc12a4b',
  '2': '0d706ed4-902f-4766-b483-87b0ee85d3d4',
  '3': '34314330-074b-4bac-a6e2-5640b5f7327a',
};

function toISO(dateStr) {
  const m = dateStr.trim().match(/(\d{1,2})\.(\d{2})\.(\d{2,4})/);
  if (!m) return null;
  let year = m[3];
  if (year.length === 2) year = '20' + year;
  return `${year}-${m[2]}-${m[1].padStart(2, '0')}`;
}

function toNum(val) {
  if (!val) return null;
  const cleaned = val.replace(/\s/g, '').replace(/\xa0/g, '').replace(',', '.');
  const n = parseFloat(cleaned);
  return Number.isNaN(n) ? null : n;
}

// Parse a cell like "20 х 8/8/8" or "20 х 8/8/9" or "22,5 х 8/8/8"
// Returns array of {weight, reps} for each set
function parseCell(cell) {
  if (!cell || !cell.trim()) return [];
  const results = [];
  // Normalize: replace х with x, Х with x
  let text = cell.trim().replace(/[хХ]/g, 'x').replace(/×/g, 'x');
  // Handle "отказ" as a special rep value - use 0
  text = text.replace(/отказ/gi, '0');
  // Remove notes in parentheses like "(+2,5 кг)" or "(свой вес)"
  // But keep the main weight×reps pattern
  // Split by newline first (multiple weight blocks)
  const blocks = text.split(/\n/).map(b => b.trim()).filter(b => b);
  for (const block of blocks) {
    // Remove parenthetical notes
    let clean = block.replace(/\([^)]*\)/g, '').trim();
    // Match patterns like "20 x 8/8/8" or "20x8/8/8" or "20 x 8/8/9"
    // Also handle "20 x 10/10" (2 sets)
    // Also handle just numbers like "9" (bodyweight pullups - reps only)
    const match = clean.match(/([\d.,]+)\s*x\s*([\d/]+)/i);
    if (match) {
      const weight = toNum(match[1]);
      const repsParts = match[2].split('/').map(r => parseInt(r.trim(), 10)).filter(r => !isNaN(r));
      for (const reps of repsParts) {
        results.push({ weight: weight ?? 0, reps });
      }
    } else {
      // Try to parse as just reps (bodyweight)
      const justReps = clean.match(/^(\d+)$/);
      if (justReps) {
        results.push({ weight: 0, reps: parseInt(justReps[1], 10) });
      }
    }
  }
  return results;
}

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
      result.push(current);
      current = '';
    } else {
      current += ch;
    }
  }
  result.push(current);
  return result;
}

const csv = readFileSync('src/data/trainings_logs.csv', 'utf-8');
const lines = csv.split('\n');

// Parse the CSV structure:
// Row 5 (index 4): "Дата" row for workout 1 with dates in cols 8+
// Row 6-11 (index 5-10): exercises for workout 1
// Row 18 (index 17): "Дата" row for workout 2
// Row 19-26 (index 18-25): exercises for workout 2
// Row 29 (index 28): "Дата" row for workout 3
// Row 30-36 (index 29-35): exercises for workout 3

// Find all date rows and exercise blocks
const dateRowPattern = /^Дата/;
const workoutBlocks = [];
let currentBlock = null;

for (let i = 0; i < lines.length; i++) {
  const cols = parseCSVLine(lines[i]);
  if (dateRowPattern.test(cols[0])) {
    // This is a date row - extract dates
    const dates = [];
    for (let j = 8; j < cols.length; j++) {
      const iso = toISO(cols[j]);
      if (iso) dates.push(iso);
      else if (cols[j].trim() === '') continue;
      else break;
    }
    // Find which workout number this is
    const nextLine = lines[i + 1] || '';
    const workoutMatch = nextLine.match(/(\d)\s+тренировка/);
    const workoutNum = workoutMatch ? workoutMatch[1] : String(workoutBlocks.length + 1);
    currentBlock = { workoutNum, dates, exercises: [], startIndex: i + 1 };
    workoutBlocks.push(currentBlock);
  } else if (currentBlock && cols[1] && cols[1].trim()) {
    // This is an exercise row
    const exerciseName = cols[1].trim();
    // Skip header rows or empty
    if (exerciseName.includes('Упражнение') || exerciseName.includes('в скобках')) continue;
    if (!currentBlock.dates.length) continue;
    
    const exerciseData = {
      name: exerciseName,
      category: cols[2]?.trim() || 'general',
      sessions: [], // per-date sets
    };
    
    for (let d = 0; d < currentBlock.dates.length; d++) {
      const cell = cols[8 + d] || '';
      const sets = parseCell(cell);
      if (sets.length > 0) {
        exerciseData.sessions.push({
          date: currentBlock.dates[d],
          sets,
        });
      }
    }
    
    if (exerciseData.sessions.length > 0) {
      currentBlock.exercises.push(exerciseData);
    }
  }
}

// Collect all unique exercise names
const allExerciseNames = new Set();
for (const block of workoutBlocks) {
  for (const ex of block.exercises) {
    allExerciseNames.add(ex.name);
  }
}

// Generate exercise IDs (use existing where match, create new otherwise)
const exerciseIds = {};
const newExercises = [];
for (const name of allExerciseNames) {
  // Try to match existing
  const existingKey = Object.keys(existingExercises).find(k => k.toLowerCase() === name.toLowerCase());
  if (existingKey) {
    exerciseIds[name] = existingExercises[existingKey];
  } else {
    const id = randomUUID();
    exerciseIds[name] = id;
    newExercises.push({ id, name, category: 'general' });
  }
}

console.log(`Found ${allExerciseNames.size} unique exercises (${newExercises.length} new)`);
console.log(`Found ${workoutBlocks.length} workout blocks`);
for (const block of workoutBlocks) {
  console.log(`  Workout ${block.workoutNum}: ${block.dates.length} dates, ${block.exercises.length} exercises`);
  console.log(`    Dates: ${block.dates.join(', ')}`);
}

// Generate SQL
let sql = `/*\n# Seed workout history from CSV\n\nImports all completed workout sessions (3 workout types × 10 sessions each)\nwith exercises, sets, weights, and reps from May to July 2026.\n*/\n\n`;

// Insert new exercises
for (const ex of newExercises) {
  sql += `INSERT INTO exercises (id, title, category, is_custom) VALUES ('${ex.id}', '${ex.name.replace(/'/g, "''")}', '${ex.category}', true);\n`;
}
sql += '\n';

// Insert workout days and sets
let dayCount = 0;
let setCount = 0;

for (const block of workoutBlocks) {
  const templateId = templateIds[block.workoutNum];
  const workoutTitle = `Тренировка ${block.workoutNum}`;
  
  for (let d = 0; d < block.dates.length; d++) {
    const date = block.dates[d];
    const dayId = randomUUID();
    dayCount++;
    
    sql += `INSERT INTO workout_days (id, week_number, day_name, title, date, template_id) VALUES ('${dayId}', 1, '${workoutTitle.replace(/'/g, "''")}', '${workoutTitle.replace(/'/g, "''")}', '${date}', '${templateId}');\n`;
    
    let orderIndex = 0;
    for (const ex of block.exercises) {
      const session = ex.sessions.find(s => s.date === date);
      if (!session) continue;
      
      const exId = exerciseIds[ex.name];
      for (let s = 0; s < session.sets.length; s++) {
        const set = session.sets[s];
        const setId = randomUUID();
        setCount++;
        sql += `INSERT INTO workout_sets (id, workout_day_id, exercise_id, order_index, set_number, actual_weight, actual_reps, is_locked) VALUES ('${setId}', '${dayId}', '${exId}', ${orderIndex}, ${s + 1}, ${set.weight}, ${set.reps}, true);\n`;
      }
      orderIndex++;
    }
  }
  sql += '\n';
}

writeFileSync('/tmp/seed_trainings.sql', sql);
console.log(`\nGenerated ${dayCount} workout days and ${setCount} sets`);
console.log(`SQL written to /tmp/seed_trainings.sql`);
