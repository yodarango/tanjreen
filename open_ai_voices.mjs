// String to get a sample of all the available voices by AI
import OpenAI from "openai";
import dotenv from "dotenv";
import fs from "fs";

// Load environment variables
dotenv.config();

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

const voices = [
  "alloy",
  "ash",
  "ballad",
  "coral",
  "echo",
  "fable",
  "nova",
  "onyx",
  "sage",
  "shimmer",
  "verse",
];

const text =
  "When your credit balance reaches zero dollars, your API requests will stop working. Enable automatic recharge to automatically keep your credit balance topped up.";

(async () => {
  for (const v of voices) {
    const resp = await openai.audio.speech.create({
      model: "gpt-4o-mini-tts",
      voice: v,
      input: text,
    });
    const buf = Buffer.from(await resp.arrayBuffer());
    await fs.promises.writeFile(`./voices/sample-${v}.mp3`, buf);
    console.log(`Saved sample-${v}.mp3`);
  }
})();
