# Script to run SQL migrations using Supabase credentials
# Usage: .\run-migration.ps1 -migrationFile "migrations/009_add_batch_id_to_budget_history.sql"

param(
    [Parameter(Mandatory=$true)]
    [string]$migrationFile
)

# Extract project ref from SUPABASE_URL
$projectRef = "rlzrtiufwxlljrtmpwsr"

# Prompt for database password (service_role key or database password)
Write-Host "Enter your Supabase database password:" -ForegroundColor Yellow
Write-Host "(This is NOT your SUPABASE_KEY - it's the database password from your Supabase project settings)" -ForegroundColor Cyan
$password = Read-Host -AsSecureString
$BSTR = [System.Runtime.InteropServices.Marshal]::SecureStringToBSTR($password)
$plainPassword = [System.Runtime.InteropServices.Marshal]::PtrToStringAuto($BSTR)

# Construct the DATABASE_URL
$DATABASE_URL = "postgresql://postgres:${plainPassword}@db.${projectRef}.supabase.co:5432/postgres"

# Add PostgreSQL to PATH if not already there
if (-not ($env:Path -like "*PostgreSQL*")) {
    $env:Path += ";C:\Program Files\PostgreSQL\17\bin"
}

# Run the migration
Write-Host "Running migration: $migrationFile" -ForegroundColor Green
& psql $DATABASE_URL -f $migrationFile

# Clean up
[System.Runtime.InteropServices.Marshal]::ZeroFreeBSTR($BSTR)
