#!/bin/bash

# Package script for creating distributable DMG
# This creates a DMG file that users can download and install

APP_NAME="Tangerin"
APP_BUNDLE="${APP_NAME}.app"
DMG_NAME="Tangerin-v1.0.0.dmg"
TEMP_DMG="temp.dmg"
VOLUME_NAME="Tangerin"

echo "📦 Creating distributable DMG..."

# Check if app bundle exists
if [ ! -d "$APP_BUNDLE" ]; then
    echo "❌ App bundle not found. Run 'npm run build-mac' first."
    exit 1
fi

# Clean previous DMG
if [ -f "$DMG_NAME" ]; then
    echo "🧹 Removing previous DMG..."
    rm "$DMG_NAME"
fi

if [ -f "$TEMP_DMG" ]; then
    rm "$TEMP_DMG"
fi

# Create temporary directory for DMG contents
TEMP_DIR=$(mktemp -d)
echo "📁 Using temporary directory: $TEMP_DIR"

# Copy app bundle to temp directory
echo "📦 Copying app bundle..."
cp -R "$APP_BUNDLE" "$TEMP_DIR/"

# Create Applications symlink
echo "🔗 Creating Applications symlink..."
ln -s /Applications "$TEMP_DIR/Applications"

# Create README for users
echo "📄 Creating user README..."
cat > "$TEMP_DIR/README.txt" << EOF
Tangerin v1.0.0

INSTALLATION:
1. Drag "Tangerin.app" to the Applications folder
2. Open the app from Applications or Launchpad

REQUIREMENTS:
- macOS 10.13 or later
- Node.js (will prompt to install if missing)

FIRST RUN:
- The app may take a moment to install dependencies on first launch
- You may see a security warning - go to System Preferences > Security & Privacy to allow the app

USAGE:
1. Place your images in the /images folder within the app
2. Configure book title and voice
3. Click "Start Transformation"
4. Wait for the process to complete
5. Find your audiobook in the /audio folder

SUPPORT:
For issues or questions, contact: danranngel@gmail.com

Enjoy your audiobooks! 🎧📚
EOF

# Calculate size needed for DMG
SIZE=$(du -sm "$TEMP_DIR" | cut -f1)
SIZE=$((SIZE + 50)) # Add 50MB padding

echo "💾 Creating DMG (${SIZE}MB)..."

# Create DMG
hdiutil create -srcfolder "$TEMP_DIR" -volname "$VOLUME_NAME" -fs HFS+ -fsargs "-c c=64,a=16,e=16" -format UDRW -size ${SIZE}m "$TEMP_DMG"

# Mount the DMG
echo "🔧 Mounting DMG for customization..."
DEVICE=$(hdiutil attach -readwrite -noverify -noautoopen "$TEMP_DMG" | egrep '^/dev/' | sed 1q | awk '{print $1}')
MOUNT_POINT="/Volumes/$VOLUME_NAME"

# Wait for mount
sleep 2

# Customize DMG appearance
echo "🎨 Customizing DMG appearance..."

# Set background and icon positions using AppleScript
osascript << EOF
tell application "Finder"
    tell disk "$VOLUME_NAME"
        open
        set current view of container window to icon view
        set toolbar visible of container window to false
        set statusbar visible of container window to false
        set the bounds of container window to {400, 100, 900, 400}
        set viewOptions to the icon view options of container window
        set arrangement of viewOptions to not arranged
        set icon size of viewOptions to 72
        set position of item "$APP_NAME.app" of container window to {150, 150}
        set position of item "Applications" of container window to {350, 150}
        set position of item "README.txt" of container window to {250, 250}
        close
        open
        update without registering applications
        delay 2
    end tell
end tell
EOF

# Unmount the DMG
echo "📤 Unmounting DMG..."
hdiutil detach "$DEVICE"

# Convert to compressed, read-only DMG
echo "🗜️ Compressing DMG..."
hdiutil convert "$TEMP_DMG" -format UDZO -imagekey zlib-level=9 -o "$DMG_NAME"

# Clean up
echo "🧹 Cleaning up..."
rm "$TEMP_DMG"
rm -rf "$TEMP_DIR"

# Get file size
DMG_SIZE=$(du -h "$DMG_NAME" | cut -f1)

echo ""
echo "✅ DMG created successfully!"
echo "📦 File: $DMG_NAME"
echo "💾 Size: $DMG_SIZE"
echo ""
echo "🚀 Ready for distribution!"
echo "   Users can download this DMG file and install the app"
echo ""
echo "🧪 To test the DMG:"
echo "   open '$DMG_NAME'"
