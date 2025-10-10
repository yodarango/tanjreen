import fs from "fs";
import path from "path";
import OpenAI from "openai";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

/* ************************************************************
 * transalte the text into the given language through openAI
 * ************************************************************
 */

/* **********************************************************************
 * Split text into chunks that don't exceed ~3000 tokens. We approximate
 * tokens conservatively with characters and split on sentence boundaries.
 * **********************************************************************
 */
function splitTextIntoChunks(text, maxTokens = 3000) {
  const chunks = [];

  // Rough estimation: 1 token ≈ 4 characters; be extra conservative
  const maxCharsPerChunk = maxTokens * 2; // ≈ 6000 chars per chunk

  let currentChunk = "";
  const sentences = text.split(/(?<=\.)\s+/);

  for (const sentence of sentences) {
    if (
      currentChunk.length + sentence.length > maxCharsPerChunk &&
      currentChunk.length > 0
    ) {
      chunks.push(currentChunk.trim());
      currentChunk = sentence;
    } else {
      currentChunk += (currentChunk.length > 0 ? " " : "") + sentence;
    }
  }

  if (currentChunk.trim().length > 0) {
    chunks.push(currentChunk.trim());
  }

  return chunks;
}

async function translateText(text, language) {
  try {
    const chunks = splitTextIntoChunks(text, 3000);
    console.log(` - Split text into ${chunks.length} chunk(s) for translation`);

    const translations = [];

    for (let i = 0; i < chunks.length; i++) {
      const chunk = chunks[i];
      const prompt = `Translate the following text as accurately as possible to ${language}. Make sure that the translation is done in day to day ${language} not written style ${language} therefore, translate accurately but also in a way that is relevant today:\n\n${chunk}`;

      console.log(
        `   - Translating chunk ${i + 1}/${chunks.length} (${
          chunk.length
        } chars)`
      );

      const response = await openai.chat.completions.create({
        model: "gpt-3.5-turbo",
        messages: [
          {
            role: "user",
            content: prompt,
          },
        ],
        max_tokens: 4000,
        temperature: 0.3,
      });

      const translatedChunk = response.choices[0].message.content.trim();
      translations.push(translatedChunk);

      // Small delay to reduce rate limiting risk
      if (i < chunks.length - 1) {
        await new Promise((r) => setTimeout(r, 500));
      }
    }

    return translations.join("\n\n");
  } catch (error) {
    console.error(" ❌ Error translating text:", error.message);
    throw error;
  }
}

/* ************************************************************
 * Translate the complete text file and save it
 * ************************************************************
 */
export async function translate(bookTitle, language) {
  console.log(` - Starting translation to ${language}...`);

  try {
    // Read the complete text file
    const workingDir = process.env.WORKING_DIR;
    const completeTextPath = path.join(workingDir, "complete.txt");

    if (!fs.existsSync(completeTextPath)) {
      throw new Error(" ❌ complete.txt file not found");
    }

    const originalText = fs.readFileSync(completeTextPath, "utf8");
    console.log(` - Read ${originalText.length} characters from complete.txt`);

    // Translate the text
    console.log(` - Translating to ${language}...`);
    const translatedText = await translateText(originalText, language);
    console.log(
      ` ✔ Translation completed: ${translatedText.length} characters`
    );

    // Save the translated text
    const doneDir = process.env.DONE_DIR;

    // Sanitize book title and append language
    let sanitizedBookTitle = bookTitle
      .replace(/[^a-zA-Z0-9]+/g, "_")
      .replace(/^_+|_+$/g, "");

    // Append language (should always be valid in translate function)
    if (language && typeof language === "string" && language.trim() !== "") {
      sanitizedBookTitle += `_${language}`;
    }

    const doneDirForBookTitle = path.join(doneDir, sanitizedBookTitle);

    // Create the complete directory if it doesn't exist
    if (!fs.existsSync(doneDirForBookTitle)) {
      fs.mkdirSync(doneDirForBookTitle, { recursive: true });
    }

    const outputPath = path.join(
      doneDirForBookTitle,
      `${sanitizedBookTitle}.txt`
    );

    fs.writeFileSync(outputPath, translatedText, "utf8");
    console.log(` ✔ Translated text saved to: ${outputPath}`);

    return outputPath;
  } catch (error) {
    console.error(" ❌ Error during translation:", error.message);
    throw error;
  }
}
