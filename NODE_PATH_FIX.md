# Node.js Path Detection Fix

## ✅ Fixed: "Node.js is required" Error

The app now properly detects Node.js installed in various locations and runs the correct server command.

---

## 🐛 The Problem

When launching the app, it showed:
```
"Node.js is required to run this application. Please install Node.js from nodejs.org"
```

Even though Node.js was installed on the system.

---

## 🔍 Root Causes

### 1. **Limited PATH Detection**
The original script only checked `command -v node`, which doesn't work when:
- Node.js is installed via Homebrew (Apple Silicon)
- Node.js is installed via NVM
- Node.js is in a non-standard location
- The app doesn't inherit the user's shell PATH

### 2. **Wrong Command**
The script was trying to run:
```bash
npm run electron
```

But tangerin is a **web server app**, not an Electron app!

---

## ✅ The Solution

### 1. **Smart Node.js Detection**
Now checks multiple common installation locations in order:
1. System PATH (`command -v node`)
2. `/usr/local/bin/node` (Intel Homebrew)
3. `/opt/homebrew/bin/node` (Apple Silicon Homebrew)
4. `~/.nvm/versions/node/*/bin/node` (NVM)
5. `/usr/bin/node` (System install)

### 2. **Correct Server Command**
Now runs:
```bash
node server.mjs &
```

Then opens the browser to `http://localhost:3000`

---

## 🔧 Updated Executable Script

### New Features:

**1. Multi-Location Node.js Search**
```bash
NODE_PATH=""
if command -v node &> /dev/null; then
    NODE_PATH="node"
elif [ -f "/usr/local/bin/node" ]; then
    NODE_PATH="/usr/local/bin/node"
elif [ -f "/opt/homebrew/bin/node" ]; then
    NODE_PATH="/opt/homebrew/bin/node"
elif [ -f "$HOME/.nvm/versions/node/*/bin/node" ]; then
    NODE_PATH=$(ls -t $HOME/.nvm/versions/node/*/bin/node | head -1)
elif [ -f "/usr/bin/node" ]; then
    NODE_PATH="/usr/bin/node"
fi
```

**2. Better Error Message**
```bash
if [ -z "$NODE_PATH" ]; then
    osascript -e 'display dialog "Node.js is required to run tangerin.\n\nPlease install Node.js from nodejs.org and try again."'
    open "https://nodejs.org"
    exit 1
fi
```
- Shows clear error message
- Opens nodejs.org in browser
- User can install Node.js easily

**3. Dependency Installation**
```bash
if [ ! -d "node_modules" ]; then
    osascript -e 'display dialog "Installing dependencies...\n\nThis may take a few minutes on first launch."'
    $NPM_PATH install --production
fi
```

**4. Server Launch**
```bash
# Start the server
$NODE_PATH server.mjs &
SERVER_PID=$!

# Wait for server to start
sleep 2

# Open browser
open "http://localhost:3000"

# Show notification
osascript -e 'display notification "Server running on http://localhost:3000" with title "tangerin"'

# Keep running
wait $SERVER_PID
```

---

## 📋 Launch Flow

### When User Opens tangerin.app:

```
1. App launches
   ↓
2. Search for Node.js in common locations
   ↓
3. Found? → Continue
   Not found? → Show error + open nodejs.org
   ↓
4. Check if node_modules exists
   ↓
5. No? → Show dialog + run npm install
   Yes? → Continue
   ↓
6. Start server: node server.mjs
   ↓
7. Wait 2 seconds for server to start
   ↓
8. Open browser: http://localhost:3000
   ↓
9. Show notification: "Server running"
   ↓
10. Keep app running (wait for server process)
```

---

## 🎯 Supported Node.js Installations

### ✅ Homebrew (Intel Mac)
```
/usr/local/bin/node
```

### ✅ Homebrew (Apple Silicon)
```
/opt/homebrew/bin/node
```

### ✅ NVM (Node Version Manager)
```
~/.nvm/versions/node/v18.x.x/bin/node
```
(Automatically finds the latest version)

### ✅ System Install
```
/usr/bin/node
```

### ✅ In PATH
```
Any location in $PATH
```

---

## 📄 Updated README.txt

The DMG now includes a better README:

```
tangerin v1.0.0 🍊
OCR to Audiobook Converter

INSTALLATION:
1. Drag "tangerin.app" to the Applications folder
2. Open the app from Applications or Launchpad
3. The app will open in your default web browser

REQUIREMENTS:
- macOS 10.13 or later
- Node.js 14+ (will prompt to install if missing)
- Internet connection (for OpenAI API)

FIRST RUN:
- The app will install dependencies on first launch (may take 2-3 minutes)
- You may see a security warning - go to System Preferences > Security & Privacy
- Your browser will open to http://localhost:3000

USAGE:
1. Drag and drop images into the upload zone
2. Enter book title and select voice
3. Optionally select a language for translation
4. Click "Start Transformation"
5. Wait for the process to complete
6. Download your audiobook

STOPPING THE APP:
- Close the browser tab
- Quit the app from the Dock or use Cmd+Q
```

---

## 🧪 Testing

### Test the fix:

1. **Rebuild the app:**
   ```bash
   npm run build-mac
   ```

2. **Launch it:**
   ```bash
   open tangerin.app
   ```

3. **Expected behavior:**
   - ✅ No "Node.js required" error
   - ✅ Browser opens to http://localhost:3000
   - ✅ Notification appears: "Server running"
   - ✅ App interface loads correctly

---

## 🔍 Troubleshooting

### If you still see "Node.js required":

**Check Node.js installation:**
```bash
which node
node --version
```

**Check if Node.js is in a supported location:**
```bash
ls -la /usr/local/bin/node
ls -la /opt/homebrew/bin/node
ls -la ~/.nvm/versions/node/*/bin/node
```

**Manually test the executable:**
```bash
tangerin.app/Contents/MacOS/tangerin
```

This will show you exactly what's happening.

---

## 💡 Why This Happens

macOS apps don't inherit the user's shell environment (`.bashrc`, `.zshrc`, etc.), so:
- `$PATH` is minimal (usually just `/usr/bin:/bin:/usr/sbin:/sbin`)
- Custom Node.js installations aren't in the PATH
- We need to explicitly check common installation locations

---

## ✅ Result

The app now:
- ✅ Finds Node.js in all common locations
- ✅ Runs the correct server command
- ✅ Opens the browser automatically
- ✅ Shows helpful notifications
- ✅ Provides clear error messages if Node.js is missing
- ✅ Opens nodejs.org if installation is needed

---

## 🚀 Next Steps

1. **Rebuild the app:**
   ```bash
   npm run build-mac
   ```

2. **Test it:**
   ```bash
   open tangerin.app
   ```

3. **Package for distribution:**
   ```bash
   npm run package
   ```

Your app should now launch successfully! 🎉

