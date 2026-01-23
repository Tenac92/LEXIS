# Run Database Migrations
# Usage: .\scripts\run-migrations.ps1 [migration_number]

param(
    [Parameter()]
    [string]$Migration = "001"
)

# Load environment variables
Get-Content .env | ForEach-Object {
    if ($_ -match '^([^=]+)=(.*)$') {
        [System.Environment]::SetEnvironmentVariable($matches[1], $matches[2], 'Process')
    }
}

$SUPABASE_URL = $env:SUPABASE_URL
$SUPABASE_KEY = $env:SUPABASE_KEY

if (-not $SUPABASE_URL) {
    Write-Error "SUPABASE_URL not found in .env file"
    exit 1
}

# Parse connection details from Supabase URL
if ($SUPABASE_URL -match 'https://(.+)\.supabase\.co') {
    $PROJECT_REF = $matches[1]
    $DB_HOST = "db.$PROJECT_REF.supabase.co"
} else {
    Write-Error "Invalid SUPABASE_URL format"
    exit 1
}

$DB_USER = "postgres"
$DB_NAME = "postgres"
$DB_PORT = 5432

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Database Migration Runner" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Host: $DB_HOST"
Write-Host "Migration: $Migration"
Write-Host ""

# Check if psql is installed
$psqlPath = Get-Command psql -ErrorAction SilentlyContinue
if (-not $psqlPath) {
    Write-Error "psql not found. Please install PostgreSQL client tools."
    Write-Host ""
    Write-Host "Alternative: Use Supabase SQL Editor" -ForegroundColor Yellow
    Write-Host "1. Go to: https://supabase.com/dashboard/project/$PROJECT_REF/sql" -ForegroundColor Yellow
    Write-Host "2. Copy/paste the migration SQL file content" -ForegroundColor Yellow
    Write-Host "3. Click 'Run'" -ForegroundColor Yellow
    exit 1
}

$migrationFile = "migrations\${Migration}_*.sql"
$files = Get-ChildItem -Path $migrationFile -ErrorAction SilentlyContinue

if ($files.Count -eq 0) {
    Write-Error "Migration file not found: $migrationFile"
    exit 1
}

$file = $files[0]
Write-Host "Running: $($file.Name)" -ForegroundColor Green
Write-Host ""

# Prompt for password
Write-Host "Enter database password (from SUPABASE_KEY in .env):" -ForegroundColor Yellow
$securePassword = Read-Host -AsSecureString
$BSTR = [System.Runtime.InteropServices.Marshal]::SecureStringToBSTR($securePassword)
$password = [System.Runtime.InteropServices.Marshal]::PtrToStringAuto($BSTR)

$env:PGPASSWORD = $password

try {
    # Run migration
    psql -h $DB_HOST -U $DB_USER -d $DB_NAME -p $DB_PORT -f $file.FullName
    
    if ($LASTEXITCODE -eq 0) {
        Write-Host ""
        Write-Host "✓ Migration completed successfully!" -ForegroundColor Green
    } else {
        Write-Error "Migration failed with exit code: $LASTEXITCODE"
        exit $LASTEXITCODE
    }
} finally {
    # Clear password from environment
    $env:PGPASSWORD = $null
}
