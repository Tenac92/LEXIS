-- Beneficiary Payments Table Schema Migration
-- Run these commands directly in Supabase SQL Editor

-- Step 1: Add new foreign key columns
ALTER TABLE beneficiary_payments ADD COLUMN IF NOT EXISTS unit_id bigint;
ALTER TABLE beneficiary_payments ADD COLUMN IF NOT EXISTS expediture_type_id integer;
ALTER TABLE beneficiary_payments ADD COLUMN IF NOT EXISTS document_id bigint;
ALTER TABLE beneficiary_payments ADD COLUMN IF NOT EXISTS project_id integer;

-- Step 2: Remove old unique constraint
ALTER TABLE beneficiary_payments DROP CONSTRAINT IF EXISTS beneficiary_payments_beneficiary_id_unit_code_na853_code_ex_key;

-- Step 3: Remove old text columns (after data migration if needed)
-- Uncomment these after ensuring you've migrated any important data to the new foreign key columns
-- ALTER TABLE beneficiary_payments DROP COLUMN IF EXISTS unit_code;
-- ALTER TABLE beneficiary_payments DROP COLUMN IF EXISTS na853_code;
-- ALTER TABLE beneficiary_payments DROP COLUMN IF EXISTS expenditure_type;
-- ALTER TABLE beneficiary_payments DROP COLUMN IF EXISTS protocol_number;

-- Step 4: Add foreign key constraints
ALTER TABLE beneficiary_payments ADD CONSTRAINT beneficiary_payments_unit_id_fkey 
  FOREIGN KEY (unit_id) REFERENCES "Monada" (id);

ALTER TABLE beneficiary_payments ADD CONSTRAINT beneficiary_payments_expediture_type_id_fkey 
  FOREIGN KEY (expediture_type_id) REFERENCES expediture_types (id);

ALTER TABLE beneficiary_payments ADD CONSTRAINT beneficiary_payments_document_id_fkey 
  FOREIGN KEY (document_id) REFERENCES generated_documents (id);

ALTER TABLE beneficiary_payments ADD CONSTRAINT beneficiary_payments_project_id_fkey 
  FOREIGN KEY (project_id) REFERENCES "Projects" (id);

-- Step 5: Verify the new structure
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns 
WHERE table_name = 'beneficiary_payments' 
AND table_schema = 'public'
ORDER BY ordinal_position;