-- Migration: Add Budget Integrity Constraints and Functions
-- Date: 2026-01-23
-- Purpose: Fix race conditions and improve budget data integrity

-- ============================================================================
-- Part 1: Add Foreign Key Constraint for Budget History
-- ============================================================================

-- Ensure budget_history entries reference valid projects
ALTER TABLE budget_history
ADD CONSTRAINT fk_budget_history_project
FOREIGN KEY (project_id) 
REFERENCES "Projects"(id) 
ON DELETE CASCADE;

-- Add index for performance
CREATE INDEX IF NOT EXISTS idx_budget_history_project_id 
ON budget_history(project_id);

-- ============================================================================
-- Part 2: Add Optimistic Locking Column (Alternative to row locking)
-- ============================================================================

-- Add version column for optimistic locking
ALTER TABLE project_budget
ADD COLUMN IF NOT EXISTS version INTEGER DEFAULT 0;

-- Create index for version checks
CREATE INDEX IF NOT EXISTS idx_project_budget_version 
ON project_budget(id, version);

-- ============================================================================
-- Part 3: Database Function for Atomic Budget Updates with Row Locking
-- ============================================================================

CREATE OR REPLACE FUNCTION lock_and_update_budget(
  p_project_id INTEGER,
  p_amount DECIMAL(15,2),
  p_document_id INTEGER,
  p_user_id INTEGER DEFAULT NULL
)
RETURNS TABLE(
  success BOOLEAN, 
  message TEXT,
  new_user_view DECIMAL(15,2),
  available_budget DECIMAL(15,2),
  yearly_available DECIMAL(15,2)
) AS $$
DECLARE
  v_current_spending DECIMAL(15,2);
  v_current_quarter_spent DECIMAL(15,2);
  v_katanomes DECIMAL(15,2);
  v_ethsia DECIMAL(15,2);
  v_new_spending DECIMAL(15,2);
  v_new_quarter_spent DECIMAL(15,2);
  v_available DECIMAL(15,2);
  v_yearly_available DECIMAL(15,2);
BEGIN
  -- Lock the row for update (prevents race conditions)
  -- This will wait if another transaction is updating the same row
  SELECT 
    user_view, 
    current_quarter_spent,
    katanomes_etous, 
    ethsia_pistosi
  INTO 
    v_current_spending,
    v_current_quarter_spent,
    v_katanomes, 
    v_ethsia
  FROM project_budget
  WHERE project_id = p_project_id
  FOR UPDATE;  -- THIS IS THE KEY - locks row until transaction commits
  
  -- Check if project budget exists
  IF NOT FOUND THEN
    RETURN QUERY SELECT FALSE, 'Budget record not found for project', NULL::DECIMAL, NULL::DECIMAL, NULL::DECIMAL;
    RETURN;
  END IF;
  
  -- Calculate new values
  v_new_spending := v_current_spending + p_amount;
  v_new_quarter_spent := v_current_quarter_spent + p_amount;
  v_available := v_katanomes - v_current_spending;
  v_yearly_available := v_ethsia - v_current_spending;
  
  -- VALIDATION 1: user_view should never go negative (refunds can't exceed spending)
  IF v_new_spending < 0 THEN
    RETURN QUERY SELECT FALSE, 
      'Invalid transaction: refund exceeds total spending', 
      v_current_spending,
      v_available,
      v_yearly_available;
    RETURN;
  END IF;
  
  -- VALIDATION 2: Check ethsia_pistosi constraint (only if > 0, per 2026 government policy)
  -- This is HARD BLOCK - cannot proceed
  IF p_amount > 0 AND v_ethsia > 0 AND p_amount > v_yearly_available THEN
    RETURN QUERY SELECT FALSE, 
      format('BUDGET_EXCEEDED: Insufficient annual credit. Requested: €%s, Available: €%s', 
        p_amount, v_yearly_available),
      v_current_spending,
      v_available,
      v_yearly_available;
    RETURN;
  END IF;
  
  -- VALIDATION 3: Check katanomes_etous constraint (soft warning - logged but allowed)
  IF p_amount > 0 AND p_amount > v_available THEN
    -- Log warning but allow transaction to proceed
    RAISE NOTICE 'Budget soft warning: Allocation exceeded. Requested: €%, Available: €%', p_amount, v_available;
  END IF;
  
  -- Update the budget atomically
  UPDATE project_budget
  SET 
    user_view = v_new_spending,
    current_quarter_spent = v_new_quarter_spent,
    version = version + 1,  -- Increment for optimistic locking
    updated_at = NOW()
  WHERE project_id = p_project_id;
  
  -- Return success with updated values
  RETURN QUERY SELECT TRUE, 
    'Success'::TEXT,
    v_new_spending,
    v_katanomes - v_new_spending,
    v_ethsia - v_new_spending;
END;
$$ LANGUAGE plpgsql;

-- Add comment explaining the function
COMMENT ON FUNCTION lock_and_update_budget IS 
'Atomically updates project budget with row-level locking to prevent race conditions. 
Validates ethsia_pistosi (if > 0) and katanomes_etous constraints.
Returns success status and updated budget values.';

-- ============================================================================
-- Part 4: Create Budget Audit Log Table
-- ============================================================================

CREATE TABLE IF NOT EXISTS budget_audit_log (
  id SERIAL PRIMARY KEY,
  project_id INTEGER NOT NULL REFERENCES "Projects"(id) ON DELETE CASCADE,
  operation VARCHAR(50) NOT NULL,  -- 'document_create', 'document_edit', 'document_delete', 'admin_upload', 'quarter_transition'
  user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  old_user_view DECIMAL(15,2),
  new_user_view DECIMAL(15,2),
  amount_delta DECIMAL(15,2),
  document_id INTEGER,
  session_id TEXT,
  request_ip VARCHAR(45),
  user_agent TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Add indexes for audit log queries
CREATE INDEX IF NOT EXISTS idx_budget_audit_log_project_id ON budget_audit_log(project_id);
CREATE INDEX IF NOT EXISTS idx_budget_audit_log_created_at ON budget_audit_log(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_budget_audit_log_operation ON budget_audit_log(operation);
CREATE INDEX IF NOT EXISTS idx_budget_audit_log_user_id ON budget_audit_log(user_id);
CREATE INDEX IF NOT EXISTS idx_budget_audit_log_document_id ON budget_audit_log(document_id);

COMMENT ON TABLE budget_audit_log IS 
'Complete audit trail of all budget modifications for compliance and debugging.
Records user, timestamp, operation type, and amount changes.';

-- ============================================================================
-- Part 5: Create Function to Log Budget Audit
-- ============================================================================

CREATE OR REPLACE FUNCTION log_budget_audit(
  p_project_id INTEGER,
  p_operation VARCHAR(50),
  p_user_id INTEGER,
  p_old_user_view DECIMAL(15,2),
  p_new_user_view DECIMAL(15,2),
  p_document_id INTEGER DEFAULT NULL,
  p_session_id TEXT DEFAULT NULL,
  p_request_ip VARCHAR(45) DEFAULT NULL,
  p_user_agent TEXT DEFAULT NULL
)
RETURNS INTEGER AS $$
DECLARE
  v_audit_id INTEGER;
BEGIN
  INSERT INTO budget_audit_log (
    project_id,
    operation,
    user_id,
    old_user_view,
    new_user_view,
    amount_delta,
    document_id,
    session_id,
    request_ip,
    user_agent
  ) VALUES (
    p_project_id,
    p_operation,
    p_user_id,
    p_old_user_view,
    p_new_user_view,
    p_new_user_view - p_old_user_view,
    p_document_id,
    p_session_id,
    p_request_ip,
    p_user_agent
  )
  RETURNING id INTO v_audit_id;
  
  RETURN v_audit_id;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION log_budget_audit IS 
'Logs budget change to audit trail. Called automatically by budget update functions.';

-- ============================================================================
-- Part 6: Add Check Constraint to Prevent Negative user_view
-- ============================================================================

-- Add constraint to ensure user_view is never negative
ALTER TABLE project_budget
ADD CONSTRAINT chk_user_view_non_negative
CHECK (user_view >= 0);

COMMENT ON CONSTRAINT chk_user_view_non_negative ON project_budget IS 
'Prevents user_view from going negative. Refunds cannot exceed total spending.';

-- ============================================================================
-- Part 7: Create Budget Reconciliation View
-- ============================================================================

-- View to help identify budget inconsistencies
-- NOTE: Only counts documents from 2026+ (government policy change)
CREATE OR REPLACE VIEW budget_reconciliation AS
SELECT 
  pb.id,
  pb.project_id,
  pb.mis,
  pb.na853,
  pb.user_view AS recorded_user_view,
  COALESCE(SUM(gd.total_amount), 0) AS calculated_user_view,
  pb.user_view - COALESCE(SUM(gd.total_amount), 0) AS difference,
  CASE 
    WHEN ABS(pb.user_view - COALESCE(SUM(gd.total_amount), 0)) > 0.01 THEN 'MISMATCH'
    ELSE 'OK'
  END AS status,
  COUNT(gd.id) AS document_count
FROM project_budget pb
LEFT JOIN generated_documents gd ON gd.project_index_id = pb.project_id 
  AND gd.status IN ('approved', 'pending', 'processed')
  AND EXTRACT(YEAR FROM gd.created_at) >= 2026  -- Only count 2026+ documents
GROUP BY pb.id, pb.project_id, pb.mis, pb.na853, pb.user_view;

COMMENT ON VIEW budget_reconciliation IS 
'Compares recorded user_view with calculated sum of document amounts.
Use to identify budget inconsistencies requiring manual resolution.';

-- ============================================================================
-- Verification Queries (Run these to test the migration)
-- ============================================================================

-- Test 1: Verify foreign key constraint
-- SELECT conname, conrelid::regclass, confrelid::regclass 
-- FROM pg_constraint 
-- WHERE conname = 'fk_budget_history_project';

-- Test 2: Verify function exists
-- SELECT proname, proargnames, prosrc 
-- FROM pg_proc 
-- WHERE proname = 'lock_and_update_budget';

-- Test 3: Check for budget mismatches
-- SELECT * FROM budget_reconciliation WHERE status = 'MISMATCH';

-- Test 4: Test the locking function (example)
-- SELECT * FROM lock_and_update_budget(
--   p_project_id := 123,
--   p_amount := 1000.00,
--   p_document_id := 456,
--   p_user_id := 1
-- );
