-- Supabase initialization script
-- This script creates necessary functions for the application

-- Create a function to execute custom SQL (used by the executeSQL utility)
CREATE OR REPLACE FUNCTION execute_sql(query_text TEXT, query_params JSONB DEFAULT '[]'::JSONB)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  result JSONB;
  query_with_params TEXT;
  param_value TEXT;
  i INTEGER;
BEGIN
  -- Start with the original query
  query_with_params := query_text;
  
  -- Replace parameters if provided
  IF jsonb_array_length(query_params) > 0 THEN
    FOR i IN 0..jsonb_array_length(query_params)-1 LOOP
      param_value := query_params->i;
      query_with_params := REPLACE(query_with_params, '$' || (i+1), param_value);
    END LOOP;
  END IF;
  
  -- Execute the query and capture the result
  EXECUTE 'SELECT jsonb_agg(row_to_json(t)) FROM (' || query_with_params || ') t' INTO result;
  
  -- Return empty array if null
  RETURN COALESCE(result, '[]'::JSONB);
EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object(
    'error', TRUE,
    'message', SQLERRM,
    'detail', SQLSTATE
  );
END;
$$;

-- Create a function to get database health statistics
CREATE OR REPLACE FUNCTION get_database_stats()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  result JSONB;
BEGIN
  SELECT jsonb_build_object(
    'tables', (SELECT count(*) FROM information_schema.tables WHERE table_schema = 'public'),
    'size', pg_size_pretty(pg_database_size(current_database())),
    'version', version(),
    'timestamp', CURRENT_TIMESTAMP
  ) INTO result;
  
  RETURN result;
EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object(
    'error', TRUE,
    'message', SQLERRM
  );
END;
$$;

-- Notify about script completion
DO $$
BEGIN
  RAISE NOTICE 'Supabase initialization completed successfully.';
END;
$$;