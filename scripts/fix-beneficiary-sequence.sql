-- Fix Beneficiary ID Sequence
-- This script resets the beneficiary sequence to the correct position
-- based on the highest existing ID in the table

-- Reset the sequence to start from the next available ID
SELECT setval(
    pg_get_serial_sequence('public."Beneficiary"', 'id'), 
    COALESCE((SELECT MAX(id) FROM public."Beneficiary"), 0) + 1, 
    false
);

-- Verify the sequence is set correctly
SELECT 
    'Current sequence value: ' || currval(pg_get_serial_sequence('public."Beneficiary"', 'id')) as sequence_status,
    'Max ID in table: ' || COALESCE(MAX(id), 0) as max_id_in_table
FROM public."Beneficiary";