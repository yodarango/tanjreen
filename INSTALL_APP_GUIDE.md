# Installing tangerin.app

## ✅ Quick Install

After building the app, use the install script:

```bash
npm run install-app
```

This automatically:
- ✅ Removes old version (if exists)
- ✅ Installs new version to /Applications
- ✅ Handles "Directory not empty" errors

---

## 🐛 The "Directory not empty" Error

### Why It Happens:
```bash
mv tangerin.app /Applications/
# Error: mv: rename tangerin.app to /Applications/tangerin.app: Directory not empty
```

**Cause:** There's already a `tangerin.app` in `/Applications/` from a previous installation. The `mv` command can't overwrite directories that contain files.

---

## 🔧 Manual Solutions

### Option 1: Remove Old Version First (Recommended)
```bash
# Remove old version
rm -rf /Applications/tangerin.app

# Move new version
mv tangerin.app /Applications/
```

### Option 2: Use Copy Instead of Move
```bash
# Remove old version
rm -rf /Applications/tangerin.app

# Copy new version
cp -R tangerin.app /Applications/
```

### Option 3: Use the Install Script
```bash
npm run install-app
```

---

## 📋 Complete Build & Install Workflow

### 1. Build the app:
```bash
npm run build-mac
```
**Output:** `tangerin.app` in current directory

### 2. Install to Applications:
```bash
npm run install-app
```
**Result:** App installed to `/Applications/tangerin.app`

### 3. Launch the app:
```bash
open -a tangerin
```
**Result:** Browser opens to http://localhost:3000

---

## 🚀 Alternative: Build, Package, and Distribute

### For Distribution to Others:

```bash
# 1. Build the app
npm run build-mac

# 2. Package into DMG
npm run package
```

**Output:** `tangerin-v1.0.0.dmg`

Users can then:
1. Download the DMG
2. Open it
3. Drag `tangerin.app` to Applications folder
4. Launch from Launchpad

---

## 🧪 Testing After Install

### Launch from command line:
```bash
open -a tangerin
```

### Launch from Spotlight:
1. Press `Cmd + Space`
2. Type "tangerin"
3. Press Enter

### Launch from Launchpad:
1. Open Launchpad
2. Find "tangerin"
3. Click to launch

### Expected Behavior:
- ✅ Browser opens to http://localhost:3000
- ✅ Notification: "Server running on http://localhost:3000"
- ✅ App interface loads
- ✅ Ready to upload images

---

## 🗑️ Uninstalling

### Remove the app:
```bash
rm -rf /Applications/tangerin.app
```

### Also remove from Dock (if pinned):
- Right-click on tangerin in Dock
- Options → Remove from Dock

---

## 💡 Why `mv` Doesn't Work for Overwriting

The `mv` command in macOS/Unix:
- ✅ Can overwrite **files**
- ❌ Cannot overwrite **directories** that contain files
- ✅ Can rename directories
- ❌ Cannot merge directories

**Solution:** Always remove the old directory first, then move/copy the new one.

---

## 📦 Install Script Details

The `install-app.sh` script does:

```bash
1. Check if tangerin.app exists in current directory
   ↓
2. Check if /Applications/tangerin.app exists
   ↓
3. If yes → Remove it: rm -rf /Applications/tangerin.app
   ↓
4. Copy new version: cp -R tangerin.app /Applications/
   ↓
5. Success! App installed
```

---

## 🔒 Permissions Issues

### If you get "Permission denied":

```bash
# Option 1: Use sudo
sudo npm run install-app

# Option 2: Manually with sudo
sudo rm -rf /Applications/tangerin.app
sudo cp -R tangerin.app /Applications/
```

**Note:** Usually not needed unless /Applications has restricted permissions.

---

## ✅ Summary

### Quick Commands:

```bash
# Build
npm run build-mac

# Install
npm run install-app

# Launch
open -a tangerin

# Uninstall
rm -rf /Applications/tangerin.app
```

### Or for distribution:

```bash
# Build + Package
npm run build-mac
npm run package

# Share the DMG
# → tangerin-v1.0.0.dmg
```

---

## 🎯 Recommended Workflow

**For Development:**
```bash
# Rebuild and reinstall
npm run build-mac && npm run install-app

# Test
open -a tangerin
```

**For Distribution:**
```bash
# Create DMG
npm run build-mac && npm run package

# Share tangerin-v1.0.0.dmg with users
```

---

The install script makes it easy to update your app without dealing with "Directory not empty" errors! 🎉

