#!/bin/bash

# Build script for macOS app bundle
# This creates a distributable .app bundle for macOS

APP_NAME="tangerin"
APP_BUNDLE="${APP_NAME}.app"
BUNDLE_ID="com.danielrangel.tangerin"
VERSION="1.0.0"

echo "🚀 Building macOS app bundle..."

# Clean previous build
if [ -d "$APP_BUNDLE" ]; then
    echo "🧹 Cleaning previous build..."
    rm -rf "$APP_BUNDLE"
fi

# Create app bundle structure
echo "📁 Creating app bundle structure..."
mkdir -p "$APP_BUNDLE/Contents/MacOS"
mkdir -p "$APP_BUNDLE/Contents/Resources"
mkdir -p "$APP_BUNDLE/Contents/Frameworks"

# Copy only necessary application files
echo "📦 Copying application files..."

# Copy main files
cp main.js "$APP_BUNDLE/Contents/Resources/"
cp server.mjs "$APP_BUNDLE/Contents/Resources/"
cp package.json "$APP_BUNDLE/Contents/Resources/"
cp *.mjs "$APP_BUNDLE/Contents/Resources/" 2>/dev/null || true

# Copy directories
cp -r public "$APP_BUNDLE/Contents/Resources/"
cp -r voices "$APP_BUNDLE/Contents/Resources/"
cp -r images "$APP_BUNDLE/Contents/Resources/" 2>/dev/null || mkdir -p "$APP_BUNDLE/Contents/Resources/images"
cp -r text "$APP_BUNDLE/Contents/Resources/" 2>/dev/null || mkdir -p "$APP_BUNDLE/Contents/Resources/text"
cp -r audio "$APP_BUNDLE/Contents/Resources/" 2>/dev/null || mkdir -p "$APP_BUNDLE/Contents/Resources/audio"

# Copy node_modules (only production dependencies)
echo "📦 Installing production dependencies..."
cd "$APP_BUNDLE/Contents/Resources"
npm install --production --silent
cd - > /dev/null

# Copy icon
echo "🎨 Setting up icon..."
cp assets/icon.png "$APP_BUNDLE/Contents/Resources/icon.png"

# Create Info.plist
echo "📄 Creating Info.plist..."
cat > "$APP_BUNDLE/Contents/Info.plist" << EOF
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>CFBundleExecutable</key>
    <string>tangerin</string>
    <key>CFBundleIdentifier</key>
    <string>${BUNDLE_ID}</string>
    <key>CFBundleName</key>
    <string>${APP_NAME}</string>
    <key>CFBundleDisplayName</key>
    <string>${APP_NAME}</string>
    <key>CFBundleVersion</key>
    <string>${VERSION}</string>
    <key>CFBundleShortVersionString</key>
    <string>${VERSION}</string>
    <key>CFBundleIconFile</key>
    <string>icon.png</string>
    <key>CFBundlePackageType</key>
    <string>APPL</string>
    <key>CFBundleSignature</key>
    <string>????</string>
    <key>LSMinimumSystemVersion</key>
    <string>10.13.0</string>
    <key>NSHighResolutionCapable</key>
    <true/>
    <key>NSSupportsAutomaticGraphicsSwitching</key>
    <true/>
    <key>LSApplicationCategoryType</key>
    <string>public.app-category.productivity</string>
</dict>
</plist>
EOF

# Create executable script
echo "⚙️ Creating executable..."
cat > "$APP_BUNDLE/Contents/MacOS/tangerin" << 'EOF'
#!/bin/bash

# Get the directory where this script is located
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" &> /dev/null && pwd )"
RESOURCES_DIR="$SCRIPT_DIR/../Resources"

# Change to the resources directory
cd "$RESOURCES_DIR"

# Find Node.js in common locations
NODE_PATH=""
if command -v node &> /dev/null; then
    NODE_PATH="node"
elif [ -f "/usr/local/bin/node" ]; then
    NODE_PATH="/usr/local/bin/node"
elif [ -f "/opt/homebrew/bin/node" ]; then
    NODE_PATH="/opt/homebrew/bin/node"
elif [ -f "$HOME/.nvm/versions/node/*/bin/node" ]; then
    NODE_PATH=$(ls -t $HOME/.nvm/versions/node/*/bin/node 2>/dev/null | head -1)
elif [ -f "/usr/bin/node" ]; then
    NODE_PATH="/usr/bin/node"
fi

# Check if Node.js was found
if [ -z "$NODE_PATH" ]; then
    osascript -e 'display dialog "Node.js is required to run tangerin.\n\nPlease install Node.js from nodejs.org and try again." buttons {"OK"} default button "OK" with icon stop'
    open "https://nodejs.org"
    exit 1
fi

# Find npm in common locations
NPM_PATH=""
if command -v npm &> /dev/null; then
    NPM_PATH="npm"
elif [ -f "/usr/local/bin/npm" ]; then
    NPM_PATH="/usr/local/bin/npm"
elif [ -f "/opt/homebrew/bin/npm" ]; then
    NPM_PATH="/opt/homebrew/bin/npm"
elif [ -f "$HOME/.nvm/versions/node/*/bin/npm" ]; then
    NPM_PATH=$(ls -t $HOME/.nvm/versions/node/*/bin/npm 2>/dev/null | head -1)
elif [ -f "/usr/bin/npm" ]; then
    NPM_PATH="/usr/bin/npm"
fi

# Check if npm dependencies are installed
if [ ! -d "node_modules" ]; then
    osascript -e 'display dialog "Installing dependencies...\n\nThis may take a few minutes on first launch." buttons {"OK"} default button "OK" with icon note'
    $NPM_PATH install --production
fi

# Start the server and open browser
echo "Starting tangerin server..."
$NODE_PATH server.mjs &
SERVER_PID=$!

# Wait for server to start
sleep 2

# Open browser to the app
open "http://localhost:3000"

# Show notification
osascript -e 'display notification "Server running on http://localhost:3000" with title "tangerin" subtitle "Ready to convert images to audiobooks"'

# Keep the app running (wait for server process)
wait $SERVER_PID
EOF

# Make executable
chmod +x "$APP_BUNDLE/Contents/MacOS/tangerin"

echo "✅ macOS app bundle created successfully!"
echo "📱 App bundle: $APP_BUNDLE"
echo ""
echo "🚀 To install:"
echo "   # Remove old version (if exists)"
echo "   rm -rf /Applications/$APP_BUNDLE"
echo "   # Move new version"
echo "   mv '$APP_BUNDLE' /Applications/"
echo ""
echo "   Or use the install script:"
echo "   npm run install-app"
echo ""
echo "🧪 To test:"
echo "   open '$APP_BUNDLE'"
echo ""
echo "📦 To create DMG:"
echo "   npm run package"
