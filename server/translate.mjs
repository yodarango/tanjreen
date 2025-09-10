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
async function translateText(text, language) {
  try {
    const prompt = `Translate the following text as accurately as possible to ${language}. Make sure that the translation is done in day to day ${language} not written style ${language} therefore, translate accurately but also in a way that is relevant today:

${text}`;

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

    return response.choices[0].message.content.trim();
  } catch (error) {
    console.error("❌ Error translating text:", error.message);
    throw error;
  }
}

/* ************************************************************
 * Translate the complete text file and save it
 * ************************************************************
 */
export async function translate(bookTitle, language) {
  console.log(`🌍 Starting translation to ${language}...`);

  try {
    // Read the complete text file
    const workingDir = process.env.WORKING_DIR;
    const completeTextPath = path.join(workingDir, "complete.txt");

    if (!fs.existsSync(completeTextPath)) {
      throw new Error("complete.txt file not found");
    }

    const originalText = fs.readFileSync(completeTextPath, "utf8");
    console.log(`📖 Read ${originalText.length} characters from complete.txt`);

    // Translate the text
    console.log(`🔄 Translating to ${language}...`);
    const translatedText = await translateText(originalText, language);
    console.log(
      `✅ Translation completed: ${translatedText.length} characters`
    );

    // Save the translated text
    const doneDir = process.env.DONE_DIR;
    const sanitizedBookTitle = bookTitle
      .replace(/[^a-zA-Z0-9\s]/g, "")
      .replace(/\s+/g, "_");
    const outputPath = path.join(
      doneDir,
      `${sanitizedBookTitle}_${language}.txt`
    );

    // Ensure the done directory exists
    if (!fs.existsSync(doneDir)) {
      fs.mkdirSync(doneDir, { recursive: true });
    }

    fs.writeFileSync(outputPath, translatedText, "utf8");
    console.log(`💾 Translated text saved to: ${outputPath}`);

    return outputPath;
  } catch (error) {
    console.error("❌ Error during translation:", error.message);
    throw error;
  }
}
