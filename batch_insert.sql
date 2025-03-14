-- First transform the implementing_agency and expenditure_type strings to proper arrays
WITH parsed_data AS (
  SELECT 
    mis,
    e069,
    na271,
    na853,
    event_description,
    project_title,
    event_type,
    event_year,
    -- Parse region data into JSONB object
    CASE 
      WHEN "Region" IS NULL AND implementing_agency = 'ΕΠΙΚΡΑΤΕΙΑ' THEN 
        jsonb_build_object(
          'region', 'ΕΠΙΚΡΑΤΕΙΑ',
          'regional_unit', NULL,
          'municipality', NULL
        )
      ELSE
        jsonb_build_object(
          'region', "Region",
          'regional_unit', string_to_array(NULLIF(TRIM(implementing_agency, ' '), ''), E'\n '),
          'municipality', NULL
        )
    END as region,
    -- Convert implementing agency string to JSONB array
    CASE 
      WHEN kya LIKE '{"%' THEN 
        kya::jsonb
      ELSE
        jsonb_build_array(kya)
    END as implementing_agency,
    -- Convert expenditure type string to JSONB array
    CASE 
      WHEN expenditure_type LIKE '{"%' THEN 
        expenditure_type::jsonb
      ELSE
        jsonb_build_array(expenditure_type)
    END as expenditure_type,
    fek,
    ada,
    procedures,
    -- Convert ADA import strings to JSONB arrays
    CASE 
      WHEN ada_import_sana271 LIKE '{"%' THEN 
        ada_import_sana271::jsonb
      ELSE
        jsonb_build_array(ada_import_sana271)
    END as ada_import_sana271,
    CASE 
      WHEN ada_import_sana853 LIKE '{"%' THEN 
        ada_import_sana853::jsonb
      ELSE
        jsonb_build_array(ada_import_sana853)
    END as ada_import_sana853,
    -- Convert decision strings to JSONB arrays
    CASE 
      WHEN budget_decision LIKE '{"%' THEN 
        budget_decision::jsonb
      ELSE
        jsonb_build_array(budget_decision)
    END as budget_decision,
    CASE 
      WHEN funding_decision LIKE '{"%' THEN 
        funding_decision::jsonb
      ELSE
        jsonb_build_array(funding_decision)
    END as funding_decision,
    CASE 
      WHEN allocation_decision LIKE '{"%' THEN 
        allocation_decision::jsonb
      ELSE
        jsonb_build_array(allocation_decision)
    END as allocation_decision,
    budget_e069,
    budget_na271,
    budget_na853,
    status
  FROM project_catalog_2
  WHERE mis NOT IN (SELECT mis FROM project_catalog)
)
INSERT INTO project_catalog
SELECT * FROM parsed_data;
