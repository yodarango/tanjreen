import { spawn } from "child_process";
import fs from "fs";
import dotenv from "dotenv";

// Load environment variables
dotenv.config();

/**
 * Concatenate audio files using the existing concat.sh script
 */
async function concatenateAudioFiles() {
  return new Promise((resolve, reject) => {
    console.log("🎵 Starting audio concatenation...");

    // Check if concat.sh exists
    if (!fs.existsSync("concat.sh")) {
      console.log("⚠️ concat.sh script not found");
      reject(new Error("concat.sh script not found"));
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

        // Try to show info about the output file
        const bookTitle = process.env.BOOK_TITLE || "audiobook";
        const sanitizedTitle = bookTitle
          .toLowerCase()
          .replace(/[^a-z0-9]/g, "_");
        const outputFile = `./audio/${sanitizedTitle}/complete.mp3`;

        if (fs.existsSync(outputFile)) {
          console.log(`🎧 Complete audiobook: ${outputFile}`);

          try {
            const stats = fs.statSync(outputFile);
            const fileSizeMB = (stats.size / (1024 * 1024)).toFixed(2);
            console.log(`📊 File size: ${fileSizeMB} MB`);
          } catch (error) {
            // Ignore file size error
          }
        }

        resolve();
      } else {
        console.log(`⚠️ concat.sh exited with code ${code}`);
        reject(new Error(`concat.sh failed with exit code ${code}`));
      }
    });

    concatProcess.on("error", (error) => {
      console.log(`⚠️ concat.sh error: ${error.message}`);
      reject(error);
    });
  });
}

// Run concatenation if this script is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  concatenateAudioFiles()
    .then(() => {
      console.log("🎉 Concatenation completed successfully!");
    })
    .catch((error) => {
      console.error("❌ Concatenation failed:", error.message);
      process.exit(1);
    });
}

export { concatenateAudioFiles };
