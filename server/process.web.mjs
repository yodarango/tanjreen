import { processImagesWithOCR } from "./process_images_with_ocr.mjs";
import { amalgamateFiles } from "./amalgamate_text_files.mjs";
import { processTextToSpeech } from "./process_tts.mjs";
import { cleanCompleteText } from "./text_cleaner.mjs";
import { translate } from "./translate.mjs";
import fs from "fs";

// Load environment variables
import dotenv from "dotenv";
dotenv.config();

/**
 * Main function to run the complete pipeline
 */
async function startProcess() {
  // grab the book title, voice, and language from the temp file
  const workingDir = process.env.WORKING_DIR;
  const tempData = JSON.parse(
    fs.readFileSync(`${workingDir}/temp.json`, "utf8")
  );
  const bookTitle = tempData.bookTitle;
  const voice = tempData.voice;
  const language = tempData.language;

  console.log(
    "🚀 Starting complete OCR + Text Combination + AI Cleaning + TTS pipeline..."
  );

  // Step 1: Process images with OCR
  console.log("📖 Step 1: Processing images with OCR...");
  await processImagesWithOCR();
  console.log("");

  // Step 2: Combine all text files
  console.log("📚 Step 2: Combining text files...");
  await amalgamateFiles();
  console.log("");

  // Step 3: Clean text with AI
  console.log("🧹 Step 3: Cleaning text with OpenAI...");
  await cleanCompleteText(bookTitle);
  console.log("");

  // Step 4: Translate text if language is specified
  if (language && language !== null && language !== "") {
    console.log(`🌍 Step 4: Translating text to ${language}...`);
    await translate(bookTitle, language);
    console.log("");
  }

  // Step 4: Convert text to speech
  console.log("🎤 Step 4: Converting text to speech...");
  await processTextToSpeech(voice, bookTitle, language);
  console.log("");

  console.log("🎊 Complete pipeline finished!");
}

// Run the main function
startProcess().catch(console.error);
