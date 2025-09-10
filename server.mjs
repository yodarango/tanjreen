import express from "express";
import fs from "fs";
import path from "path";
import { spawn } from "child_process";
import dotenv from "dotenv";

// Load environment variables
dotenv.config();

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
    const { bookTitle, voice } = req.body;

    if (transformationState.isRunning) {
      return res
        .status(400)
        .json({ error: "Transformation already in progress" });
    }

    if (!bookTitle || !voice) {
      return res
        .status(400)
        .json({ error: "Book title and voice are required" });
    }

    // Tell the state we are starting to run
    transformationState = {
      completed: false,
      outputPath: null,
      isRunning: true,
      messages: [],
      currentStep: 0,
      progress: 0,
      error: null,
    };

    // Start the transformation process
    startTransformationProcess(bookTitle, voice);

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
function startTransformationProcess(bookTitle, voice) {
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
      const sanitizedTitle = bookTitle.toLowerCase().replace(/[^a-z0-9]/g, "_");
      transformationState.outputPath = `./audio/${sanitizedTitle}/complete.mp3`;

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
