#!/bin/bash

# Install script for tangerin.app
# This removes any existing version and installs the new one

APP_NAME="tangerin"
APP_BUNDLE="${APP_NAME}.app"
INSTALL_DIR="/Applications"

echo "📦 Installing tangerin.app..."

# Check if app bundle exists in current directory
if [ ! -d "$APP_BUNDLE" ]; then
    echo "❌ App bundle not found: $APP_BUNDLE"
    echo "   Run 'npm run build-mac' first to create the app bundle."
    exit 1
fi

# Remove old version if it exists
if [ -d "$INSTALL_DIR/$APP_BUNDLE" ]; then
    echo "🗑️  Removing old version..."
    rm -rf "$INSTALL_DIR/$APP_BUNDLE"
    if [ $? -eq 0 ]; then
        echo "   ✅ Old version removed"
    else
        echo "   ❌ Failed to remove old version (may need sudo)"
        echo "   Try: sudo rm -rf $INSTALL_DIR/$APP_BUNDLE"
        exit 1
    fi
fi

# Copy new version to Applications
echo "📥 Installing new version..."
cp -R "$APP_BUNDLE" "$INSTALL_DIR/"

if [ $? -eq 0 ]; then
    echo "✅ Installation complete!"
    echo ""
    echo "🚀 tangerin.app is now installed in /Applications"
    echo ""
    echo "To launch:"
    echo "   open -a tangerin"
    echo ""
    echo "Or find it in Launchpad/Applications folder"
else
    echo "❌ Installation failed"
    echo "   You may need to run with sudo:"
    echo "   sudo npm run install-app"
    exit 1
fi

