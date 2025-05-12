
-- First transform the implementing_agency and expenditure_type strings to proper arrays
WITH parsed_data AS (
  SELECT 
    mis,
    na853,
    event_description,
    project_title,
    event_type,
    string_to_array(NULLIF(event_year, ''), ',') as event_year,
    region,
    string_to_array(NULLIF(implementing_agency, ''), ',') as implementing_agency,
    string_to_array(NULLIF(expenditure_type, ''), ',') as expenditure_type,
    kya,
    fek,
    ada,
    procedures,
    string_to_array(NULLIF(ada_import_sana271, ''), ',') as ada_import_sana271,
    string_to_array(NULLIF(ada_import_sana853, ''), ',') as ada_import_sana853,
    string_to_array(NULLIF(budget_decision, ''), ',') as budget_decision,
    string_to_array(NULLIF(funding_decision, ''), ',') as funding_decision,
    string_to_array(NULLIF(allocation_decision, ''), ',') as allocation_decision,
    budget_e069,
    budget_na271,
    budget_na853,
    status
  FROM project_catalog_2
  WHERE mis NOT IN (SELECT mis FROM project_catalog)
  LIMIT 15  -- Process in batches of 15 records
)
INSERT INTO project_catalog (
  mis,
  na853,
  event_description,
  project_title,
  event_type,
  event_year,
  region,
  implementing_agency,
  expenditure_type,
  kya,
  fek,
  ada,
  procedures,
  ada_import_sana271,
  ada_import_sana853,
  budget_decision,
  funding_decision,
  allocation_decision,
  budget_e069,
  budget_na271,
  budget_na853,
  status
)
SELECT 
  mis,
  na853,
  event_description,
  project_title,
  event_type,
  event_year::jsonb,
  region,
  implementing_agency::jsonb,
  expenditure_type::jsonb,
  kya,
  fek,
  ada,
  procedures,
  ada_import_sana271::jsonb,
  ada_import_sana853::jsonb,
  budget_decision::jsonb,
  funding_decision::jsonb,
  allocation_decision::jsonb,
  NULLIF(budget_e069, '')::numeric,
  NULLIF(budget_na271, '')::numeric,
  NULLIF(budget_na853, '')::numeric,
  status
FROM parsed_data;
