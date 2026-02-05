#!/bin/sh
# Panel Widget Configurator - Update Script
# Usage: ./update-addon.sh ["commit message"]

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo "${GREEN}=== Panel Widget Configurator Update Script ===${NC}"

# Check if we're in a git repo
if [ ! -d .git ]; then
    echo "${RED}Error: Not a git repository${NC}"
    echo "Please run this from the wallpanel_configurator directory"
    exit 1
fi

# Check git status
echo ""
echo "${YELLOW}Checking for changes...${NC}"
git status --short

# Check if there are any changes to commit
if [ -z "$(git status --short)" ]; then
    echo "${YELLOW}No changes to commit${NC}"
    exit 0
fi

# Get commit message
COMMIT_MSG="$1"
if [ -z "$COMMIT_MSG" ]; then
    echo ""
    echo "${YELLOW}Enter commit message (or press Enter for timestamp):${NC}"
    read -r COMMIT_MSG
    if [ -z "$COMMIT_MSG" ]; then
        COMMIT_MSG="Update $(date +%Y-%m-%d_%H:%M:%S)"
    fi
fi

# Stage all changes
echo ""
echo "${YELLOW}Staging changes...${NC}"
git add -A

# Commit
echo "${YELLOW}Committing with message: $COMMIT_MSG${NC}"
git commit -m "$COMMIT_MSG"

# Push
echo ""
echo "${YELLOW}Pushing to GitHub...${NC}"
git push origin main

echo ""
echo "${GREEN}=== Successfully pushed to GitHub! ===${NC}"
echo ""
echo "Next steps in Home Assistant:"
echo "1. Go to Settings → Add-ons → Panel Widget Configurator"
echo "2. Click ⋮ (menu) → Check for updates"
echo "3. Click Update or Rebuild"
echo "4. Start the add-on"
echo ""
