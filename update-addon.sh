#!/bin/sh
# Panel Widget Configurator - Update Script
# Usage: ./update-addon.sh ["commit message"]
# This script commits any uncommitted changes AND pushes all unpushed commits

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo "${GREEN}=== Panel Widget Configurator Update Script ===${NC}"

# Check if we're in a git repo
if [ ! -d .git ]; then
    echo "${RED}Error: Not a git repository${NC}"
    echo "Please run this from the wallpanel_configurator directory"
    exit 1
fi

# Check for unpushed commits
echo ""
echo "${BLUE}Checking for unpushed commits...${NC}"
UNPUSHED=$(git log origin/main..HEAD --oneline 2>/dev/null || echo "")

if [ -n "$UNPUSHED" ]; then
    echo "${YELLOW}Unpushed commits found:${NC}"
    echo "$UNPUSHED"
    echo ""
fi

# Check git status for uncommitted changes
echo "${BLUE}Checking for uncommitted changes...${NC}"
git status --short

# Check if there are any uncommitted changes to commit
if [ -n "$(git status --short)" ]; then
    echo ""
    echo "${YELLOW}Uncommitted changes found - will commit first${NC}"
    
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
    
    # Clear the first argument so we don't use it again
    shift
else
    echo "${GREEN}No uncommitted changes${NC}"
fi

# Check if there are now commits to push (either new or pre-existing)
UNPUSHED_AFTER=$(git log origin/main..HEAD --oneline 2>/dev/null || echo "")

if [ -z "$UNPUSHED_AFTER" ]; then
    echo ""
    echo "${GREEN}Nothing to push - all commits are already on origin/main${NC}"
    exit 0
fi

# Push
echo ""
echo "${YELLOW}Pushing to GitHub...${NC}"
echo "${BLUE}Commits to push:${NC}"
echo "$UNPUSHED_AFTER"
echo ""
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
