-- Migration 014: Add Employees.monada_id foreign key to Monada.id
-- Purpose:
-- 1) Introduce numeric FK for employee -> unit linkage
-- 2) Backfill existing rows from legacy Employees.monada (unit code)
-- 3) Keep compatibility with existing text field during transition

BEGIN;

ALTER TABLE "Employees"
ADD COLUMN IF NOT EXISTS monada_id BIGINT;

UPDATE "Employees" e
SET monada_id = m.id
FROM "Monada" m
WHERE e.monada_id IS NULL
  AND e.monada IS NOT NULL
  AND btrim(e.monada) <> ''
  AND btrim(e.monada) = btrim(m.unit);

CREATE INDEX IF NOT EXISTS idx_employees_monada_id
ON "Employees" (monada_id);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'employees_monada_id_fk'
      AND conrelid = '"Employees"'::regclass
  ) THEN
    ALTER TABLE "Employees"
    ADD CONSTRAINT employees_monada_id_fk
    FOREIGN KEY (monada_id)
    REFERENCES "Monada"(id)
    ON UPDATE CASCADE
    ON DELETE SET NULL;
  END IF;
END $$;

COMMIT;

-- Verification queries (run manually as needed):
-- SELECT COUNT(*) AS employees_without_monada_id
-- FROM "Employees"
-- WHERE monada IS NOT NULL AND btrim(monada) <> '' AND monada_id IS NULL;
--
-- SELECT e.id, e.monada, e.monada_id
-- FROM "Employees" e
-- ORDER BY e.id
-- LIMIT 20;
