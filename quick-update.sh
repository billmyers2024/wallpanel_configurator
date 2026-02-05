#!/bin/sh
# Quick update with default message
# Usage: ./quick-update.sh

COMMIT_MSG="Update $(date +%Y-%m-%d_%H:%M:%S)"
./update-addon.sh "$COMMIT_MSG"
