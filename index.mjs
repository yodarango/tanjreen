import fs from "fs";
import path from "path";
import OpenAI from "openai";
import dotenv from "dotenv";

// Load environment variables from .env file
dotenv.config();

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

async function main() {
  const filePath = "./text/complete_cleaned.txt";
  const audioDir = "./audio/daniel_in_babylon";

  // Create audio directory if it doesn't exist
  if (!fs.existsSync(audioDir)) {
    fs.mkdirSync(audioDir, { recursive: true });
    console.log("📁 Created audio directory");
  }

  const parts = [];

  try {
    let data = fs.readFileSync(filePath, "utf8");

    for (let i = 0; i < data.length; i += 4090) {
      parts.push(data.substring(i, i + 4090));
    }

    for (let i = 0; i < parts.length; i++) {
      console.log(`🎤 Processing part ${i + 1} of ${parts.length}`);
      console.log(`🗣️ Content: ${parts[i]}`);

      const mp3 = await openai.audio.speech.create({
        model: "gpt-4o-mini-tts",
        voice: process.env.VOICE,
        input: parts[i],
        instructions: "Speak as if you were reading a book.",
      });

      console.log(`💾 Saving part ${i + 1} of ${parts.length}`);

      const buffer = Buffer.from(await mp3.arrayBuffer());
      await fs.promises.writeFile(
        `./audio/daniel_in_babylon/file_${i}.mp3`,
        buffer
      );

      console.log(
        `✅ Part ${i + 1} of ${
          parts.length
        } saved. Now moving to the next part...`
      );
    }
  } catch (error) {
    console.error(`Error reading file: ${error.message}`);
  }
}

main();
