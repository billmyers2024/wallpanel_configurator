# Configuration & Version Management

## Version Number Location

The version number for this Home Assistant add-on is defined in:

```
panel-widget-config/config.yaml
```

**Current Version Format:** `version: "1.7.30"`

---

## When to Bump the Version

**You MUST bump the version number for EVERY change that affects the add-on.**

### Changes that REQUIRE a version bump:

- ✅ **UI changes** (HTML, CSS, JS modifications)
- ✅ **New features** (new widgets, new options)
- ✅ **Bug fixes** (any code fixes)
- ✅ **Documentation updates** (if shown in the UI)
- ✅ **Configuration changes** (config.yaml, options schema)
- ✅ **Template changes** (widget templates, forms)

### Why version bumps are mandatory:

Home Assistant's add-on system **only detects updates when the version number changes**. If you push changes without bumping the version:

1. **Users won't see an update available** in their Add-on Store
2. **The "Check for updates" button will find nothing**
3. **Existing installations will stay on the old version**
4. **Your changes effectively won't reach users**

### What happens if you forget to bump:

```
❌ You push:    config.yaml changes (version still 1.7.28)
❌ User checks: "No updates available"
❌ Result:      Changes are invisible to all users
```

### Version bump required for every commit:

Think of the version number as a **deployment trigger**. Even for "small" changes:
- CSS color adjustments → Bump version
- Text typo fixes → Bump version  
- HTML layout tweaks → Bump version
- JavaScript bug fixes → Bump version

---

## Version Bump Process

### Step 1: Update Version Number

Edit `panel-widget-config/config.yaml` and increment the version:

```yaml
name: "Panel Widget Configurator"
version: "1.7.30"  # <-- Increment this (was 1.7.29, now 1.7.30)
slug: "panel-widget-config"
```

**Increment rules:**
- **Patch** (x.x.30): Bug fixes, UI tweaks, minor improvements
- **Minor** (x.8.x): New widgets, significant features
- **Major** (2.x.x): Breaking changes, architecture changes

### Step 2: Stage All Changes

```bash
cd /path/to/github-repo
git add panel-widget-config/config.yaml    # The version bump
git add -A                                 # All other modified files
```

### Step 3: Commit with Descriptive Message

```bash
git commit -m "Bump version to 1.7.30 - Description of changes

Changes:
- Detail change 1
- Detail change 2
- Detail change 3"
```

### Step 4: Push to GitHub (SSH)

```bash
git push origin main
```

The remote is configured as:
- **URL:** `git@github.com:billmyers2024/wallpanel_configurator.git`
- **Protocol:** SSH

### Step 5: Update Home Assistant Add-on

After pushing to GitHub:

1. In Home Assistant, go to **Settings** → **Add-ons** → **Add-on Store**
2. Click the **...** menu (top right) → **Check for updates**
3. The Panel Widget Configurator should show update available
4. Click **Update** to install the new version

---

## Version Numbering Convention (SemVer)

| Level | Format | When to Bump | Example |
|-------|--------|--------------|---------|
| **Major** | 2.x.x | Breaking changes, new architecture | Complete UI redesign |
| **Minor** | x.8.x | New widgets, major features | Adding Music widget |
| **Patch** | x.x.30| Bug fixes, UI improvements, minor updates | Color bar additions |

**Current version:** 1.7.30 (Major: 1, Minor: 7, Patch: 30)

---

## Release Checklist

Before pushing a new version, verify:

- [ ] Version number incremented in `config.yaml`
- [ ] All modified files staged (`git add -A`)
- [ ] Commit message includes new version number
- [ ] Commit message describes the changes
- [ ] Pushed to `origin main` via SSH
- [ ] Home Assistant add-on store will detect the update
- [ ] Users can see and install the update

---

## Quick Reference: Version Bump Command Sequence

```bash
# 1. Edit config.yaml - update version number
nano panel-widget-config/config.yaml

# 2. Stage all changes
git add -A

# 3. Commit with version in message
git commit -m "Bump version to 1.7.30 - Description of changes"

# 4. Push to GitHub
git push origin main

# 5. Verify push
git log -1
```

---

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

---

## Troubleshooting

### Users don't see the update

1. Check the version was actually bumped in `config.yaml`
2. Verify the push succeeded: `git log -1`
3. In Home Assistant: Add-on Store → **...** → **Check for updates**
4. Wait 1-2 minutes and refresh the add-on store page

### Git push fails

```bash
# Check SSH access
ssh -T git@github.com

# Check remote URL
git remote -v

# Should show: git@github.com:billmyers2024/wallpanel_configurator.git
```
