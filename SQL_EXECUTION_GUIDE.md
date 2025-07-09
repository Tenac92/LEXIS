# SQL Execution Guide for Supabase

## Problem
The built-in SQL tool is trying to connect to a local PostgreSQL server, but your project uses Supabase. This causes the error: `psql: error: connection to server on socket "/run/postgresql/.s.PGSQL.5432" failed`.

## Solution Options

### Option 1: Use the Command-Line SQL Query Tool (Recommended)

I've created a interactive SQL query tool that works directly with your Supabase database:

```bash
node sql-query-tool.js
```

This tool provides:
- Interactive SQL query execution
- Support for SELECT, COUNT, and system queries
- Table listing with `tables` command
- Query examples with `help` command
- Proper error handling and execution time reporting

**Example Usage:**
```
SQL> SELECT * FROM Projects LIMIT 5
SQL> SELECT count(*) FROM users
SQL> tables
SQL> help
SQL> exit
```

### Option 2: Use the API Endpoint

I've added a REST API endpoint for SQL execution:

**POST** `/api/sql/execute`

**Request Body:**
```json
{
  "query": "SELECT * FROM Projects LIMIT 5"
}
```

**Response:**
```json
{
  "success": true,
  "data": [...],
  "queryType": "select",
  "executionTime": 145,
  "rowCount": 5
}
```

You can test it with curl:
```bash
curl -X POST http://localhost:3000/api/sql/execute \
  -H "Content-Type: application/json" \
  -d '{"query": "SELECT count(*) FROM Projects"}'
```

### Option 3: Use Supabase Dashboard

You can also execute SQL queries directly in the Supabase Dashboard:

1. Go to your Supabase project dashboard
2. Navigate to "SQL Editor" in the left sidebar
3. Write and execute your SQL queries there
4. This gives you full PostgreSQL SQL support

### Option 4: Direct Database Connection

If you need full PostgreSQL access, you can connect directly using the DATABASE_URL:

```bash
# Extract connection details from your DATABASE_URL
# Format: postgresql://postgres:[SERVICE_KEY]@db.[PROJECT_REF].supabase.co:5432/postgres

# Then use psql directly:
psql $DATABASE_URL
```

## Supported Query Types

### SELECT Queries
```sql
SELECT * FROM Projects LIMIT 10;
SELECT id, project_title FROM Projects WHERE mis = '5174085';
SELECT * FROM users ORDER BY name;
```

### COUNT Queries
```sql
SELECT count(*) FROM Projects;
SELECT count(*) FROM users;
SELECT count(*) FROM budget_history;
```

### System Queries
```sql
SELECT current_database(), version();
SELECT table_name FROM information_schema.tables;
```

## Available Tables

Your database contains these main tables:
- `Projects` - Main project data
- `project_index` - Project relationships and indexing
- `project_history` - Project change history
- `budget_na853_split` - Budget allocations
- `budget_history` - Budget change tracking
- `event_types` - Event type reference data
- `expenditure_types` - Expenditure type reference data
- `kallikratis` - Greek geographic administrative divisions
- `Monada` - Organizational units
- `users` - System users
- `beneficiaries` - Payment beneficiaries
- `employees` - Employee data
- `documents` - Generated documents

## Security Notes

- All query tools require authentication
- Only SELECT and COUNT queries are supported for safety
- INSERT, UPDATE, DELETE operations should be done through the application interface
- Schema changes (CREATE, ALTER, DROP) should be done in Supabase Dashboard

## Testing Connection

To verify your connection is working:

```bash
node test-sql-connection.js
```

This will test:
1. Basic connection to Supabase
2. Project count query
3. Sample project data retrieval
4. Available tables listing

## Next Steps

1. **Try the interactive tool:** `node sql-query-tool.js`
2. **Test specific queries** you need to run
3. **Use the API endpoint** for programmatic access
4. **Access Supabase Dashboard** for advanced SQL features

The connection to Supabase is working perfectly - you just need to use the right tools instead of the built-in PostgreSQL client.