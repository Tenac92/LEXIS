-- Add EPS column to beneficiary_payments and backfill from freetext
-- EPS is always a 7-digit number
ALTER TABLE beneficiary_payments
  ADD COLUMN IF NOT EXISTS eps VARCHAR(7);

-- Add check constraint to ensure EPS is exactly 7 digits
ALTER TABLE beneficiary_payments
  ADD CONSTRAINT eps_format_check 
  CHECK (eps IS NULL OR (eps ~ '^\d{7}$'));

-- Backfill from freetext, but only copy valid 7-digit numeric values
UPDATE beneficiary_payments
SET eps = freetext
WHERE eps IS NULL
  AND freetext IS NOT NULL
  AND freetext ~ '^\d{7}$';

-- OPTIONAL: Clear freetext only where it was successfully migrated to eps
-- This preserves any actual notes that don't match EPS format
-- Uncomment the following line after verifying migration in production:
-- UPDATE beneficiary_payments SET freetext = NULL WHERE eps IS NOT NULL AND freetext = eps;

-- Create index for faster EPS lookups
CREATE INDEX IF NOT EXISTS idx_beneficiary_payments_eps 
  ON beneficiary_payments(eps) 
  WHERE eps IS NOT NULL;
