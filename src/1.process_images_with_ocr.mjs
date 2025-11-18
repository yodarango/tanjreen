import tesseract from "node-tesseract-ocr";
import heicConvert from "heic-convert";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";
import { createRequire } from "module";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const require = createRequire(import.meta.url);

// Import pdf-parse using require (CommonJS module)
const pdfParse = require("pdf-parse");

/* ****************************************************************************
 * Convert HEIC file to JPEG format
 * ****************************************************************************
 */
async function convertHeicToJpeg(heicPath, outputPath) {
  try {
    const inputBuffer = fs.readFileSync(heicPath);
    const outputBuffer = await heicConvert({
      buffer: inputBuffer,
      format: "JPEG",
      quality: 0.9,
    });

    fs.writeFileSync(outputPath, outputBuffer);
    return outputPath;
  } catch (error) {
    throw new Error(` ❌ Failed to convert HEIC file: ${error.message}`);
  }
}

/* ****************************************************************************
 * Extract text from PDF file using pdf-parse
 * ****************************************************************************
 */
async function extractTextFromPDF(pdfPath) {
  try {
    const dataBuffer = fs.readFileSync(pdfPath);
    const data = await pdfParse(dataBuffer);
    return data.text.trim();
  } catch (error) {
    throw new Error(` ❌ Failed to extract text from PDF: ${error.message}`);
  }
}

/* ****************************************************************************
 * Process all images in the /images directory and extract text using OCR. It
 * saves the results as numbered text files in the /text directory. One text
 * file per image.
 * ****************************************************************************
 */
async function processImagesWithOCR(bookTitle) {
  // where can I get the images from ?
  const imagesDir = process.env.PENDING_DIR;

  // Where do I need to write the text from the images to?
  // Write directly to WORKING_DIR/text/
  const outputDir = path.join(process.env.WORKING_DIR, "text");

  try {
    // Ensure the images dir  exist
    if (!fs.existsSync(imagesDir)) {
      console.error(` ❌ Images directory does not exist: ${imagesDir}`);
      return;
    }

    // Now ensure the output dir exists or create it if not
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
      console.log(` - Created text directory: ${outputDir}`);
    }

    // Read all files from images directory
    const files = fs.readdirSync(imagesDir);

    // Filter for image and PDF files
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

    if (processableFiles.length === 0) {
      console.log(` ❌ No image or PDF files found in ${imagesDir} directory`);
      return;
    }

    console.log(` - Found ${processableFiles.length} files to process`);

    // Send initial progress message
    console.log(
      JSON.stringify({
        type: "STEP_PROGRESS",
        totalItems: processableFiles.length,
        currentItem: 0,
      })
    );

    // Sort files to ensure consistent ordering
    processableFiles.sort();

    // Process each file
    for (let i = 0; i < processableFiles.length; i++) {
      const file = processableFiles[i];
      const filePath = path.join(imagesDir, file);
      const outputFileName = `${i + 1}.txt`;
      const outputPath = path.join(outputDir, outputFileName);
      const ext = path.extname(file).toLowerCase();

      console.log(
        `   - Processing file ${i + 1}/${processableFiles.length}: ${file}`
      );

      // Send progress update
      console.log(
        JSON.stringify({
          type: "STEP_PROGRESS",
          totalItems: processableFiles.length,
          currentItem: i + 1,
        })
      );

      try {
        let extractedText = "";

        // Handle PDF files
        if (ext === ".pdf") {
          console.log(`   - Extracting text from PDF: ${file}`);
          extractedText = await extractTextFromPDF(filePath);
          console.log(` ✔ PDF text extraction completed`);
        } else {
          // Handle image files
          let processPath = filePath;
          let tempJpegPath = null;

          // Check if file is HEIC/HEIF and convert to JPEG
          if (ext === ".heic" || ext === ".heif") {
            console.log(`   - Converting HEIC file to JPEG: ${file}`);
            tempJpegPath = path.join(imagesDir, `temp_${i + 1}.jpg`);
            processPath = await convertHeicToJpeg(filePath, tempJpegPath);
            console.log(` ✔ HEIC conversion completed`);
          }

          // Configure Tesseract options
          const config = {
            lang: process.env.TEXT_LANG,
            oem: 1, // OCR Engine Mode
            psm: 3, // Page Segmentation Mode
          };

          // Perform OCR
          extractedText = await tesseract.recognize(processPath, config);

          // Clean up temporary JPEG file if it was created
          if (tempJpegPath && fs.existsSync(tempJpegPath)) {
            fs.unlinkSync(tempJpegPath);
            console.log(` ✔ Cleaned up temporary file`);
          }
        }

        // Clean up the text (remove extra whitespace)
        const cleanedText = extractedText.trim().replace(/\n\s*\n/g, "\n\n");

        // Save to text file
        fs.writeFileSync(outputPath, cleanedText, "utf8");

        console.log(` ✔ Saved text to: ${outputFileName}`);
      } catch (error) {
        console.error(` ❌ Error processing ${file}:`, error.message);

        // Create an error file to maintain sequence
        const errorMessage = `  ❌ Error processing file: ${error.message}`;
        fs.writeFileSync(outputPath, errorMessage, "utf8");
      }
    }
  } catch (error) {
    console.error("❌ Fatal error during OCR processing:", error.message);
  }
}

export { processImagesWithOCR };
