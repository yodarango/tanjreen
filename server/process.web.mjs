import { processImagesWithOCR } from "./process_images_with_ocr.mjs";
import { amalgamateFiles } from "./amalgamate_text_files.mjs";
import { processTextToSpeech } from "./process_tts.mjs";
import { cleanCompleteText } from "./text_cleaner.mjs";
import { translate } from "./translate.mjs";
import {
  logOne,
  callTwo,
  callThree,
  callFour,
  callFive,
} from "./log_steps.mjs";
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

  // Step 1: Process images with OCR
  await logOne(processImagesWithOCR);

  // Step 2: Combine all text files
  await callTwo(amalgamateFiles);

  // Step 3: Clean text with AI
  await callThree(cleanCompleteText, bookTitle);

  // Step 4 (optional): Translate text if language is specified
  if (language && language !== null && language !== "") {
    await callFour(translate, bookTitle, language);
  }

  // Step 5: Convert text to speech
  await callFive(processTextToSpeech, voice, bookTitle, language);

  console.log("🎊 Complete pipeline finished!");
}

// Run the main function
startProcess().catch(console.error);
