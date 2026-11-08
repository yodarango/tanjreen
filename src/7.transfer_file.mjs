import { triggerAudiobookshelfScan } from "./utils/audiobookshelf.mjs";
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
  // Only run in production mode
  if (process.env.NODE_ENV !== "production") {
    console.log(" ℹ️  Skipping file transfer (not in production mode)");
    console.log(
      JSON.stringify({
        type: "INFO",
        message: "File transfer skipped (not in production mode)",
      })
    );
    return;
  }

  // Get the transfer destination path from environment
  const transferPath = process.env.TRANSFER_TO_PATH;

  if (!transferPath) {
    console.log(" ⚠️  TRANSFER_TO_PATH not set, skipping file transfer");
    console.log(
      JSON.stringify({
        type: "INFO",
        message: "File transfer skipped (TRANSFER_TO_PATH not configured)",
      })
    );
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
    const errorMsg = `Source file not found: ${sourceFile}`;
    console.log(` ❌ ${errorMsg}`);
    console.error(
      JSON.stringify({
        type: "ERROR",
        message: `File transfer failed: ${errorMsg}`,
      })
    );
    throw new Error(errorMsg);
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

  // Copy the file to the destination (a failure here is fatal for the step)
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
  console.log(
    JSON.stringify({
      type: "INFO",
      message: `✓ File successfully transferred to: ${destFile}`,
    })
  );

  // Trigger an Audiobookshelf library scan so the new book gets an entry
  // right away. A scan failure is NOT fatal: the file is already in the
  // library folder and can be scanned manually from the Audiobookshelf UI.
  try {
    await triggerAudiobookshelfScan();
  } catch (scanError) {
    console.log(` ⚠️  Audiobookshelf scan failed: ${scanError.message}`);
    console.log(
      JSON.stringify({
        type: "INFO",
        message: `Audiobookshelf scan failed: ${scanError.message}`,
      })
    );
  }
}
