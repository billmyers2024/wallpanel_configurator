#!/bin/bash
# Panel Widget Configurator - Update Script
# Usage: ./update-addon.sh ["commit message"]

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

CONFIG_YAML="panel-widget-config/config.yaml"

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

# Get current version and bump patch version
if [ -f "$CONFIG_YAML" ]; then
    CURRENT_VERSION=$(grep "^version:" "$CONFIG_YAML" | sed 's/version: "\(.*\)"/\1/')
    echo ""
    echo "${YELLOW}Current version: $CURRENT_VERSION${NC}"
    
    # Parse semver (major.minor.patch)
    MAJOR=$(echo "$CURRENT_VERSION" | cut -d. -f1)
    MINOR=$(echo "$CURRENT_VERSION" | cut -d. -f2)
    PATCH=$(echo "$CURRENT_VERSION" | cut -d. -f3)
    
    # Increment patch version
    NEW_PATCH=$((PATCH + 1))
    NEW_VERSION="${MAJOR}.${MINOR}.${NEW_PATCH}"
    
    echo "${GREEN}Bumping to version: $NEW_VERSION${NC}"
    
    # Update config.yaml
    sed -i "s/^version: \"${CURRENT_VERSION}\"/version: \"${NEW_VERSION}\"/" "$CONFIG_YAML"
    echo "${GREEN}✓ Updated $CONFIG_YAML${NC}"
else
    echo "${RED}Warning: $CONFIG_YAML not found${NC}"
    NEW_VERSION="unknown"
fi

# Get commit message
COMMIT_MSG="$1"
if [ -z "$COMMIT_MSG" ]; then
    echo ""
    echo "${YELLOW}Enter commit message (or press Enter for default):${NC}"
    read -r COMMIT_MSG
    if [ -z "$COMMIT_MSG" ]; then
        COMMIT_MSG="Update to version ${NEW_VERSION}"
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
echo "${GREEN}===============================================${NC}"
echo "${GREEN}  Successfully pushed version ${NEW_VERSION} to GitHub!${NC}"
echo "${GREEN}===============================================${NC}"
echo ""
echo "${BLUE}⚠️  IMPORTANT: Reload Add-on Store in Home Assistant${NC}"
echo ""
echo "Home Assistant caches add-on metadata. To see updates:"
echo ""
echo "  ${YELLOW}Option 1 - UI:${NC}"
echo "     Settings → Add-ons → Add-on Store"
echo "     Click ⋮ (three dots) → Reload"
echo ""
echo "  ${YELLOW}Option 2 - Terminal:${NC}"
echo "     ha addons reload"
echo ""
echo "  ${YELLOW}Option 3 - Hard Refresh:${NC}"
echo "     Ctrl+Shift+R on Add-on Store page"
echo ""
echo "Then check WallPanel Configurator for an update badge."
echo ""
