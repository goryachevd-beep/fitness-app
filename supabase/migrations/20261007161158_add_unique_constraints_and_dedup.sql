/*
# Add unique constraints to daily_logs and metric_logs for safe upserts

## What this migration does
1. Removes duplicate rows from `daily_logs` (keeping the most recently created row per date)
   and from `metric_logs` (keeping the most recently created row per metric_id+date).
2. Creates a UNIQUE index on `daily_logs(date)` so weight/nutrition/steps/sleep
   saves can use ON CONFLICT (date) DO UPDATE — no duplicate entries.
3. Creates a UNIQUE index on `metric_logs(metric_id, date)` so body measurement
   saves can use ON CONFLICT (metric_id, date) DO UPDATE.
4. Updates the existing non-unique index `idx_daily_logs_date` — replaced by the
   unique index, so the old one is dropped.

## Why
The app currently does a select-then-insert-or-update pattern in the frontend.
If two saves race, or if the user manually corrects a value for an existing date,
duplicate rows are created.  Charts then show multiple points for the same date.
The unique constraint + upsert pattern prevents this at the database level.

## Data safety
- Duplicate rows are removed by keeping only the newest `created_at` per key.
  The older duplicate rows are deleted; the latest value is preserved.
- No columns are dropped or renamed; no data types change.
*/

-- ── 1. Deduplicate daily_logs: keep latest created_at per date ──
DELETE FROM daily_logs
WHERE id NOT IN (
  SELECT DISTINCT ON (date) id
  FROM daily_logs
  ORDER BY date, created_at DESC
);

-- ── 2. Deduplicate metric_logs: keep latest created_at per (metric_id, date) ──
DELETE FROM metric_logs
WHERE id NOT IN (
  SELECT DISTINCT ON (metric_id, date) id
  FROM metric_logs
  ORDER BY metric_id, date, created_at DESC
);

-- ── 3. Replace non-unique date index with a UNIQUE one on daily_logs ──
DROP INDEX IF EXISTS idx_daily_logs_date;
CREATE UNIQUE INDEX IF NOT EXISTS uq_daily_logs_date
  ON daily_logs (date);

-- ── 4. Add UNIQUE index on metric_logs (metric_id, date) ──
CREATE UNIQUE INDEX IF NOT EXISTS uq_metric_logs_metric_date
  ON metric_logs (metric_id, date);
