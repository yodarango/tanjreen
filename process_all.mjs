import { processImagesWithOCR } from "./ocr-processor.mjs";
import { combineTextFiles } from "./amalgamate_text_files.mjs";
import { cleanCompleteText } from "./text-cleaner.mjs";
import dotenv from "dotenv";
import fs from "fs";
import path from "path";
import OpenAI from "openai";

// Load environment variables
dotenv.config();

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

/**
 * Process all text files in /text directory and convert to speech
 */
async function processTextToSpeech() {
  const textDir = "./text";
  const audioDir = "./audio";

  try {
    // Ensure audio directory exists
    if (!fs.existsSync(audioDir)) {
      fs.mkdirSync(audioDir, { recursive: true });
      console.log("📁 Created audio directory");
    }

    // Read all text files
    const files = fs.readdirSync(textDir);
    const textFiles = files
      .filter((file) => file.endsWith(".txt"))
      .sort((a, b) => {
        const numA = parseInt(a.split(".")[0]);
        const numB = parseInt(b.split(".")[0]);
        return numA - numB;
      });

    if (textFiles.length === 0) {
      console.log("📄 No text files found in /text directory");
      return;
    }

    console.log(`🎤 Found ${textFiles.length} text files to convert to speech`);

    for (let i = 0; i < textFiles.length; i++) {
      const textFile = textFiles[i];
      const textPath = path.join(textDir, textFile);
      const audioFileName = textFile.replace(".txt", ".mp3");
      const audioPath = path.join(audioDir, audioFileName);

      console.log(
        `🗣️ Processing text file ${i + 1}/${textFiles.length}: ${textFile}`
      );

      try {
        const text = fs.readFileSync(textPath, "utf8");

        if (text.trim().length === 0) {
          console.log(`⚠️ Skipping empty file: ${textFile}`);
          continue;
        }

        // Split text into chunks if it's too long (OpenAI has a limit)
        const maxLength = 4000;
        const chunks = [];

        if (text.length <= maxLength) {
          chunks.push(text);
        } else {
          for (let j = 0; j < text.length; j += maxLength) {
            chunks.push(text.substring(j, j + maxLength));
          }
        }

        // Process each chunk
        for (let chunkIndex = 0; chunkIndex < chunks.length; chunkIndex++) {
          const chunk = chunks[chunkIndex];
          const chunkAudioFileName =
            chunks.length > 1
              ? textFile.replace(".txt", `_part${chunkIndex + 1}.mp3`)
              : audioFileName;
          const chunkAudioPath = path.join(audioDir, chunkAudioFileName);

          console.log(`🎵 Creating audio for ${chunkAudioFileName}`);

          const mp3 = await openai.audio.speech.create({
            model: "tts-1",
            voice: "echo",
            input: chunk,
          });

          const buffer = Buffer.from(await mp3.arrayBuffer());
          await fs.promises.writeFile(chunkAudioPath, buffer);

          console.log(`✅ Saved audio: ${chunkAudioFileName}`);
        }
      } catch (error) {
        console.error(`❌ Error processing ${textFile}:`, error.message);
      }
    }

    console.log(`🎉 Text-to-speech processing completed!`);
  } catch (error) {
    console.error(
      "❌ Fatal error during text-to-speech processing:",
      error.message
    );
  }
}

/**
 * Main function to run the complete pipeline
 */
async function main() {
  console.log(
    "🚀 Starting complete OCR + Text Combination + AI Cleaning + TTS pipeline..."
  );
  console.log("");

  // Step 1: Process images with OCR
  console.log("📖 Step 1: Processing images with OCR...");
  await processImagesWithOCR();
  console.log("");

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
main().catch(console.error);
