const { app, BrowserWindow, Menu, shell, dialog } = require("electron");
const path = require("path");
const { spawn } = require("child_process");

let mainWindow;
let serverProcess;

function createWindow() {
  // Create the browser window
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 1200,
    minHeight: 700,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      enableRemoteModule: false,
      webSecurity: true,
    },
    titleBarStyle: "default",
    show: false, // Don't show until ready
    icon: path.join(__dirname, "assets/icon.png"), // Add icon if you have one
  });

  // Start the Express server
  startServer();

  // Load the app (wait for server to start)
  setTimeout(() => {
    mainWindow.loadURL("http://localhost:3000");
  }, 2000);

  // Show window when ready
  mainWindow.once("ready-to-show", () => {
    mainWindow.show();

    // Focus on window
    if (process.platform === "darwin") {
      app.dock.show();
    }
  });

  // Handle window closed
  mainWindow.on("closed", () => {
    mainWindow = null;
  });

  // Handle external links
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: "deny" };
  });

  // Prevent navigation to external sites
  mainWindow.webContents.on("will-navigate", (event, navigationUrl) => {
    const parsedUrl = new URL(navigationUrl);

    if (parsedUrl.origin !== "http://localhost:3000") {
      event.preventDefault();
    }
  });
}

function startServer() {
  // Start the Express server
  serverProcess = spawn("node", ["server.mjs"], {
    cwd: __dirname,
    stdio: ["pipe", "pipe", "pipe"],
  });

  serverProcess.stdout.on("data", (data) => {
    console.log(`Server: ${data}`);
  });

  serverProcess.stderr.on("data", (data) => {
    console.error(`Server Error: ${data}`);
  });

  serverProcess.on("close", (code) => {
    console.log(`Server process exited with code ${code}`);
  });
}

function createMenu() {
  const template = [
    {
      label: "File",
      submenu: [
        {
          label: "New Project",
          accelerator: "CmdOrCtrl+N",
          click: () => {
            // Reload the page to start fresh
            if (mainWindow) {
              mainWindow.reload();
            }
          },
        },
        {
          label: "Open Images Folder",
          accelerator: "CmdOrCtrl+O",
          click: async () => {
            const result = await dialog.showOpenDialog(mainWindow, {
              properties: ["openDirectory"],
              title: "Select Images Folder",
            });

            if (!result.canceled) {
              shell.showItemInFolder(result.filePaths[0]);
            }
          },
        },
        { type: "separator" },
        {
          label: "Quit",
          accelerator: process.platform === "darwin" ? "Cmd+Q" : "Ctrl+Q",
          click: () => {
            app.quit();
          },
        },
      ],
    },
    {
      label: "View",
      submenu: [
        {
          label: "Reload",
          accelerator: "CmdOrCtrl+R",
          click: () => {
            if (mainWindow) {
              mainWindow.reload();
            }
          },
        },
        {
          label: "Force Reload",
          accelerator: "CmdOrCtrl+Shift+R",
          click: () => {
            if (mainWindow) {
              mainWindow.webContents.reloadIgnoringCache();
            }
          },
        },
        {
          label: "Toggle Developer Tools",
          accelerator:
            process.platform === "darwin" ? "Alt+Cmd+I" : "Ctrl+Shift+I",
          click: () => {
            if (mainWindow) {
              mainWindow.webContents.toggleDevTools();
            }
          },
        },
        { type: "separator" },
        {
          label: "Actual Size",
          accelerator: "CmdOrCtrl+0",
          click: () => {
            if (mainWindow) {
              mainWindow.webContents.zoomLevel = 0;
            }
          },
        },
        {
          label: "Zoom In",
          accelerator: "CmdOrCtrl+Plus",
          click: () => {
            if (mainWindow) {
              mainWindow.webContents.zoomLevel += 0.5;
            }
          },
        },
        {
          label: "Zoom Out",
          accelerator: "CmdOrCtrl+-",
          click: () => {
            if (mainWindow) {
              mainWindow.webContents.zoomLevel -= 0.5;
            }
          },
        },
      ],
    },
    {
      label: "Window",
      submenu: [
        {
          label: "Minimize",
          accelerator: "CmdOrCtrl+M",
          role: "minimize",
        },
        {
          label: "Close",
          accelerator: "CmdOrCtrl+W",
          role: "close",
        },
      ],
    },
    {
      label: "Help",
      submenu: [
        {
          label: "About Tangerin",
          click: () => {
            dialog.showMessageBox(mainWindow, {
              type: "info",
              title: "About",
              message: "Tangerin",
              detail:
                "Transform your images into complete audiobooks using OCR and AI.\n\nVersion 1.0.0",
            });
          },
        },
      ],
    },
  ];

  // macOS specific menu adjustments
  if (process.platform === "darwin") {
    template.unshift({
      label: app.getName(),
      submenu: [
        {
          label: "About " + app.getName(),
          role: "about",
        },
        { type: "separator" },
        {
          label: "Services",
          role: "services",
          submenu: [],
        },
        { type: "separator" },
        {
          label: "Hide " + app.getName(),
          accelerator: "Command+H",
          role: "hide",
        },
        {
          label: "Hide Others",
          accelerator: "Command+Shift+H",
          role: "hideothers",
        },
        {
          label: "Show All",
          role: "unhide",
        },
        { type: "separator" },
        {
          label: "Quit",
          accelerator: "Command+Q",
          click: () => app.quit(),
        },
      ],
    });
  }

  const menu = Menu.buildFromTemplate(template);
  Menu.setApplicationMenu(menu);
}

// App event handlers
app.whenReady().then(() => {
  createWindow();
  createMenu();

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on("window-all-closed", () => {
  // Kill server process
  if (serverProcess) {
    serverProcess.kill();
  }

  if (process.platform !== "darwin") {
    app.quit();
  }
});

app.on("before-quit", () => {
  // Kill server process
  if (serverProcess) {
    serverProcess.kill();
  }
});

// Security: Prevent new window creation
app.on("web-contents-created", (event, contents) => {
  contents.on("new-window", (event, navigationUrl) => {
    event.preventDefault();
    shell.openExternal(navigationUrl);
  });
});
