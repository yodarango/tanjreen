import tesseract from "node-tesseract-ocr";
import heicConvert from "heic-convert";
import path from "path";
import fs from "fs";

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

    // Filter for image files (common extensions including HEIC)
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

    if (imageFiles.length === 0) {
      console.log(` ❌ No image files found in ${imagesDir} directory`);
      return;
    }

    console.log(` - Found ${imageFiles.length} image files to process`);

    // Sort files to ensure consistent ordering
    imageFiles.sort();

    // Process each image
    for (let i = 0; i < imageFiles.length; i++) {
      const imageFile = imageFiles[i];
      const imagePath = path.join(imagesDir, imageFile);
      const outputFileName = `${i + 1}.txt`;
      const outputPath = path.join(outputDir, outputFileName);

      console.log(
        `   - Processing image ${i + 1}/${imageFiles.length}: ${imageFile}`
      );

      try {
        let processPath = imagePath;
        let tempJpegPath = null;

        // Check if file is HEIC/HEIF and convert to JPEG
        const ext = path.extname(imageFile).toLowerCase();
        if (ext === ".heic" || ext === ".heif") {
          console.log(`   - Converting HEIC file to JPEG: ${imageFile}`);
          tempJpegPath = path.join(imagesDir, `temp_${i + 1}.jpg`);
          processPath = await convertHeicToJpeg(imagePath, tempJpegPath);
          console.log(` ✔ HEIC conversion completed`);
        }

        // Configure Tesseract options
        const config = {
          lang: process.env.TEXT_LANG, // update this eventually to be udatable from the UI
          oem: 1, // OCR Engine Mode
          psm: 3, // Page Segmentation Mode
        };

        // Perform OCR
        const text = await tesseract.recognize(processPath, config);

        // Clean up temporary JPEG file if it was created
        if (tempJpegPath && fs.existsSync(tempJpegPath)) {
          fs.unlinkSync(tempJpegPath);
          console.log(` ✔ Cleaned up temporary file`);
        }

        // Clean up the text (remove extra whitespace)
        const cleanedText = text.trim().replace(/\n\s*\n/g, "\n\n");

        // Save to text file
        fs.writeFileSync(outputPath, cleanedText, "utf8");

        console.log(` ✔ Saved OCR result to: ${outputFileName}`);
      } catch (error) {
        console.error(` ❌ Error processing ${imageFile}:`, error.message);

        // Clean up temporary JPEG file if it was created
        if (tempJpegPath && fs.existsSync(tempJpegPath)) {
          fs.unlinkSync(tempJpegPath);
          console.log(` Cleaned up temporary file after error`);
        }

        // Create an error file to maintain sequence
        const errorMessage = `  ❌ Error processing image: ${error.message}`;
        fs.writeFileSync(outputPath, errorMessage, "utf8");
      }
    }
  } catch (error) {
    console.error("❌ Fatal error during OCR processing:", error.message);
  }
}

export { processImagesWithOCR };
