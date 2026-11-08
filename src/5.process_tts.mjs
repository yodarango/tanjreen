import OpenAI from "openai";
import path from "path";
import fs from "fs";

// Load environment variables
import dotenv from "dotenv";
dotenv.config();

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

/* ************************************************************
 * Process the cleaned text file and convert to speech
 * ************************************************************
 */
export async function processTextToSpeech(voice, bookTitle, language) {
  const workingDir = process.env.WORKING_DIR;
  const doneDir = process.env.DONE_DIR;

  // Sanitize book title and append language if provided
  let sanitizedBookTitle = bookTitle
    .replace(/[^a-zA-Z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");

  // Only append language if it's a valid non-empty string
  if (language && typeof language === "string" && language.trim() !== "") {
    sanitizedBookTitle += `_${language}`;
  }

  let cleanedTextFile = path.join(
    doneDir,
    `${sanitizedBookTitle}/${sanitizedBookTitle}.txt`
  );

  // Output MP3 chunks directly under WORKING_DIR/audio/
  const audioDir = path.join(workingDir, "audio");

  try {
    // Ensure audio directory exists
    if (!fs.existsSync(audioDir)) {
      fs.mkdirSync(audioDir, { recursive: true });
      console.log(` - Created audio directory: ${audioDir}`);
    }

    // Resolve cleaned text file (fallback to non-translated if needed)
    if (!fs.existsSync(cleanedTextFile) && language) {
      const fallback = path.join(doneDir, `${sanitizedBookTitle}.txt`);
      if (fs.existsSync(fallback)) {
        console.log(
          ` - Translation file missing, falling back to: ${fallback}`
        );
        cleanedTextFile = fallback;
      }
    }

    // Check if cleaned text file exists
    if (!fs.existsSync(cleanedTextFile)) {
      throw new Error(
        `Cleaned text file not found: ${cleanedTextFile}. Make sure to run the cleaning step first.`
      );
    }

    console.log(
      ` - Converting cleaned text to speech using voice: ${voice || "echo"}`
    );

    // Read the cleaned text file
    const text = fs.readFileSync(cleanedTextFile, "utf8");

    if (text.trim().length === 0) {
      throw new Error("Cleaned text file is empty");
    }

    console.log(` - Processing cleaned text (${text.length} characters)`);

    // Split text into chunks at sentence boundaries (periods)
    // to avoid cutting words mid-way
    const maxLength = 4000;
    const chunks = [];

    if (text.length <= maxLength) {
      chunks.push(text);
    } else {
      let remainingText = text;

      while (remainingText.length > 0) {
        if (remainingText.length <= maxLength) {
          // Last chunk
          chunks.push(remainingText);
          break;
        }

        // Find the last period before maxLength
        let splitPoint = remainingText.lastIndexOf(".", maxLength);

        // If no period found before maxLength, look for other sentence endings
        if (splitPoint === -1 || splitPoint < maxLength * 0.5) {
          // Try question mark or exclamation mark
          const questionMark = remainingText.lastIndexOf("?", maxLength);
          const exclamationMark = remainingText.lastIndexOf("!", maxLength);
          splitPoint = Math.max(questionMark, exclamationMark);
        }

        // If still no sentence ending found, split at last space to avoid breaking words
        if (splitPoint === -1 || splitPoint < maxLength * 0.5) {
          splitPoint = remainingText.lastIndexOf(" ", maxLength);
        }

        // If no space found either, do hard split as last resort
        if (splitPoint === -1) {
          splitPoint = maxLength;
        } else {
          // Include the period/punctuation in the chunk
          splitPoint += 1;
        }

        chunks.push(remainingText.substring(0, splitPoint).trim());
        remainingText = remainingText.substring(splitPoint).trim();
      }
    }

    console.log(` - Split into ${chunks.length} chunks for TTS processing`);

    // Send initial progress message
    console.log(
      JSON.stringify({
        type: "STEP_PROGRESS",
        totalItems: chunks.length,
        currentItem: 0,
      })
    );

    // Process each chunk, tracking failures
    const failedChunks = [];
    for (let chunkIndex = 0; chunkIndex < chunks.length; chunkIndex++) {
      const chunk = chunks[chunkIndex];
      const chunkAudioFileName = `${chunkIndex + 1}.mp3`;
      const chunkAudioPath = path.join(audioDir, chunkAudioFileName);

      console.log(
        `   - Creating audio for chunk ${chunkIndex + 1}/${
          chunks.length
        }: ${chunkAudioFileName}`
      );

      // Send progress update
      console.log(
        JSON.stringify({
          type: "STEP_PROGRESS",
          totalItems: chunks.length,
          currentItem: chunkIndex + 1,
        })
      );

      try {
        const mp3 = await openai.audio.speech.create({
          model: "tts-1",
          voice: voice || "echo",
          input: chunk,
        });

        console.log(`   - Response for chunk: ${chunkIndex + 1}: \n ${mp3}`);

        const buffer = Buffer.from(await mp3.arrayBuffer());
        await fs.promises.writeFile(chunkAudioPath, buffer);

        console.log(`   ✔ Saved audio: ${chunkAudioFileName}`);
      } catch (error) {
        console.error(
          ` ❌ Error processing chunk ${chunkIndex + 1}:`,
          error.message
        );
        failedChunks.push({ chunk: chunkIndex + 1, message: error.message });
      }
    }

    // If every chunk failed, no audio was produced - treat the step as failed
    if (chunks.length > 0 && failedChunks.length === chunks.length) {
      throw new Error(
        `Text-to-speech failed for all ${chunks.length} chunks. First error: ${failedChunks[0].message}`
      );
    }

    if (failedChunks.length > 0) {
      console.log(
        ` ⚠️  ${failedChunks.length}/${chunks.length} chunks failed - continuing with the rest`
      );
    }
  } catch (error) {
    console.error(
      " ❌ Fatal error during text-to-speech processing:",
      error.message
    );
    throw error;
  }
}
