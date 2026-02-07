import { validateTransformationRequest } from "./src/utils/validate.mjs";
import { authenticateToken } from "./src/middleware/auth.mjs";
import { sendCompletionEmail } from "./src/utils/email.mjs";
import { spawn } from "child_process";
import jwt from "jsonwebtoken";
import express from "express";
import multer from "multer";
import archiver from "archiver";
import dotenv from "dotenv";
import crypto from "crypto";
import path from "path";
import fs from "fs";

// Load environment variables
dotenv.config();

/**
 * Clean and recreate the working directory to avoid old files from previous runs
 * Completely deletes and recreates 2.working directory including all subdirectories
 */
async function cleanWorkingDirectory(workingDir) {
  console.log(" - Cleaning working directory:", workingDir);

  try {
    // Completely remove the working directory if it exists
    if (fs.existsSync(workingDir)) {
      fs.rmSync(workingDir, { recursive: true, force: true });
      console.log(" ✔ Deleted entire working directory");
    }

    // Recreate the working directory structure
    fs.mkdirSync(workingDir, { recursive: true });
    fs.mkdirSync(path.join(workingDir, "text"), { recursive: true });
    fs.mkdirSync(path.join(workingDir, "audio"), { recursive: true });
    console.log(" ✔ Recreated working directory with subdirectories");
    console.log("✅ Working directory cleaned successfully");
  } catch (error) {
    console.error("❌ Error cleaning working directory:", error.message);
    throw error;
  }
}

const app = express();
const PORT = process.env.PORT || 8013;

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    const pendingDir = process.env.PENDING_DIR;
    // Ensure directory exists
    if (!fs.existsSync(pendingDir)) {
      fs.mkdirSync(pendingDir, { recursive: true });
    }
    cb(null, pendingDir);
  },
  filename: function (req, file, cb) {
    // Keep original filename
    cb(null, file.originalname);
  },
});

const upload = multer({
  storage: storage,
  fileFilter: function (req, file, cb) {
    // Accept images and PDFs
    const allowedTypes = /jpeg|jpg|png|gif|bmp|tiff|webp|heic|heif|pdf/;
    const extname = allowedTypes.test(
      path.extname(file.originalname).toLowerCase(),
    );
    const mimetype =
      allowedTypes.test(file.mimetype) ||
      file.mimetype === "image/heic" ||
      file.mimetype === "image/heif" ||
      file.mimetype === "application/pdf";

    if (mimetype && extname) {
      return cb(null, true);
    } else {
      cb(new Error("Only image and PDF files are allowed!"));
    }
  },
});

// Middleware
app.use(express.json());

// HTML page routes (without .html extension)
app.get("/login", (req, res) => {
  res.sendFile(path.join(process.cwd(), "public", "login.html"));
});

app.get("/", (req, res) => {
  res.sendFile(path.join(process.cwd(), "public", "index.html"));
});

app.get("/content", (req, res) => {
  res.sendFile(path.join(process.cwd(), "public", "content.html"));
});

// Serve static files for assets (CSS, JS, images, etc.)
app.use(express.static("public"));

// ============================================================================
// MULTI-PROCESS MANAGEMENT SYSTEM
// ============================================================================

/**
 * Generate a unique 10-character alphanumeric ID (uppercase only)
 */
function generateProcessId() {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  let id = "";
  const randomBytes = crypto.randomBytes(10);
  for (let i = 0; i < 10; i++) {
    id += chars[randomBytes[i] % chars.length];
  }
  return id;
}

/**
 * Map to store all active processes
 * Key: processId (10-char alphanumeric)
 * Value: {
 *   processId: string,
 *   bookTitle: string,
 *   childProcess: ChildProcess,
 *   state: {
 *     isRunning: boolean,
 *     completed: boolean,
 *     outputPath: string | null,
 *     messages: string[],
 *     currentStep: number,
 *     progress: number,
 *     error: string | null,
 *     currentStepProcess: { totalItems: number, currentItem: number }
 *   },
 *   createdAt: Date
 * }
 */
const activeProcesses = new Map();

/**
 * Get the most recent process ID
 */
function getMostRecentProcessId() {
  if (activeProcesses.size === 0) return null;

  let mostRecent = null;
  let latestTime = 0;

  for (const [processId, processData] of activeProcesses.entries()) {
    if (processData.createdAt.getTime() > latestTime) {
      latestTime = processData.createdAt.getTime();
      mostRecent = processId;
    }
  }

  return mostRecent;
}

// Legacy global state for backward compatibility (deprecated)
let transformationState = {
  isRunning: false,
  completed: false,
  outputPath: null,
  bookTitle: null,
  messages: [],
  currentStep: 0,
  progress: 0,
  error: null,
  currentStepProcess: {
    totalItems: 0,
    currentItem: 0,
  },
};

// API Routes

// Login endpoint - NOT protected
app.post("/api/login", async (req, res) => {
  try {
    const { password } = req.body;

    if (!password) {
      return res.status(400).json({ error: "Password is required" });
    }

    // Get password from environment variable
    const authPassword = process.env.AUTH_PASSWORD;

    // Compare password (plain text for now as requested)
    if (password !== authPassword) {
      return res.status(401).json({ error: "Invalid password" });
    }

    // Generate JWT token (no expiration)
    const jwtSecret = process.env.JWT_SECRET || "your-secret-key-change-this";
    const token = jwt.sign(
      { authenticated: true, timestamp: Date.now() },
      jwtSecret,
    );

    res.json({
      success: true,
      token: token,
      message: "Login successful",
    });
  } catch (error) {
    console.error("Login error:", error);
    res.status(500).json({ error: "Login failed" });
  }
});

// Get list of images and PDFs in the pending directory so we can show them to the user
app.get("/api/images", authenticateToken, (req, res) => {
  try {
    const imagesDir = process.env.PENDING_DIR;

    if (!fs.existsSync(imagesDir)) {
      return res.json([]);
    }

    const files = fs.readdirSync(imagesDir);
    const processableFiles = files.filter((file) => {
      const ext = path.extname(file).toLowerCase();
      return [
        ".jpg",
        ".jpeg",
        ".png",
        ".gif",
        ".bmp",
        ".tiff",
        ".webp",
        ".heic",
        ".heif",
        ".pdf",
      ].includes(ext);
    });

    res.json(processableFiles.sort());
  } catch (error) {
    console.error("Error reading images directory:", error);
    res.status(500).json({ error: "Failed to read images directory" });
  }
});

// Clear pending directory endpoint - must be called before upload
app.post("/api/clear-pending", authenticateToken, (req, res) => {
  try {
    const pendingDir = process.env.PENDING_DIR;

    console.log("🗑️  Clearing pending directory...");
    if (fs.existsSync(pendingDir)) {
      const existingFiles = fs.readdirSync(pendingDir);
      for (const file of existingFiles) {
        const filePath = path.join(pendingDir, file);
        if (fs.statSync(filePath).isFile()) {
          fs.unlinkSync(filePath);
          console.log(`   Deleted: ${file}`);
        }
      }
    } else {
      // Create directory if it doesn't exist
      fs.mkdirSync(pendingDir, { recursive: true });
      console.log("📁 Created pending directory");
    }

    console.log("✅ Pending directory cleared");
    res.json({ success: true, message: "Pending directory cleared" });
  } catch (error) {
    console.error("❌ Error clearing pending directory:", error);
    res.status(500).json({ error: "Failed to clear pending directory" });
  }
});

// Upload images - files are saved by multer middleware
app.post(
  "/api/upload-images",
  authenticateToken,
  upload.array("images"),
  (req, res) => {
    try {
      // Files are already uploaded by multer middleware
      const uploadedFiles = req.files || [];

      console.log(`✅ Uploaded ${uploadedFiles.length} new images`);
      uploadedFiles.forEach((file) => {
        console.log(`   📁 ${file.filename}`);
      });

      res.json({
        success: true,
        message: `Successfully uploaded ${uploadedFiles.length} images`,
        files: uploadedFiles.map((f) => f.filename),
      });
    } catch (error) {
      console.error("❌ Error uploading images:", error);
      res.status(500).json({ error: "Failed to upload images" });
    }
  },
);

// Once the user click start transformation, this will be ran
app.post("/api/start-transformation", authenticateToken, async (req, res) => {
  try {
    const { bookTitle, voice, language } = req.body;

    // Validate the request parameters
    const validation = validateTransformationRequest(
      bookTitle,
      voice,
      language,
    );

    if (!validation.isValid) {
      return res.status(400).json({
        error: "Validation failed",
        details: validation.errors,
        availableVoices: validation.availableVoices,
        availableLanguages: validation.availableLanguages,
      });
    }

    // Generate unique process ID
    const processId = generateProcessId();

    // Create initial state for this process
    const initialState = {
      completed: false,
      isRunning: true,
      bookTitle: bookTitle,
      outputPath: null,
      messages: [],
      currentStep: 0,
      progress: 0,
      error: null,
      currentStepProcess: {
        totalItems: 0,
        currentItem: 0,
      },
    };

    // Store process in the Map
    activeProcesses.set(processId, {
      processId: processId,
      bookTitle: bookTitle,
      childProcess: null, // Will be set after spawn
      state: initialState,
      createdAt: new Date(),
    });

    // Also update legacy state for backward compatibility
    transformationState = { ...initialState };

    // Clean the working directory BEFORE starting the process
    const workingDir = process.env.WORKING_DIR;
    await cleanWorkingDirectory(workingDir);

    // write the book title, voice, and language to temp.json file under the working dir so that the child process can grab them later
    const tempData = {
      bookTitle,
      voice,
      language: language || null,
    };

    fs.writeFileSync(
      `${workingDir}/temp.json`,
      JSON.stringify(tempData, null, 2),
    );

    // Start the transformation process
    const child = startTransformationProcess(processId, bookTitle, language);

    // Update the child process reference
    if (child) {
      activeProcesses.get(processId).childProcess = child;
    }

    console.log(`🚀 Started new process: ${processId} - "${bookTitle}"`);

    res.json({
      success: true,
      message: "Transformation started",
      processId: processId,
    });
  } catch (error) {
    console.error("Error starting transformation:", error);
    res.status(500).json({ error: "Failed to start transformation" });
  }
});

// Start transformation from pasted text (skips OCR and amalgamation)
app.post(
  "/api/start-transformation-from-text",
  authenticateToken,
  async (req, res) => {
    try {
      const { bookTitle, voice, language, text } = req.body;

      // Validate the request parameters
      const validation = validateTransformationRequest(
        bookTitle,
        voice,
        language,
      );

      if (!validation.isValid) {
        return res.status(400).json({
          error: "Validation failed",
          details: validation.errors,
          availableVoices: validation.availableVoices,
          availableLanguages: validation.availableLanguages,
        });
      }

      // Validate text input
      if (!text || text.trim() === "") {
        return res.status(400).json({ error: "Text input is required" });
      }

      // Generate unique process ID
      const processId = generateProcessId();

      // Create initial state for this process
      const initialState = {
        completed: false,
        isRunning: true,
        bookTitle: bookTitle,
        outputPath: null,
        messages: [],
        currentStep: 0,
        progress: 0,
        error: null,
        currentStepProcess: {
          totalItems: 0,
          currentItem: 0,
        },
      };

      // Store process in the Map
      activeProcesses.set(processId, {
        processId: processId,
        bookTitle: bookTitle,
        childProcess: null,
        state: initialState,
        createdAt: new Date(),
      });

      // Also update legacy state
      transformationState = { ...initialState };

      // Clean the working directory BEFORE starting the process
      const workingDir = process.env.WORKING_DIR;
      const doneDir = process.env.DONE_DIR;
      await cleanWorkingDirectory(workingDir);

      // Sanitize book title for file/folder names
      let sanitizedBookTitle = bookTitle
        .replace(/[^a-zA-Z0-9]+/g, "_")
        .replace(/^_+|_+$/g, "");

      // Create the done directory structure
      const bookDir = path.join(doneDir, sanitizedBookTitle);
      if (!fs.existsSync(bookDir)) {
        fs.mkdirSync(bookDir, { recursive: true });
      }

      // Save the text to working directory as complete.txt (for step 3 to process)
      const workingTextPath = path.join(workingDir, "text", "complete.txt");
      fs.writeFileSync(workingTextPath, text, "utf8");
      console.log(
        `✅ Saved pasted text to working directory: ${workingTextPath}`,
      );

      // Write the book title, voice, and language to temp.json
      const tempData = {
        bookTitle,
        voice,
        language: language || null,
        skipOCR: true, // Flag to indicate we should skip OCR and amalgamation
      };

      fs.writeFileSync(
        `${workingDir}/temp.json`,
        JSON.stringify(tempData, null, 2),
      );

      // Start the transformation process (will skip steps 1 and 2)
      const child = startTransformationProcessFromText(
        processId,
        bookTitle,
        language,
      );

      // Update the child process reference
      if (child) {
        activeProcesses.get(processId).childProcess = child;
      }

      console.log(
        `🚀 Started new process from text: ${processId} - "${bookTitle}"`,
      );

      res.json({
        success: true,
        message: "Transformation started from text",
        processId: processId,
      });
    } catch (error) {
      console.error("Error starting transformation from text:", error);
      res
        .status(500)
        .json({ error: "Failed to start transformation from text" });
    }
  },
);

// ============================================================================
// NEW MULTI-PROCESS API ENDPOINTS
// ============================================================================

// Get list of all active processes
app.get("/api/processes", authenticateToken, (req, res) => {
  try {
    const processList = [];

    for (const [processId, processData] of activeProcesses.entries()) {
      processList.push({
        processId: processId,
        bookTitle: processData.bookTitle,
        progress: processData.state.progress,
        currentStep: processData.state.currentStep,
        isRunning: processData.state.isRunning,
        completed: processData.state.completed,
        error: processData.state.error,
        createdAt: processData.createdAt,
      });
    }

    // Sort by creation time (most recent first)
    processList.sort((a, b) => b.createdAt - a.createdAt);

    res.json({
      processes: processList,
      mostRecentId: getMostRecentProcessId(),
    });
  } catch (error) {
    console.error("Error getting processes list:", error);
    res.status(500).json({ error: "Failed to get processes list" });
  }
});

// Get detailed state of a specific process
app.get("/api/process/:processId", authenticateToken, (req, res) => {
  try {
    const { processId } = req.params;

    if (!activeProcesses.has(processId)) {
      return res.status(404).json({ error: "Process not found" });
    }

    const processData = activeProcesses.get(processId);

    res.json({
      processId: processId,
      bookTitle: processData.bookTitle,
      state: processData.state,
      createdAt: processData.createdAt,
    });
  } catch (error) {
    console.error("Error getting process details:", error);
    res.status(500).json({ error: "Failed to get process details" });
  }
});

// Get transformation progress (legacy endpoint - returns most recent process)
app.get("/api/progress", authenticateToken, (req, res) => {
  const mostRecentId = getMostRecentProcessId();

  if (mostRecentId && activeProcesses.has(mostRecentId)) {
    const processData = activeProcesses.get(mostRecentId);
    res.json({
      ...processData.state,
      processId: mostRecentId,
    });
  } else {
    // Return legacy state if no processes
    res.json(transformationState);
  }
});

// Get list of completed content files and folders
app.get("/api/content", authenticateToken, (req, res) => {
  try {
    const doneDir = process.env.DONE_DIR;

    if (!fs.existsSync(doneDir)) {
      return res.json({ items: [] });
    }

    const items = fs.readdirSync(doneDir);
    const itemDetails = items
      .map((item) => {
        const itemPath = path.join(doneDir, item);
        const stats = fs.statSync(itemPath);

        if (stats.isDirectory()) {
          // For directories, calculate total size of all files inside
          let totalSize = 0;
          let fileCount = 0;

          const calculateDirSize = (dirPath) => {
            const dirItems = fs.readdirSync(dirPath);
            dirItems.forEach((subItem) => {
              const subItemPath = path.join(dirPath, subItem);
              const subStats = fs.statSync(subItemPath);
              if (subStats.isFile()) {
                totalSize += subStats.size;
                fileCount++;
              } else if (subStats.isDirectory()) {
                calculateDirSize(subItemPath);
              }
            });
          };

          calculateDirSize(itemPath);

          return {
            name: item,
            type: "folder",
            size: totalSize,
            fileCount: fileCount,
            createdAt: stats.birthtime,
            modifiedAt: stats.mtime,
          };
        } else {
          return {
            name: item,
            type: "file",
            size: stats.size,
            createdAt: stats.birthtime,
            modifiedAt: stats.mtime,
          };
        }
      })
      .sort((a, b) => b.createdAt - a.createdAt); // Sort by newest first

    res.json({ items: itemDetails });
  } catch (error) {
    console.error("Error reading content directory:", error);
    res.status(500).json({ error: "Failed to read content directory" });
  }
});

// Download a specific file or folder from done directory
app.get("/api/content/download/:filename", authenticateToken, (req, res) => {
  try {
    const filename = req.params.filename;
    const doneDir = process.env.DONE_DIR;
    const itemPath = path.join(doneDir, filename);

    // Security check: ensure the item is within the done directory
    const resolvedPath = path.resolve(itemPath);
    const resolvedDoneDir = path.resolve(doneDir);
    if (!resolvedPath.startsWith(resolvedDoneDir)) {
      return res.status(403).json({ error: "Access denied" });
    }

    if (!fs.existsSync(itemPath)) {
      return res.status(404).json({ error: "Item not found" });
    }

    const stats = fs.statSync(itemPath);

    if (stats.isFile()) {
      // Download single file
      res.download(itemPath, filename);
    } else if (stats.isDirectory()) {
      // Create ZIP archive for folder
      const archive = archiver("zip", {
        zlib: { level: 9 }, // Maximum compression
      });

      // Set response headers
      res.attachment(`${filename}.zip`);
      res.setHeader("Content-Type", "application/zip");
      res.setHeader("Access-Control-Expose-Headers", "Content-Disposition");

      // Pipe archive to response
      archive.pipe(res);

      // Add directory contents to archive
      archive.directory(itemPath, false);

      // Handle errors
      archive.on("error", (err) => {
        console.error("Archive error:", err);
        res.status(500).json({ error: "Failed to create archive" });
      });

      // Finalize the archive
      archive.finalize();
    } else {
      return res.status(400).json({ error: "Invalid item type" });
    }
  } catch (error) {
    console.error("Error downloading item:", error);
    res.status(500).json({ error: "Failed to download item" });
  }
});

// Delete a specific file or folder from done directory
app.delete("/api/content/delete/:filename", authenticateToken, (req, res) => {
  try {
    const filename = req.params.filename;
    const doneDir = process.env.DONE_DIR;
    const itemPath = path.join(doneDir, filename);

    // Security check: ensure the item is within the done directory
    const resolvedPath = path.resolve(itemPath);
    const resolvedDoneDir = path.resolve(doneDir);
    if (!resolvedPath.startsWith(resolvedDoneDir)) {
      return res.status(403).json({ error: "Access denied" });
    }

    if (!fs.existsSync(itemPath)) {
      return res.status(404).json({ error: "Item not found" });
    }

    const stats = fs.statSync(itemPath);

    if (stats.isFile()) {
      fs.unlinkSync(itemPath);
      console.log(`🗑️  Deleted file: ${filename}`);
    } else if (stats.isDirectory()) {
      fs.rmSync(itemPath, { recursive: true, force: true });
      console.log(`🗑️  Deleted folder: ${filename}`);
    }

    res.json({
      success: true,
      message: `"${filename}" deleted successfully`,
    });
  } catch (error) {
    console.error("Error deleting item:", error);
    res.status(500).json({ error: "Failed to delete item" });
  }
});

// This is in charge of running every single part of the process and update the global state
function startTransformationProcess(processId, bookTitle, language) {
  // pass the book title and voice as a func param
  const child = spawn("node", ["./src/process.web.mjs"], {
    stdio: ["pipe", "pipe", "pipe"],
    cwd: process.cwd(),
  });

  // Check if spawn was successful
  if (!child) {
    console.error("❌ Failed to spawn child process");
    return null;
  }

  // Get the process data from the Map
  const processData = activeProcesses.get(processId);
  if (!processData) {
    console.error("❌ Process data not found for ID:", processId);
    return null;
  }

  let currentStep = 0;
  const stepKeywords = [
    "Step 1",
    "Step 2",
    "Step 3",
    "Step 4",
    "Step 5",
    "Step 6",
    "Step 7",
  ];

  // Calculate total steps (skip Step 4 if no translation)
  const totalSteps = language ? 7 : 6;

  child.stdout.on("data", (data) => {
    const output = data.toString();

    console.log(output);

    const lines = output.split("\n").filter((line) => line.trim());

    lines.forEach((line) => {
      // Try to parse JSON messages for sub-step progress
      if (line.trim().startsWith("{") && line.trim().endsWith("}")) {
        try {
          const jsonMessage = JSON.parse(line);

          // Update sub-step progress if message contains the right structure
          if (jsonMessage.type === "STEP_PROGRESS") {
            processData.state.currentStepProcess = {
              totalItems: jsonMessage.totalItems || 0,
              currentItem: jsonMessage.currentItem || 0,
            };

            // Also update legacy state
            transformationState.currentStepProcess = {
              totalItems: jsonMessage.totalItems || 0,
              currentItem: jsonMessage.currentItem || 0,
            };
          }
        } catch (e) {
          // Not a valid JSON, continue with normal processing
        }
      }

      // Check for step progression
      stepKeywords.forEach((keyword, index) => {
        if (line.includes(keyword)) {
          currentStep = index;
          processData.state.currentStep = currentStep;
          processData.state.progress = (currentStep / totalSteps) * 100;

          // Also update legacy state
          transformationState.currentStep = currentStep;
          transformationState.progress = (currentStep / totalSteps) * 100;

          // Reset sub-step progress when moving to a new step
          processData.state.currentStepProcess = {
            totalItems: 0,
            currentItem: 0,
          };
          transformationState.currentStepProcess = {
            totalItems: 0,
            currentItem: 0,
          };
        }
      });
    });
  });

  // if the spawn process fails, then alert the console
  child.stderr.on("data", (data) => {
    const error = data.toString();
    console.error(error);

    // Try to parse JSON error messages
    try {
      const lines = error.split("\n").filter((line) => line.trim());
      lines.forEach((line) => {
        try {
          const parsed = JSON.parse(line);
          if (parsed.type === "ERROR") {
            processData.state.error = parsed.message;
            processData.state.messages.push({
              text: parsed.message,
              type: "error",
            });

            // Also update legacy state
            transformationState.error = parsed.message;
            transformationState.messages.push({
              text: parsed.message,
              type: "error",
            });
          }
        } catch (e) {
          // Not JSON, just log it
        }
      });
    } catch (e) {
      // Ignore parsing errors
    }
  });

  // another potential for failure
  child.on("error", (error) => {
    console.error("❌ Spawn error:", error);
    processData.state.isRunning = false;
    processData.state.error = `Spawn error: ${error.message}`;

    // Also update legacy state
    transformationState.isRunning = false;
    transformationState.error = `Spawn error: ${error.message}`;
  });

  // on closing alert too.
  child.on("close", async (code) => {
    processData.state.isRunning = false;
    transformationState.isRunning = false;

    if (code === 0) {
      processData.state.completed = true;
      processData.state.progress = 100;
      processData.state.currentStep = totalSteps;
      processData.state.messages.push({
        text: "🎉 Transformation completed successfully!",
        type: "success",
      });

      // Also update legacy state
      transformationState.completed = true;
      transformationState.progress = 100;
      transformationState.currentStep = totalSteps;
      transformationState.messages.push({
        text: "🎉 Transformation completed successfully!",
        type: "success",
      });

      console.log(`✅ Process ${processId} completed successfully`);

      // Send success email notification
      await sendCompletionEmail(
        processData.bookTitle,
        processData.state.outputPath,
        true,
        null,
      );
    } else {
      const errorMessage = `Process exited with code ${code}`;
      processData.state.error = errorMessage;
      processData.state.messages.push({
        text: `❌ Process failed with exit code ${code}`,
        type: "error",
      });

      // Also update legacy state
      transformationState.error = errorMessage;
      transformationState.messages.push({
        text: `❌ Process failed with exit code ${code}`,
        type: "error",
      });

      console.log(`❌ Process ${processId} failed with code ${code}`);

      // Send failure email notification
      await sendCompletionEmail(
        processData.bookTitle,
        null,
        false,
        errorMessage,
      );
    }
  });

  return child;
}

// This function handles transformation from pasted text (skips OCR and amalgamation)
function startTransformationProcessFromText(processId, bookTitle, language) {
  // Use a different process file that skips steps 1 and 2
  const child = spawn("node", ["./src/process.text.mjs"], {
    stdio: ["pipe", "pipe", "pipe"],
    cwd: process.cwd(),
  });

  // Check if spawn was successful
  if (!child) {
    console.error("❌ Failed to spawn child process");
    return null;
  }

  // Get the process data from the Map
  const processData = activeProcesses.get(processId);
  if (!processData) {
    console.error("❌ Process data not found for ID:", processId);
    return null;
  }

  let currentStep = 0;
  // Skip steps 1 and 2, start from step 3
  const stepKeywords = ["Step 3", "Step 4", "Step 5", "Step 6", "Step 7"];

  // Calculate total steps (5 steps instead of 7, or 4 if no translation)
  const totalSteps = language ? 5 : 4;

  child.stdout.on("data", (data) => {
    const output = data.toString();
    console.log(output);
    const lines = output.split("\n").filter((line) => line.trim());

    lines.forEach((line) => {
      if (line.trim().startsWith("{") && line.trim().endsWith("}")) {
        try {
          const jsonMessage = JSON.parse(line);
          if (jsonMessage.type === "STEP_PROGRESS") {
            processData.state.currentStepProcess = {
              totalItems: jsonMessage.totalItems || 0,
              currentItem: jsonMessage.currentItem || 0,
            };
            transformationState.currentStepProcess = {
              totalItems: jsonMessage.totalItems || 0,
              currentItem: jsonMessage.currentItem || 0,
            };
          }
        } catch (e) {
          // Not a valid JSON
        }
      }

      stepKeywords.forEach((keyword, index) => {
        if (line.includes(keyword)) {
          currentStep = index;
          processData.state.currentStep = currentStep + 2;
          processData.state.progress = (currentStep / totalSteps) * 100;
          processData.state.currentStepProcess = {
            totalItems: 0,
            currentItem: 0,
          };

          transformationState.currentStep = currentStep + 2;
          transformationState.progress = (currentStep / totalSteps) * 100;
          transformationState.currentStepProcess = {
            totalItems: 0,
            currentItem: 0,
          };
        }
      });
    });
  });

  child.stderr.on("data", (data) => {
    const error = data.toString();
    console.error(error);
    try {
      const lines = error.split("\n").filter((line) => line.trim());
      lines.forEach((line) => {
        try {
          const parsed = JSON.parse(line);
          if (parsed.type === "ERROR") {
            processData.state.error = parsed.message;
            processData.state.messages.push({
              text: parsed.message,
              type: "error",
            });
            transformationState.error = parsed.message;
            transformationState.messages.push({
              text: parsed.message,
              type: "error",
            });
          }
        } catch (e) {
          // Not JSON
        }
      });
    } catch (e) {
      // Ignore
    }
  });

  child.on("error", (error) => {
    console.error("❌ Spawn error:", error);
    processData.state.isRunning = false;
    processData.state.error = `Spawn error: ${error.message}`;
    transformationState.isRunning = false;
    transformationState.error = `Spawn error: ${error.message}`;
  });

  child.on("close", async (code) => {
    processData.state.isRunning = false;
    transformationState.isRunning = false;

    if (code === 0) {
      processData.state.completed = true;
      processData.state.progress = 100;
      processData.state.currentStep = totalSteps + 2;
      processData.state.messages.push({
        text: "🎉 Transformation completed successfully!",
        type: "success",
      });

      transformationState.completed = true;
      transformationState.progress = 100;
      transformationState.currentStep = totalSteps + 2;
      transformationState.messages.push({
        text: "🎉 Transformation completed successfully!",
        type: "success",
      });

      console.log(`✅ Process ${processId} completed successfully`);
      await sendCompletionEmail(
        processData.bookTitle,
        processData.state.outputPath,
        true,
        null,
      );
    } else {
      const errorMessage = `Process exited with code ${code}`;
      processData.state.error = errorMessage;
      processData.state.messages.push({
        text: `❌ Process failed with exit code ${code}`,
        type: "error",
      });

      transformationState.error = errorMessage;
      transformationState.messages.push({
        text: `❌ Process failed with exit code ${code}`,
        type: "error",
      });

      console.log(`❌ Process ${processId} failed with code ${code}`);
      await sendCompletionEmail(
        processData.bookTitle,
        null,
        false,
        errorMessage,
      );
    }
  });

  return child;
}

// Start server
app.listen(PORT, () => {
  console.log(
    `🚀 Audiobook Converter Server running on http://localhost:${PORT}`,
  );
});
