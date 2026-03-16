# Configuration & Version Management

## Version Number Location

The version number for this Home Assistant add-on is defined in:

```
panel-widget-config/config.yaml
```

**Current Version Format:** `version: "1.7.29"`

## Version Bump Process

To update the version and push changes to GitHub:

### 1. Update Version Number

Edit `panel-widget-config/config.yaml` and increment the version:

```yaml
name: "Panel Widget Configurator"
version: "1.7.29"  # <-- Update this line
slug: "panel-widget-config"
```

### 2. Commit Changes

```bash
cd /path/to/github-repo
git add panel-widget-config/config.yaml
git add -A  # Add any other modified files
git commit -m "Bump version to 1.7.29 - Added colored info bars to Lights, Covers, and Climate widgets"
```

### 3. Push to GitHub (SSH)

```bash
git push origin main
```

The remote is configured as:
- **URL:** `git@github.com:billmyers2024/wallpanel_configurator.git`
- **Protocol:** SSH

### 4. Update Home Assistant Add-on

After pushing to GitHub:

1. In Home Assistant, go to **Settings** → **Add-ons** → **Add-on Store**
2. Click the **...** menu (top right) → **Check for updates**
3. The Panel Widget Configurator should show an update available
4. Click **Update** to install the new version

## Version Numbering Convention

- **Major** (1.x.x): Breaking changes, major feature additions
- **Minor** (x.7.x): New widgets or significant features
- **Patch** (x.x.29): Bug fixes, UI improvements, minor updates

## Release Checklist

Before pushing a new version:

- [ ] Version number updated in `config.yaml`
- [ ] All changes committed
- [ ] Commit message includes version number
- [ ] Changes tested locally (if possible)
- [ ] Pushed to `origin main` via SSH
- [ ] Home Assistant add-on store refreshed
- [ ] Update available appears in HA

## Git Configuration

Current repository settings:

```
Remote: origin
URL: git@github.com:billmyers2024/wallpanel_configurator.git
Branch: main
```

To verify your SSH access to GitHub:

```bash
ssh -T git@github.com
```

You should see: `Hi billmyers2024! You've successfully authenticated...`
