# Agent Notes: Panel Widget Configurator

## ⚠️ CRITICAL: Firmware / Add-on Separation

**This repository contains ONLY the Home Assistant add-on (web configurator).**

### What lives HERE (GitHub)
- `app/` — Flask backend (Python)
- `static/` — Frontend JS/CSS/assets
- `templates/` — HTML templates
- `config.yaml` — Add-on manifest

### What does NOT live here
- **NO firmware source code** (C++, YAML, ESPHome configs)
- **NO widget headers** (`.h` files)
- **NO build artifacts** (`.pioenvs/`, `.esphome/`)
- **NO calibration data** (speaker measurements, EQ exports)
- **NO secrets** (WiFi passwords, API keys)

### Where firmware lives
The firmware is in `/home/vibe/esphome/smartpanel/` — a **local-only** git repository with **no remote**. It must never be pushed to GitHub.

### Correct workflow
```bash
# Configurator add-on changes → push to GitHub
git add .
git commit -m "vX.Y.Z: ..."
git push origin main

# Firmware changes → commit locally ONLY (separate repo)
cd /home/vibe/esphome/smartpanel
git add .
git commit -m "..."
# DO NOT push — no remote configured
```

### Version bumping
When changing the add-on, always bump `config.yaml` version and update cache-busters in templates:
- `config.yaml`: `version: "X.Y.Z"`
- `templates/index.html`: `<script src="./static/js/app.js?v=N">`
