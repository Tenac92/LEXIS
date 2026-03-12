-- Add payment-level geographic snapshot columns so each beneficiary payment stores
-- the exact regiondet selected in document creation/edit flows.

ALTER TABLE beneficiary_payments
  ADD COLUMN IF NOT EXISTS regiondet jsonb,
  ADD COLUMN IF NOT EXISTS region_code text,
  ADD COLUMN IF NOT EXISTS regional_unit_code text,
  ADD COLUMN IF NOT EXISTS municipality_code text;

-- Backfill from beneficiaries.regiondet for existing rows where payment-level data is missing.
UPDATE beneficiary_payments bp
SET
  regiondet = COALESCE(bp.regiondet, b.regiondet),
  region_code = COALESCE(
    bp.region_code,
    b.regiondet->'regions'->0->>'code',
    b.regiondet->>'region_code'
  ),
  regional_unit_code = COALESCE(
    bp.regional_unit_code,
    b.regiondet->'regional_units'->0->>'code',
    b.regiondet->>'unit_code'
  ),
  municipality_code = COALESCE(
    bp.municipality_code,
    b.regiondet->'municipalities'->0->>'code',
    b.regiondet->>'municipality_code'
  )
FROM beneficiaries b
WHERE b.id = bp.beneficiary_id
  AND (
    bp.regiondet IS NULL
    OR bp.region_code IS NULL
    OR bp.regional_unit_code IS NULL
    OR bp.municipality_code IS NULL
  );

CREATE INDEX IF NOT EXISTS idx_beneficiary_payments_region_code
  ON beneficiary_payments(region_code);

CREATE INDEX IF NOT EXISTS idx_beneficiary_payments_regional_unit_code
  ON beneficiary_payments(regional_unit_code);

CREATE INDEX IF NOT EXISTS idx_beneficiary_payments_municipality_code
  ON beneficiary_payments(municipality_code);
