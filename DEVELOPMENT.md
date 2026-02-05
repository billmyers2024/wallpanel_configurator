# Development & Update Workflow

## Making Changes

### 1. Edit Files

Edit files in the `panel-widget-config/` directory:
- `app/main.py` - Backend Python code
- `templates/index.html` - HTML templates
- `static/css/style.css` - Styles
- `static/js/app.js` - Frontend JavaScript
- `config.yaml` - Add-on configuration

### 2. Test Locally (Optional)

Before committing, you can test locally:

```bash
cd panel-widget-config
pip install -r requirements.txt
python app/main.py
```

Access at http://localhost:8099

### 3. Commit & Push

#### Option A: Interactive Update (with custom message)
```bash
./update-addon.sh "Fixed light widget layout"
```

#### Option B: Quick Update (auto timestamp)
```bash
./quick-update.sh
```

#### Option C: Manual Git Commands
```bash
git add .
git commit -m "Your commit message"
git push origin main
```

### 4. Update in Home Assistant

After pushing to GitHub:

1. Go to **Settings → Add-ons → Panel Widget Configurator**
2. Click **⋮ (menu) → Check for updates**
3. Click **Update** or **Rebuild**
4. **Start** the add-on

## File Structure

```
wallpanel_configurator/
├── repository.yaml          # Repository info for HA
├── README.md                # Main documentation
├── DEVELOPMENT.md           # This file
├── update-addon.sh          # Update script (interactive)
├── quick-update.sh          # Update script (auto)
└── panel-widget-config/     # The actual add-on
    ├── config.yaml          # Add-on config
    ├── Dockerfile           # Container build
    ├── run.sh               # Startup script
    ├── requirements.txt     # Python deps
    ├── build.yaml           # Build config
    ├── app/
    │   └── main.py          # Flask backend
    ├── templates/
    │   └── index.html       # Web UI
    ├── static/
    │   ├── css/
    │   │   └── style.css    # Styles
    │   └── js/
    │       └── app.js       # Frontend
    └── translations/
        └── en.yaml          # Translations
```

## Version Management

When making significant changes, update the version in `panel-widget-config/config.yaml`:

```yaml
version: "1.1.1"  # Bump this
```

Version format: `MAJOR.MINOR.PATCH`
- MAJOR: Breaking changes
- MINOR: New features
- PATCH: Bug fixes

## Troubleshooting

### Add-on won't start

Check logs: **Settings → Add-ons → Panel Widget Configurator → Log**

Common issues:
- Syntax errors in Python/JS/CSS
- Missing dependencies in requirements.txt
- File permissions (run.sh must be executable)

### Changes not appearing

1. Clear browser cache (Ctrl+F5 or Cmd+Shift+R)
2. Check that you pushed to GitHub: `git log`
3. Rebuild the add-on in HA (not just restart)
4. Check the add-on logs for errors

### Git push fails

```bash
# Pull latest changes first
git pull origin main

# Then push again
./update-addon.sh
```

## Testing Checklist

Before pushing:
- [ ] Python syntax is valid (`python -m py_compile app/main.py`)
- [ ] CSS has no brace mismatches
- [ ] JavaScript has no syntax errors
- [ ] Version bumped if significant change
- [ ] Commit message is descriptive

## Quick Reference

| Task | Command |
|------|---------|
| Update with message | `./update-addon.sh "Fixed bug"` |
| Quick update | `./quick-update.sh` |
| Check status | `git status` |
| View commits | `git log --oneline -5` |
| Test locally | `python panel-widget-config/app/main.py` |
