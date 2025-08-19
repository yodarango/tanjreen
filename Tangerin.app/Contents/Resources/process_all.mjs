import { spawn } from "child_process";
import fs from "fs";
import dotenv from "dotenv";

// Load environment variables
dotenv.config();

/**
 * Execute a Node.js script and return a promise
 */
function executeScript(scriptName, description) {
  return new Promise((resolve, reject) => {
    console.log(`🚀 Starting: ${description}`);

    const child = spawn("node", [scriptName], {
      stdio: ["pipe", "pipe", "pipe"],
      cwd: process.cwd(),
    });

    child.stdout.on("data", (data) => {
      const output = data.toString().trim();
      if (output) {
        console.log(output);
      }
    });

    child.stderr.on("data", (data) => {
      const error = data.toString().trim();
      if (error) {
        console.error(error);
      }
    });

    child.on("close", (code) => {
      if (code === 0) {
        console.log(`✅ Completed: ${description}`);
        resolve();
      } else {
        console.error(`❌ Failed: ${description} (exit code ${code})`);
        reject(new Error(`${description} failed with exit code ${code}`));
      }
    });
  });
}

/**
 * Check if a file exists
 */
function fileExists(filePath) {
  try {
    return fs.existsSync(filePath);
  } catch (error) {
    return false;
  }
}

/**
 * Concatenate audio files using ffmpeg
 */
async function concatenateAudioFiles() {
  return new Promise((resolve) => {
    console.log("🎵 Starting audio concatenation...");

    // Check if concat.sh exists
    if (!fileExists("concat.sh")) {
      console.log("⚠️ concat.sh script not found, skipping concatenation...");
      resolve();
      return;
    }

    console.log("🔧 Running concat.sh script...");

    const concatProcess = spawn("bash", ["concat.sh"], {
      stdio: ["pipe", "pipe", "pipe"],
      cwd: process.cwd(),
    });

    concatProcess.stdout.on("data", (data) => {
      const output = data.toString().trim();
      if (output) {
        console.log(output);
      }
    });

    concatProcess.stderr.on("data", (data) => {
      const output = data.toString().trim();
      if (output) {
        console.error(output);
      }
    });

    concatProcess.on("close", (code) => {
      if (code === 0) {
        console.log("✅ Audio concatenation completed successfully");
      } else {
        console.log(`⚠️ concat.sh exited with code ${code}, but continuing...`);
      }
      resolve(); // Don't fail the whole process for concatenation issues
    });

    concatProcess.on("error", (error) => {
      console.log(`⚠️ concat.sh error: ${error.message}`);
      resolve(); // Don't fail the whole process
    });
  });
}

/**
 * Main processing pipeline
 */
async function processAll() {
  try {
    console.log("🍊 Tangerin - Complete Processing Pipeline");
    console.log("==========================================");
    console.log("");

    // Step 1: OCR Processing
    console.log("📖 Step 1: Processing images with OCR...");
    if (fileExists("ocr_processor.mjs")) {
      await executeScript("ocr_processor.mjs", "OCR Processing");
    } else {
      console.log("⚠️ OCR processor not found, skipping...");
    }
    console.log("");

    // Step 2: Text Combination
    console.log("📚 Step 2: Combining text files...");
    if (fileExists("amalgamate_text_files.mjs")) {
      await executeScript("amalgamate_text_files.mjs", "Text Combination");
    } else {
      console.log("⚠️ Text combiner not found, skipping...");
    }
    console.log("");

    // Step 3: AI Text Cleaning
    console.log("🧹 Step 3: Cleaning text with OpenAI...");
    if (fileExists("text_cleaner.mjs")) {
      await executeScript("text_cleaner.mjs", "AI Text Cleaning");
    } else {
      console.log("⚠️ Text cleaner not found, skipping...");
    }
    console.log("");

    // Step 4: Text-to-Speech
    console.log("🎤 Step 4: Converting text to speech...");
    if (fileExists("main.mjs")) {
      await executeScript("main.mjs", "Text-to-Speech Conversion");
    } else if (fileExists("process_tts.mjs")) {
      await executeScript("process_tts.mjs", "Text-to-Speech Conversion");
    } else {
      console.log("⚠️ TTS processor not found, skipping...");
    }
    console.log("");

    // Step 5: Audio Concatenation
    console.log("🎵 Step 5: Concatenating audio files...");
    await concatenateAudioFiles();
    console.log("");

    // Final success message
    console.log("🎉 Complete pipeline finished successfully!");
    console.log("");

    // Show output information
    const bookTitle = process.env.BOOK_TITLE || "audiobook";
    const sanitizedTitle = bookTitle.toLowerCase().replace(/[^a-z0-9]/g, "_");
    const audioDir = `./audio/${sanitizedTitle}`;

    if (fs.existsSync(audioDir)) {
      console.log(`📁 Output directory: ${audioDir}`);

      const files = fs.readdirSync(audioDir);
      const audioFiles = files.filter((f) => f.endsWith(".mp3"));

      if (audioFiles.length > 0) {
        console.log(`🎧 Generated ${audioFiles.length} audio files`);

        // Check for complete.mp3
        if (files.includes("complete.mp3")) {
          console.log(`🎵 Complete audiobook: ${audioDir}/complete.mp3`);
        }
      }
    }

    console.log("");
    console.log("🍊 Tangerin processing complete! Your audiobook is ready.");
  } catch (error) {
    console.error("❌ Pipeline failed:", error.message);
    process.exit(1);
  }
}

// Run the pipeline
processAll();
