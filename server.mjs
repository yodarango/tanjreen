import { validateTransformationRequest } from "./src/utils/validate.mjs";
import { spawn } from "child_process";
import express from "express";
import multer from "multer";
import dotenv from "dotenv";
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
const PORT = process.env.PORT || 3000;

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
      path.extname(file.originalname).toLowerCase()
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
app.use(express.static("public"));

// Global state for tracking progress
let transformationState = {
  isRunning: false,
  completed: false,
  outputPath: null,
  messages: [],
  currentStep: 0,
  progress: 0,
  error: null,
};

// API Routes

// Get list of images and PDFs in the pending directory so we can show them to the user
app.get("/api/images", (req, res) => {
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
app.post("/api/clear-pending", (req, res) => {
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
app.post("/api/upload-images", upload.array("images"), (req, res) => {
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
});

// Once the user click start transformation, this will be ran
app.post("/api/start-transformation", async (req, res) => {
  try {
    const { bookTitle, voice, language } = req.body;

    if (transformationState.isRunning) {
      return res
        .status(400)
        .json({ error: "Transformation already in progress" });
    }

    // Validate the request parameters
    const validation = validateTransformationRequest(
      bookTitle,
      voice,
      language
    );

    if (!validation.isValid) {
      return res.status(400).json({
        error: "Validation failed",
        details: validation.errors,
        availableVoices: validation.availableVoices,
        availableLanguages: validation.availableLanguages,
      });
    }

    // Tell the state we are starting to run
    transformationState = {
      completed: false,
      isRunning: true,
      messages: [],
      currentStep: 0,
      progress: 0,
      error: null,
    };

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
      JSON.stringify(tempData, null, 2)
    );

    // Start the transformation process
    startTransformationProcess(language);

    res.json({ success: true, message: "Transformation started" });
  } catch (error) {
    console.error("Error starting transformation:", error);
    res.status(500).json({ error: "Failed to start transformation" });
  }
});

// Get transformation progress
app.get("/api/progress", (req, res) => {
  res.json(transformationState);
});

// This is in charge of running every single part of the process and update the global state
function startTransformationProcess(language) {
  // pass the book title and voice as a func param
  const child = spawn("node", ["./src/process.web.mjs"], {
    stdio: ["pipe", "pipe", "pipe"],
    cwd: process.cwd(),
  });

  // Check if spawn was successful
  if (!child) {
    console.error("❌ Failed to spawn child process");
    return;
  }

  let currentStep = 0;
  const stepKeywords = [
    "Step 1",
    "Step 2",
    "Step 3",
    "Step 4",
    "Step 5",
    "Step 6",
  ];

  // Remove Step 4 (translation) if no language specified
  if (!language) {
    stepKeywords.splice(3, 1); // Remove "Step 4"
  }

  child.stdout.on("data", (data) => {
    const output = data.toString();

    console.log(output);

    const lines = output.split("\n").filter((line) => line.trim());

    lines.forEach((line) => {
      // Check for step progression
      stepKeywords.forEach((keyword, index) => {
        if (line.includes(keyword)) {
          currentStep = index;
          transformationState.currentStep = currentStep;
          transformationState.progress =
            (currentStep / stepKeywords.length) * 100;
        }
      });
    });
  });

  // if the spawn process fails, then alert the console
  child.stderr.on("data", (data) => {
    const error = data.toString();
    console.error(error);
  });

  // another potential for failure
  child.on("error", (error) => {
    console.error("❌ Spawn error:", error);
    transformationState.isRunning = false;
    transformationState.error = `Spawn error: ${error.message}`;
  });

  // on closing alert too.
  child.on("close", (code) => {
    transformationState.isRunning = false;

    if (code === 0) {
      transformationState.completed = true;
      transformationState.progress = 100;
      transformationState.currentStep = stepKeywords.length;

      console.log(transformationState);
      transformationState.messages.push({
        text: "🎉 Transformation completed successfully!",
        type: "success",
      });
    } else {
      transformationState.error = `Process exited with code ${code}`;
      transformationState.messages.push({
        text: `❌ Process failed with exit code ${code}`,
        type: "error",
      });
    }
  });
}

// Start server
app.listen(PORT, () => {
  console.log(
    `🚀 Audiobook Converter Server running on http://localhost:${PORT}`
  );
});
