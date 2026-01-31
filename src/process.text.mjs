import { concatenateAudioFiles } from "./6.concatenate_audio.mjs";
import { processTextToSpeech } from "./5.process_tts.mjs";
import { cleanCompleteText } from "./3.sanitize_text.mjs";
import { transferFile } from "./7.transfer_file.mjs";
import { translate } from "./4.translate.mjs";
import fs from "fs";
import {
  logThree,
  logFive,
  logFour,
  logSix,
  logSeven,
} from "./utils/log_steps.mjs";

// Load environment variables
import dotenv from "dotenv";
dotenv.config();

/**
 * Main function to run the pipeline starting from step 3 (text cleaning)
 * This is used when text is pasted directly, skipping OCR and amalgamation
 */
async function startProcessFromText() {
  // grab the book title, voice, and language from the temp file
  const workingDir = process.env.WORKING_DIR;
  const tempData = JSON.parse(
    fs.readFileSync(`${workingDir}/temp.json`, "utf8")
  );
  const bookTitle = tempData.bookTitle || "";
  const voice = tempData.voice || "echo";
  const language = tempData.language || null;

  console.log("🚀 Starting transformation from pasted text...");
  console.log(`📖 Book: ${bookTitle}`);
  console.log(`🎤 Voice: ${voice}`);
  console.log(`🌍 Language: ${language || "none"}`);

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

  // Step 7: Transfer file to destination (production only)
  await logSeven(transferFile, bookTitle, language);
}

// Run the main function
startProcessFromText().catch(console.error);

