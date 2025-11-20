import fs from "fs";
import path from "path";
import dotenv from "dotenv";

dotenv.config();

/**
 * Transfer the completed MP3 file to the destination path
 * Only runs in production mode (when NODE_ENV=production)
 * @param {string} bookTitle - The sanitized book title
 * @param {string} language - Optional language suffix
 */
export async function transferFile(bookTitle, language) {
  return new Promise((resolve, reject) => {
    try {
      // Check if we're in production mode
      const isProduction = process.env.NODE_ENV === "production";
      
      if (!isProduction) {
        console.log(" ℹ️  Skipping file transfer (not in production mode)");
        resolve();
        return;
      }

      // Get the transfer destination path from environment
      const transferPath = process.env.TRANSFER_TO_PATH;
      
      if (!transferPath) {
        console.log(" ⚠️  TRANSFER_TO_PATH not set, skipping file transfer");
        resolve();
        return;
      }

      // Sanitize book title and append language if provided
      let sanitizedTitle = bookTitle
        .replace(/[^a-zA-Z0-9]+/g, "_")
        .replace(/^_+|_+$/g, "");

      // Only append language if it's a valid non-empty string
      if (language && typeof language === "string" && language.trim() !== "") {
        sanitizedTitle += `_${language}`;
      }

      // Source file path (in DONE_DIR)
      const doneDir = process.env.DONE_DIR;
      const sourceDir = path.join(doneDir, sanitizedTitle);
      const sourceFile = path.join(sourceDir, `${sanitizedTitle}.mp3`);

      // Check if source file exists
      if (!fs.existsSync(sourceFile)) {
        console.log(` ❌ Source file not found: ${sourceFile}`);
        reject(new Error(`Source file not found: ${sourceFile}`));
        return;
      }

      // Ensure destination directory exists
      if (!fs.existsSync(transferPath)) {
        console.log(` - Creating destination directory: ${transferPath}`);
        fs.mkdirSync(transferPath, { recursive: true });
      }

      // Destination file path
      const destFile = path.join(transferPath, `${sanitizedTitle}.mp3`);

      console.log(` - Transferring file to: ${destFile}`);

      // Send initial progress message
      console.log(
        JSON.stringify({
          type: "STEP_PROGRESS",
          totalItems: 1,
          currentItem: 0,
        })
      );

      // Copy the file to the destination
      fs.copyFileSync(sourceFile, destFile);

      // Send completion progress message
      console.log(
        JSON.stringify({
          type: "STEP_PROGRESS",
          totalItems: 1,
          currentItem: 1,
        })
      );

      console.log(` ✔ File transferred successfully to: ${destFile}`);
      resolve();
    } catch (error) {
      console.log(` ❌ Error transferring file: ${error.message}`);
      reject(error);
    }
  });
}

