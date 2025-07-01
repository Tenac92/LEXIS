-- Create Normalized Project History Tables
-- 
-- This script creates proper normalized tables for project decisions and formulations
-- Run this in Supabase SQL Editor

-- Step 1: Create project_decisions table
-- "Αποφάσεις που τεκμηριώνουν το έργο"
CREATE TABLE project_decisions (
  id BIGSERIAL PRIMARY KEY,
  project_id INTEGER NOT NULL REFERENCES "Projects"(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  -- Decision identification
  decision_sequence INTEGER NOT NULL DEFAULT 1, -- Order of decisions for this project
  decision_type TEXT NOT NULL DEFAULT 'Έγκριση', -- Έγκριση, Τροποποίηση, Παράταση
  
  -- Document references
  protocol_number TEXT,
  fek TEXT,
  ada TEXT,
  
  -- Decision details
  implementing_agency TEXT,
  decision_budget DECIMAL(12,2),
  expenses_covered DECIMAL(12,2),
  decision_date DATE,
  
  -- Status and metadata
  is_included BOOLEAN DEFAULT TRUE,
  is_active BOOLEAN DEFAULT TRUE,
  comments TEXT,
  
  -- Additional document references
  budget_decision TEXT,
  funding_decision TEXT,
  allocation_decision TEXT,
  
  -- Audit fields
  created_by INTEGER,
  updated_by INTEGER,
  
  -- Ensure unique sequence per project
  UNIQUE(project_id, decision_sequence)
);

-- Step 2: Create project_formulations table  
-- "Στοιχεία κατάρτισης έργου"
CREATE TABLE project_formulations (
  id BIGSERIAL PRIMARY KEY,
  project_id INTEGER NOT NULL REFERENCES "Projects"(id) ON DELETE CASCADE,
  decision_id BIGINT REFERENCES project_decisions(id) ON DELETE SET NULL, -- Links to specific decision
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  -- Formulation identification
  formulation_sequence INTEGER NOT NULL DEFAULT 1, -- Order of formulations for this project
  
  -- SA type and codes
  sa_type TEXT NOT NULL CHECK (sa_type IN ('ΝΑ853', 'ΝΑ271', 'E069')),
  enumeration_code TEXT,
  
  -- Decision references (can link to external decisions too)
  protocol_number TEXT,
  ada TEXT,
  decision_year INTEGER,
  
  -- Financial data
  project_budget DECIMAL(12,2) NOT NULL DEFAULT 0,
  total_public_expense DECIMAL(12,2),
  eligible_public_expense DECIMAL(12,2),
  
  -- EPA and status
  epa_version TEXT,
  decision_status TEXT DEFAULT 'Ενεργή',
  change_type TEXT DEFAULT 'Έγκριση',
  
  -- Connected decisions (can reference multiple decision IDs)
  connected_decision_ids INTEGER[],
  
  -- Comments and metadata
  comments TEXT,
  is_active BOOLEAN DEFAULT TRUE,
  
  -- Audit fields
  created_by INTEGER,
  updated_by INTEGER,
  
  -- Ensure unique sequence per project
  UNIQUE(project_id, formulation_sequence)
);

-- Step 3: Create indexes for performance
CREATE INDEX idx_project_decisions_project_id ON project_decisions(project_id);
CREATE INDEX idx_project_decisions_created_at ON project_decisions(created_at);
CREATE INDEX idx_project_decisions_decision_type ON project_decisions(decision_type);
CREATE INDEX idx_project_decisions_protocol ON project_decisions(protocol_number);

CREATE INDEX idx_project_formulations_project_id ON project_formulations(project_id);
CREATE INDEX idx_project_formulations_decision_id ON project_formulations(decision_id);
CREATE INDEX idx_project_formulations_sa_type ON project_formulations(sa_type);
CREATE INDEX idx_project_formulations_created_at ON project_formulations(created_at);

-- Step 4: Create update triggers for updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_project_decisions_updated_at 
  BEFORE UPDATE ON project_decisions 
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_project_formulations_updated_at 
  BEFORE UPDATE ON project_formulations 
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Step 5: Grant permissions
GRANT ALL ON project_decisions TO postgres;
GRANT ALL ON project_formulations TO postgres;
GRANT ALL ON SEQUENCE project_decisions_id_seq TO postgres;
GRANT ALL ON SEQUENCE project_formulations_id_seq TO postgres;

-- Step 6: Sample data to demonstrate the structure
-- Insert sample decisions for a project
INSERT INTO project_decisions (
  project_id, decision_sequence, decision_type, protocol_number, fek, ada,
  implementing_agency, decision_budget, is_included, comments
) VALUES 
  (7, 1, 'Έγκριση', 'ΔΑΕΦΚ-ΚΕ/52548/Α325', '962/Β/2022', 'ΑΔΑ7001', 
   'ΔΑΕΦΚ-ΚΕ', 3154419.11, TRUE, 'Initial approval decision'),
  (7, 2, 'Τροποποίηση', 'ΔΑΕΦΚ-ΚΕ/52549/Α325', '963/Β/2022', 'ΑΔΑ7002', 
   'ΔΑΕΦΚ-ΚΕ', 3377914.58, TRUE, 'Budget modification decision');

-- Insert sample formulations linked to decisions
INSERT INTO project_formulations (
  project_id, decision_id, formulation_sequence, sa_type, enumeration_code,
  protocol_number, decision_year, project_budget, total_public_expense, 
  eligible_public_expense, epa_version, decision_status, change_type, comments
) VALUES 
  (7, 1, 1, 'ΝΑ853', '2024ΝΑ85300052', 'ΔΑΕΦΚ-ΚΕ/52548/Α325', 2024, 
   3154419.11, 3154419.11, 3154419.11, '1.0', 'Ενεργή', 'Έγκριση', 
   'ΝΑ853 formulation linked to approval decision'),
  (7, 2, 2, 'ΝΑ271', '2022ΝΑ27100027', 'ΔΑΕΦΚ-ΚΕ/52549/Α325', 2024,
   3377914.58, 3377914.58, 3377914.58, '1.1', 'Ενεργή', 'Τροποποίηση',
   'ΝΑ271 formulation linked to modification decision');

-- Step 7: Verify the structure with sample queries
-- Show decisions for a project
SELECT 
  d.id as decision_id,
  d.decision_sequence,
  d.decision_type,
  d.protocol_number,
  d.fek,
  d.decision_budget,
  d.comments
FROM project_decisions d 
WHERE d.project_id = 7 
ORDER BY d.decision_sequence;

-- Show formulations with their linked decisions
SELECT 
  f.id as formulation_id,
  f.formulation_sequence,
  f.sa_type,
  f.enumeration_code,
  f.project_budget,
  f.change_type,
  d.decision_type as linked_decision_type,
  d.protocol_number as linked_decision_protocol
FROM project_formulations f
LEFT JOIN project_decisions d ON f.decision_id = d.id
WHERE f.project_id = 7
ORDER BY f.formulation_sequence;

-- Show complete project structure
SELECT 
  p.mis,
  p.project_title,
  COUNT(DISTINCT d.id) as total_decisions,
  COUNT(DISTINCT f.id) as total_formulations,
  SUM(f.project_budget) as total_budget
FROM "Projects" p
LEFT JOIN project_decisions d ON p.id = d.project_id
LEFT JOIN project_formulations f ON p.id = f.project_id
WHERE p.id = 7
GROUP BY p.id, p.mis, p.project_title;