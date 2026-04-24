#!/bin/bash
set -e

# ============================================
# AI Crisis Communication Agent - Start Script
# ============================================

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
PURPLE='\033[0;35m'
CYAN='\033[0;36m'
NC='\033[0m'

echo -e "${PURPLE}"
echo "╔══════════════════════════════════════════════════╗"
echo "║     AI Crisis Communication Agent                ║"
echo "║     Enterprise SaaS Platform                     ║"
echo "╚══════════════════════════════════════════════════╝"
echo -e "${NC}"

# ---- Clean up ports ----
echo -e "${YELLOW}[1/6] Cleaning up ports 3000 and 3001...${NC}"
lsof -ti:3000 2>/dev/null | xargs kill -9 2>/dev/null || true
lsof -ti:3001 2>/dev/null | xargs kill -9 2>/dev/null || true
sleep 1
echo -e "${GREEN}  ✓ Ports cleared${NC}"

# ---- Check PostgreSQL ----
echo -e "${YELLOW}[2/6] Checking PostgreSQL...${NC}"
if command -v pg_isready &> /dev/null; then
  if pg_isready -q 2>/dev/null; then
    echo -e "${GREEN}  ✓ PostgreSQL is running${NC}"
  else
    echo -e "${CYAN}  Starting PostgreSQL...${NC}"
    if command -v brew &> /dev/null; then
      brew services start postgresql@14 2>/dev/null || brew services start postgresql 2>/dev/null || true
    fi
    sleep 2
    if pg_isready -q 2>/dev/null; then
      echo -e "${GREEN}  ✓ PostgreSQL started${NC}"
    else
      echo -e "${RED}  ✗ PostgreSQL failed to start. Please start it manually.${NC}"
      exit 1
    fi
  fi
else
  echo -e "${YELLOW}  pg_isready not found, assuming PostgreSQL is running${NC}"
fi

# ---- Create database and seed ----
echo -e "${YELLOW}[3/6] Setting up database...${NC}"

# Create database if not exists
psql -U postgres -tc "SELECT 1 FROM pg_database WHERE datname = 'crisis_comm_db'" 2>/dev/null | grep -q 1 || \
  psql -U postgres -c "CREATE DATABASE crisis_comm_db" 2>/dev/null || true

echo -e "${CYAN}  Initializing tables...${NC}"
psql -U postgres -d crisis_comm_db -f "$SCRIPT_DIR/backend/src/db/init.sql" 2>/dev/null || {
  echo -e "${YELLOW}  Tables may already exist, continuing...${NC}"
}

echo -e "${CYAN}  Seeding data...${NC}"
psql -U postgres -d crisis_comm_db -c "TRUNCATE users, crisis_incidents, media_monitoring, stakeholders, response_templates, press_releases, social_media_responses, sentiment_analyses, crisis_simulations, communication_logs, team_members, incident_timelines, risk_assessments, talking_points, post_crisis_analyses CASCADE;" 2>/dev/null || true
psql -U postgres -d crisis_comm_db -f "$SCRIPT_DIR/backend/src/db/seed.sql" 2>/dev/null || {
  echo -e "${YELLOW}  Some seed data may have failed, continuing...${NC}"
}
echo -e "${GREEN}  ✓ Database ready with seed data${NC}"

# ---- Install dependencies ----
echo -e "${YELLOW}[4/6] Installing backend dependencies...${NC}"
cd "$SCRIPT_DIR/backend"
if [ ! -d "node_modules" ]; then
  npm install --silent 2>&1 | tail -1
else
  echo -e "${GREEN}  ✓ Backend dependencies already installed${NC}"
fi

echo -e "${YELLOW}[5/6] Installing frontend dependencies...${NC}"
cd "$SCRIPT_DIR/frontend"
if [ ! -d "node_modules" ]; then
  npm install --silent 2>&1 | tail -1
else
  echo -e "${GREEN}  ✓ Frontend dependencies already installed${NC}"
fi

# ---- Start servers with hot reload ----
echo -e "${YELLOW}[6/6] Starting servers...${NC}"

cd "$SCRIPT_DIR/backend"
echo -e "${CYAN}  Starting backend on port 3001 (with nodemon hot reload)...${NC}"
npx nodemon src/server.js &
BACKEND_PID=$!

cd "$SCRIPT_DIR/frontend"
echo -e "${CYAN}  Starting frontend on port 3000 (with hot reload)...${NC}"
BROWSER=none PORT=3000 npx react-scripts start &
FRONTEND_PID=$!

echo ""
echo -e "${GREEN}╔══════════════════════════════════════════════════╗"
echo -e "║  ${PURPLE}Application is starting...${GREEN}                       ║"
echo -e "║                                                  ║"
echo -e "║  ${CYAN}Frontend:${NC}  http://localhost:3000${GREEN}                ║"
echo -e "║  ${CYAN}Backend:${NC}   http://localhost:3001${GREEN}                ║"
echo -e "║  ${CYAN}API Health:${NC} http://localhost:3001/api/health${GREEN}    ║"
echo -e "║                                                  ║"
echo -e "║  ${YELLOW}Login:${NC} admin@crisiscomm.ai / password123${GREEN}      ║"
echo -e "║                                                  ║"
echo -e "║  ${RED}Press Ctrl+C to stop all servers${GREEN}                ║"
echo -e "╚══════════════════════════════════════════════════╝${NC}"
echo ""

# ---- Cleanup on exit ----
cleanup() {
  echo ""
  echo -e "${YELLOW}Shutting down...${NC}"
  kill $BACKEND_PID 2>/dev/null || true
  kill $FRONTEND_PID 2>/dev/null || true
  lsof -ti:3000 2>/dev/null | xargs kill -9 2>/dev/null || true
  lsof -ti:3001 2>/dev/null | xargs kill -9 2>/dev/null || true
  echo -e "${GREEN}All servers stopped.${NC}"
  exit 0
}

trap cleanup SIGINT SIGTERM

# Wait for both processes
wait
