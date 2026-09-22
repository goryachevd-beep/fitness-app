-- Backfill name from day_name where name is null (re-run of earlier backfill to catch rows added after first run)
UPDATE workout_days SET name = day_name WHERE name IS NULL AND day_name IS NOT NULL;