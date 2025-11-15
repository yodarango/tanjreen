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
      console.log(
        ` ❌ Cleaned text file not found: ${cleanedTextFile}. Make sure to run the cleaning step first.`
      );
      return;
    }

    console.log(
      ` - Converting cleaned text to speech using voice: ${voice || "echo"}`
    );

    // Read the cleaned text file
    const text = fs.readFileSync(cleanedTextFile, "utf8");

    if (text.trim().length === 0) {
      console.log(" ❌ Cleaned text file is empty");
      return;
    }

    console.log(` - Processing cleaned text (${text.length} characters)`);

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

    console.log(` - Split into ${chunks.length} chunks for TTS processing`);

    // Send initial progress message
    console.log(
      JSON.stringify({
        type: "STEP_PROGRESS",
        totalItems: chunks.length,
        currentItem: 0,
      })
    );

    // Process each chunk
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
      }
    }
  } catch (error) {
    console.error(
      " ❌ Fatal error during text-to-speech processing:",
      error.message
    );
  }
}
