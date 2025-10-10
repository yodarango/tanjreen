import { processImagesWithOCR } from "./1.process_images_with_ocr.mjs";
import { concatenateAudioFiles } from "./6.concatenate_audio.mjs";
import { amalgamateFiles } from "./2.amalgamate_text_files.mjs";
import { processTextToSpeech } from "./5.process_tts.mjs";
import { cleanCompleteText } from "./3.sanitize_text.mjs";
import { translate } from "./4.translate.mjs";
import fs from "fs";
import {
  logThree,
  logFive,
  logFour,
  logOne,
  logTwo,
  logSix,
} from "./utils/log_steps.mjs";

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
  const bookTitle = tempData.bookTitle || "";
  const voice = tempData.voice || "echo";
  const language = tempData.language || null;

  // Step 1: Process images with OCR
  await logOne(processImagesWithOCR, bookTitle);

  // Step 2: Combine all text files
  await logTwo(amalgamateFiles, bookTitle);

  // Step 3: Clean text with AI
  await logThree(cleanCompleteText, bookTitle);

  // Step 4 (optional): Translate text if language is specified
  if (language && language !== null && language !== "") {
    await logFour(translate, bookTitle, language);
  }

  // Step 5: Convert text to speech
  await logFive(processTextToSpeech, voice, bookTitle, language);

  // Step 6: Concatenate audio files
  await logSix(concatenateAudioFiles, bookTitle, language);
}

// Run the main function
startProcess().catch(console.error);
