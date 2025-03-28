#!/bin/bash
# Migration Script for Supabase
# This script helps migrate the application to Supabase exclusively

# Color formatting
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[0;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}============================================${NC}"
echo -e "${BLUE}Supabase Migration Deployment Script${NC}"
echo -e "${BLUE}============================================${NC}"

# Check required environment variables
echo -e "\n${YELLOW}Checking environment variables...${NC}"

if [ -z "$SUPABASE_URL" ]; then
  echo -e "${RED}Error: SUPABASE_URL is not set${NC}"
  exit 1
fi

if [ -z "$SUPABASE_KEY" ]; then
  echo -e "${RED}Error: SUPABASE_KEY is not set${NC}"
  exit 1
fi

echo -e "${GREEN}✓ Environment variables verified${NC}"

# Test Supabase connection
echo -e "\n${YELLOW}Testing Supabase connection...${NC}"
node test-supabase.js

if [ $? -ne 0 ]; then
  echo -e "${RED}Error: Failed to connect to Supabase, please check credentials and network connectivity${NC}"
  echo -e "${YELLOW}Running network diagnostics...${NC}"
  node test-supabase-network.js
  exit 1
fi

echo -e "${GREEN}✓ Supabase connection successful${NC}"

# Restart the application
echo -e "\n${YELLOW}Restarting application...${NC}"
touch server/index.ts  # Touch a file to trigger rebuild

echo -e "${GREEN}✓ Application restart triggered${NC}"

# Test API health endpoints
echo -e "\n${YELLOW}Testing API health endpoints...${NC}"
sleep 5  # Wait for application to start
node test-api-health.js

echo -e "\n${GREEN}Migration to Supabase complete!${NC}"
echo -e "${BLUE}============================================${NC}"
echo -e "${YELLOW}Next steps:${NC}"
echo -e "1. Verify all functionality in your browser"
echo -e "2. Monitor logs for any database connectivity errors"
echo -e "3. Deploy the application to production"
echo -e "${BLUE}============================================${NC}"