#!/bin/bash
# Supabase Migration Production Deployment Script
# This script is designed to be run in a production environment
# to deploy the Supabase migration changes safely.

# Color formatting
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[0;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Timestamp for logs
TIMESTAMP=$(date +"%Y-%m-%d %H:%M:%S")
LOG_FILE="supabase_migration_$(date +"%Y%m%d%H%M%S").log"

# Log function
log() {
  echo -e "${TIMESTAMP} - $1" | tee -a "$LOG_FILE"
}

# Header
log "${BLUE}============================================"
log "Supabase Migration Production Deployment"
log "============================================${NC}"

# Verify environment
log "${YELLOW}Verifying environment...${NC}"

# Check if we're running in production
if [ "$NODE_ENV" != "production" ]; then
  log "${YELLOW}WARNING: Not running in production environment${NC}"
  read -p "Continue anyway? (y/n) " -n 1 -r
  echo
  if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    log "${RED}Deployment aborted by user${NC}"
    exit 1
  fi
fi

# Check required environment variables
log "${YELLOW}Checking environment variables...${NC}"
REQUIRED_VARS=("SUPABASE_URL" "SUPABASE_KEY" "SESSION_SECRET")
MISSING_VARS=()

for VAR in "${REQUIRED_VARS[@]}"; do
  if [ -z "${!VAR}" ]; then
    MISSING_VARS+=("$VAR")
  fi
done

if [ ${#MISSING_VARS[@]} -ne 0 ]; then
  log "${RED}Error: Missing required environment variables: ${MISSING_VARS[*]}${NC}"
  exit 1
fi

log "${GREEN}✓ Environment variables verified${NC}"

# Backup current application state (if applicable)
log "${YELLOW}Backing up current application state...${NC}"
BACKUP_DIR="./backups/backup_$(date +"%Y%m%d%H%M%S")"
mkdir -p "$BACKUP_DIR"

# Copy important files to backup directory
cp -R ./server "$BACKUP_DIR/"
cp -R ./shared "$BACKUP_DIR/"
cp .env "$BACKUP_DIR/" 2>/dev/null || log "${YELLOW}Warning: .env file not found${NC}"
cp package.json "$BACKUP_DIR/"

log "${GREEN}✓ Backup created at $BACKUP_DIR${NC}"

# Test Supabase connection before proceeding
log "${YELLOW}Testing Supabase connection from production environment...${NC}"
node test-supabase.js > "$BACKUP_DIR/connection_test.log" 2>&1

if [ $? -ne 0 ]; then
  log "${RED}Error: Failed to connect to Supabase${NC}"
  log "${YELLOW}Running network diagnostics...${NC}"
  node test-supabase-network.js > "$BACKUP_DIR/network_test.log" 2>&1
  
  log "${RED}Deployment aborted due to Supabase connection failure${NC}"
  log "${YELLOW}Please check the logs in $BACKUP_DIR for details${NC}"
  exit 1
fi

log "${GREEN}✓ Supabase connection successful${NC}"

# Start deployment
log "${YELLOW}Starting deployment...${NC}"

# Stop the application (use your actual stop command)
log "${YELLOW}Stopping application...${NC}"
# Replace with your actual stop command, e.g.:
# pm2 stop your-app-name

# Wait a moment for all connections to close
sleep 2

# Deploy new code
log "${YELLOW}Deploying new code...${NC}"
# Replace with your actual deployment steps, e.g.:
# git pull origin main
# npm install --production

# Apply database schema changes
log "${YELLOW}Verifying database schema...${NC}"
node check-supabase-connection.js > "$BACKUP_DIR/schema_check.log" 2>&1

# Restart the application (use your actual start command)
log "${YELLOW}Starting application with Supabase configuration...${NC}"
# Replace with your actual start command, e.g.:
# pm2 start your-app-name

# Wait for application to start
sleep 5

# Test API health
log "${YELLOW}Testing API health...${NC}"
# Replace localhost:5000 with your actual production URL if different
curl -s http://localhost:5000/api/health > "$BACKUP_DIR/health_check.log" 2>&1
curl -s http://localhost:5000/api/health/db >> "$BACKUP_DIR/health_check.log" 2>&1

# Check if health endpoint is working
if grep -q '"status":"ok"' "$BACKUP_DIR/health_check.log"; then
  log "${GREEN}✓ API health checks passed${NC}"
else
  log "${RED}Warning: API health checks may have issues${NC}"
  log "${YELLOW}See $BACKUP_DIR/health_check.log for details${NC}"
  
  # Prompt user to decide whether to continue
  read -p "Continue with the deployment anyway? (y/n) " -n 1 -r
  echo
  if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    log "${YELLOW}Reverting to previous state...${NC}"
    # Add your rollback steps here
    
    log "${RED}Deployment rolled back due to failed health checks${NC}"
    exit 1
  fi
fi

# Successful deployment
log "${GREEN}============================================"
log "Supabase Migration successfully deployed!"
log "============================================${NC}"
log "${YELLOW}Post-deployment steps:${NC}"
log "1. Monitor application logs for any errors"
log "2. Test critical application functionality"
log "3. Verify session management and authentication"
log "${BLUE}============================================${NC}"

# Final note about the log file
log "${GREEN}A log of this deployment has been saved to: $LOG_FILE${NC}"