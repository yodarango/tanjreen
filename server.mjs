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
  progress: 0,
  currentStep: 0,
  messages: [],
  completed: false,
  error: null,
  outputPath: null,
};

// API Routes

// Get list of images in the images directory
app.get("/api/images", (req, res) => {
  try {
    const imagesDir = "./images";

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

// Serve voice samples from voices folder
app.get("/api/voice-sample/:voice", (req, res) => {
  try {
    const voice = req.params.voice;
    const samplePath = path.join("./voices", `sample-${voice}.mp3`);

    // Check if the voice sample file exists
    if (!fs.existsSync(samplePath)) {
      return res
        .status(404)
        .json({ error: `Voice sample not found for: ${voice}` });
    }

    // Set appropriate headers for audio streaming
    res.set({
      "Content-Type": "audio/mpeg",
      "Accept-Ranges": "bytes",
      "Cache-Control": "public, max-age=3600", // Cache for 1 hour
    });

    // Stream the audio file
    const audioStream = fs.createReadStream(samplePath);
    audioStream.pipe(res);

    audioStream.on("error", (error) => {
      console.error("Error streaming voice sample:", error);
      if (!res.headersSent) {
        res.status(500).json({ error: "Failed to stream voice sample" });
      }
    });
  } catch (error) {
    console.error("Error serving voice sample:", error);
    res.status(500).json({ error: "Failed to serve voice sample" });
  }
});

// Start transformation process
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

    // Reset state
    transformationState = {
      isRunning: true,
      progress: 0,
      currentStep: 0,
      messages: [],
      completed: false,
      error: null,
      outputPath: null,
    };

    // Update environment variables
    updateEnvFile(bookTitle, voice);

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

// Helper function to update .env file
function updateEnvFile(bookTitle, voice) {
  try {
    let envContent = fs.readFileSync(".env", "utf8");

    // Update or add BOOK_TITLE
    if (envContent.includes("BOOK_TITLE=")) {
      envContent = envContent.replace(
        /BOOK_TITLE=.*/,
        `BOOK_TITLE="${bookTitle}"`
      );
    } else {
      envContent += `\nBOOK_TITLE="${bookTitle}"`;
    }

    // Update or add VOICE
    if (envContent.includes("VOICE=")) {
      envContent = envContent.replace(/VOICE=.*/, `VOICE=${voice}`);
    } else {
      envContent += `\nVOICE=${voice}`;
    }

    fs.writeFileSync(".env", envContent);

    // Reload environment variables
    dotenv.config();
  } catch (error) {
    console.error("Error updating .env file:", error);
  }
}

// Function to start the transformation process
function startTransformationProcess() {
  const child = spawn("node", ["Tangerin.app/Contents/Resources/main.mjs"], {
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
    console.log(output); // Forward to console
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

      // Add message to state
      if (line.trim()) {
        transformationState.messages.push({
          text: line.trim(),
          type: getMessageType(line),
        });
      }
    });
  });

  child.stderr.on("data", (data) => {
    const error = data.toString();
    console.error(error); // Forward to console
    transformationState.messages.push({
      text: error.trim(),
      type: "error",
    });
  });

  child.on("error", (error) => {
    console.error("❌ Spawn error:", error);
    transformationState.isRunning = false;
    transformationState.error = `Spawn error: ${error.message}`;
    transformationState.messages.push({
      text: `❌ Failed to start process: ${error.message}`,
      type: "error",
    });
  });

  child.on("close", (code) => {
    transformationState.isRunning = false;

    if (code === 0) {
      transformationState.completed = true;
      transformationState.progress = 100;
      transformationState.currentStep = stepKeywords.length;

      // Set output path
      const bookTitle = process.env.BOOK_TITLE || "audiobook";
      const sanitizedTitle = bookTitle.toLowerCase().replace(/[^a-z0-9]/g, "_");
      transformationState.outputPath = `./audio/${sanitizedTitle}/complete.mp3`;

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

// Helper function to determine message type based on content
function getMessageType(message) {
  if (
    message.includes("❌") ||
    message.includes("Error") ||
    message.includes("error")
  ) {
    return "error";
  } else if (
    message.includes("⚠️") ||
    message.includes("Warning") ||
    message.includes("Skipping")
  ) {
    return "warning";
  } else if (
    message.includes("✅") ||
    message.includes("🎉") ||
    message.includes("completed")
  ) {
    return "success";
  } else {
    return "info";
  }
}

// Start server
app.listen(PORT, () => {
  console.log(
    `🚀 Audiobook Converter Server running on http://localhost:${PORT}`
  );
  console.log(`📁 Serving interface from ./public/`);
  console.log(`🔧 Make sure your images are in ./images/ directory`);
});
