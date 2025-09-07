import { combineTextFiles } from "./amalgamate_text_files.mjs";
import { processImagesWithOCR } from "./ocr_processor.mjs";
import { processTextToSpeech } from "./process_tts.mjs";
import { cleanCompleteText } from "./text_cleaner.mjs";

/**
 * Main function to run the complete pipeline
 */
async function process() {
  console.log(
    "🚀 Starting complete OCR + Text Combination + AI Cleaning + TTS pipeline..."
  );

  // Step 1: Process images with OCR
  console.log("📖 Step 1: Processing images with OCR...");
  await processImagesWithOCR();
  return;

  // Step 2: Combine all text files
  console.log("📚 Step 2: Combining text files...");
  await combineTextFiles();
  console.log("");

  // Step 3: Clean text with AI
  console.log("🧹 Step 3: Cleaning text with OpenAI...");
  await cleanCompleteText();
  console.log("");

  // Step 4: Convert text to speech
  console.log("🎤 Step 4: Converting text to speech...");
  await processTextToSpeech();
  console.log("");

  console.log("🎊 Complete pipeline finished!");
}

// Run the main function
process().catch(console.error);
