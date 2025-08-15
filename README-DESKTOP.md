# 🍊 Tangerin - Desktop App

Transform your images into complete audiobooks using OCR and AI - now as a native desktop application!

## 🚀 Quick Start

### Running the Desktop App

```bash
# Start the desktop application
npm start

# Or use the electron command directly
npm run electron
```

### Development Mode

```bash
# Run in development mode (with dev tools)
npm run electron-dev
```

## 📱 Desktop Features

### ✨ Native Desktop Experience

- **Dedicated Window**: Runs in its own window, not in a browser
- **Menu Bar**: Native macOS/Windows menu with keyboard shortcuts
- **Dock/Taskbar Icon**: Appears as a real desktop application
- **System Integration**: Proper window management and focus handling

### ⌨️ Keyboard Shortcuts

| Shortcut               | Action                         |
| ---------------------- | ------------------------------ |
| `Cmd/Ctrl + N`         | New Project (reload interface) |
| `Cmd/Ctrl + O`         | Open Images Folder             |
| `Cmd/Ctrl + R`         | Reload Interface               |
| `Cmd/Ctrl + Shift + R` | Force Reload                   |
| `Cmd/Ctrl + I`         | Toggle Developer Tools         |
| `Cmd/Ctrl + 0`         | Reset Zoom                     |
| `Cmd/Ctrl + +`         | Zoom In                        |
| `Cmd/Ctrl + -`         | Zoom Out                       |
| `Cmd/Ctrl + Q`         | Quit Application               |

### 🔧 Menu Features

**File Menu:**

- New Project: Start fresh with a clean interface
- Open Images Folder: Quick access to select your images directory
- Quit: Properly close the application

**View Menu:**

- Reload options for refreshing the interface
- Developer tools for debugging
- Zoom controls for better visibility

**Help Menu:**

- About dialog with version information

## 🏗️ How It Works

### Architecture

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Electron      │    │   Express       │    │   OCR/TTS       │
│   Main Process  │────│   Web Server    │────│   Processing    │
│   (Desktop UI)  │    │   (API & UI)    │    │   (Background)  │
└─────────────────┘    └─────────────────┘    └─────────────────┘
```

1. **Electron Main Process**: Creates the desktop window and manages the app lifecycle
2. **Express Server**: Runs internally to serve the web interface and handle API calls
3. **Background Processing**: OCR and TTS operations run as spawned processes

### Startup Sequence

1. Electron starts and creates the main window
2. Express server launches automatically on port 3000
3. Desktop window loads the web interface from localhost:3000
4. All functionality works exactly like the web version

## 🔒 Security Features

- **Context Isolation**: Web content runs in isolated context
- **No Node Integration**: Web content cannot access Node.js APIs directly
- **External Link Protection**: External links open in default browser
- **Navigation Protection**: Prevents navigation to external sites

## 📁 File Structure

```
your-app/
├── main.js                 # Electron main process
├── server.mjs             # Express server (unchanged)
├── public/                # Web interface (unchanged)
│   ├── index.html
│   ├── script.js
│   └── styles.css
├── assets/                # Desktop app assets
│   └── icon.png          # App icon (optional)
├── voices/               # Voice samples
├── images/               # Images to process
└── package.json          # Updated with Electron scripts
```

## 🎯 Advantages Over Web Version

### User Experience

- ✅ **No Browser Required**: Runs as standalone application
- ✅ **Always Available**: Appears in Applications folder / Start menu
- ✅ **Better Performance**: Dedicated Chromium instance
- ✅ **Native Feel**: Proper window controls and system integration

### Functionality

- ✅ **Same Features**: All web functionality preserved
- ✅ **File System Access**: Better integration with local files
- ✅ **Background Processing**: Continues working when minimized
- ✅ **System Notifications**: Native desktop notifications (can be added)

### Distribution

- ✅ **Easy Sharing**: Single executable file
- ✅ **No Server Setup**: Everything bundled together
- ✅ **Offline Capable**: No internet required (except for OpenAI API)

## 🛠️ Development

### Adding Features

The desktop app is a wrapper around your existing web app, so:

- **UI Changes**: Edit files in `public/` folder
- **API Changes**: Edit `server.mjs`
- **Desktop Features**: Edit `main.js`

### Building for Distribution

To create distributable packages, you can add electron-builder:

```bash
npm install electron-builder --save-dev
```

Then add build scripts to package.json and create installers for different platforms.

## 🐛 Troubleshooting

### App Won't Start

- Check if port 3000 is available
- Ensure all dependencies are installed: `npm install`
- Try running the web version first: `npm run web`

### Server Issues

- The Express server runs automatically
- Check console output for server errors
- Server logs appear in the Electron console

### Performance Issues

- Use `Cmd/Ctrl + Shift + I` to open DevTools
- Check for JavaScript errors in the console
- Monitor memory usage in the Performance tab

## 🔄 Updates

To update the desktop app:

1. Pull latest changes from repository
2. Run `npm install` to update dependencies
3. Restart the application

The desktop version automatically includes all updates to the web interface and server functionality.

---

**Enjoy your new desktop audiobook converter!** 🎧📚✨
