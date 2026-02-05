#!/bin/sh
set -e

# Configuration
export FLASK_APP=main.py
export PYTHONPATH=/app

# Create config directory if not exists
mkdir -p /config/panel_widgets

# Log startup
echo "Starting Panel Widget Configurator..."
echo "Config directory: /config/panel_widgets"
echo "API endpoint: http://supervisor/core/api"

# Run with gunicorn for production
exec gunicorn \
    --bind 0.0.0.0:8099 \
    --workers 2 \
    --timeout 30 \
    --access-logfile - \
    --error-logfile - \
    --capture-output \
    --enable-stdio-inheritance \
    "main:app"
