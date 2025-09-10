import express from "express";
import fs from "fs";
import path from "path";
import { spawn } from "child_process";
import { validateTransformationRequest } from "./server/validate.mjs";
import dotenv from "dotenv";

// Load environment variables
dotenv.config();

/**
 * Clean and recreate the working directory to avoid old files from previous runs
 * @param {string} workingDir - The path to the working directory to clean
 */
async function cleanWorkingDirectory(workingDir) {
  console.log("🧹 Cleaning working directory:", workingDir);

  try {
    // Remove all files in the working directory
    if (fs.existsSync(workingDir)) {
      const files = fs.readdirSync(workingDir);
      for (const file of files) {
        const filePath = path.join(workingDir, file);
        if (fs.statSync(filePath).isFile()) {
          fs.unlinkSync(filePath);
          console.log(`🗑️ Removed old file: ${file}`);
        }
      }
    } else {
      // Create the directory if it doesn't exist
      fs.mkdirSync(workingDir, { recursive: true });
      console.log("📁 Created working directory:", workingDir);
    }
    console.log("✅ Working directory cleaned successfully");
  } catch (error) {
    console.error("❌ Error cleaning working directory:", error.message);
    throw error;
  }
}

const app = express();
const PORT = process.env.PORT || 3000;

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

// Get list of images in the images directory so we can show them to the user
app.get("/api/images", (req, res) => {
  try {
    const imagesDir = process.env.PENDING_DIR || "./server/content/1.pending";

    if (!fs.existsSync(imagesDir)) {
      return res.json([]);
    }

    const files = fs.readdirSync(imagesDir);
    const imageFiles = files.filter((file) => {
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
      ].includes(ext);
    });

    res.json(imageFiles.sort());
  } catch (error) {
    console.error("Error reading images directory:", error);
    res.status(500).json({ error: "Failed to read images directory" });
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
    startTransformationProcess();

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

// Get available voices
app.get("/api/voices", (req, res) => {
  try {
    const validation = validateTransformationRequest("dummy", "dummy");
    res.json({
      voices: validation.availableVoices,
      count: validation.availableVoices.length,
    });
  } catch (error) {
    console.error("Error getting voices:", error);
    res.status(500).json({ error: "Failed to get available voices" });
  }
});

// Get available languages
app.get("/api/languages", (req, res) => {
  try {
    const validation = validateTransformationRequest("dummy", "dummy");
    res.json({
      languages: validation.availableLanguages,
      count: validation.availableLanguages.length,
    });
  } catch (error) {
    console.error("Error getting languages:", error);
    res.status(500).json({ error: "Failed to get available languages" });
  }
});

// This is in charge of running every single part of the process and update the global state
function startTransformationProcess() {
  // pass the book title and voice as a func param
  const child = spawn("node", ["./server/process.web.mjs"], {
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
    "Processing images with OCR",
    "Combining text files",
    "Cleaning text with OpenAI",
    "Converting text to speech",
    "Complete pipeline finished",
  ];

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
