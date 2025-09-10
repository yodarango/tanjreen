import fs from "fs";
import path from "path";
import OpenAI from "openai";
import dotenv from "dotenv";

// Load environment variables
dotenv.config();

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

/* **********************************************************************
 * Split text into chunks that don't exceed token limit. Always split at
 * sentence endings (periods) to avoid cutting words.
 * **********************************************************************
 */
function splitTextIntoChunks(text, maxTokens = 3000) {
  const chunks = [];

  // Rough estimation: 1 token ≈ 4 characters (conservative estimate)
  const maxCharsPerChunk = maxTokens * 2; // Being conservative

  let currentChunk = "";
  const sentences = text.split(/(?<=\.)\s+/); // Split on periods followed by whitespace

  for (const sentence of sentences) {
    // If adding this sentence would exceed the limit, save current chunk
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

  // Add the last chunk if it has content
  if (currentChunk.trim().length > 0) {
    chunks.push(currentChunk.trim());
  }

  return chunks;
}

/* ***********************************************************************
 * OCR is not very good at guessing the meanign of a text in difficult
 * pages with graphs or non alpha-numeric characters. To clean this
 * up, we need the help pof AI.
 * ***********************************************************************
 */
async function cleanTextChunk(textChunk, bookTitle, chunkIndex, totalChunks) {
  const systemPrompt = `
  You are a machine that helps clean up text before being narrated by an AI model. 
  Therefore, the text you produce must be in a humanly readable format, gramatically correct and semantically meaningful. 
  Therefore, symbols, words or numbers that seem not to be part of the flow of the reading must be removed. 
  The book title: ${bookTitle} and page numbers must also be removed from the text. 
  Exercise your best judgement as to what to remove. 
  If there are snetneces that do not make sense due to lack of words or gramatical errors thereof, attempt to reconstruct their original meanign based on the context. 
  If you cannot reconstruct the sentence, then remove it.
  Add punctuation signs when you remove/edit something. Also make sure that the text does not contain orthography errors. 
  When removing the book title: ${bookTitle} analyze the context to make sure that it is indeed an insertion of the book title that breaks the text flow and not a frase that happens to have the smae words used by the author but is not the title of the book. `;

  const userPrompt = `Clean the following text with the book title "${bookTitle}":

${textChunk}`;

  try {
    console.log(
      `🧹 Cleaning chunk ${chunkIndex + 1}/${totalChunks} (${
        textChunk.length
      } characters)`
    );

    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      temperature: 0.1, // Low temperature for consistent cleaning
      max_tokens: 4000,
    });

    const cleanedText = response.choices[0].message.content.trim();
    console.log(
      `✅ Chunk ${chunkIndex + 1} cleaned (${cleanedText.length} characters)`
    );

    return cleanedText;
  } catch (error) {
    console.error(`❌ Error cleaning chunk ${chunkIndex + 1}:`, error.message);

    // Return original text if cleaning fails
    return textChunk;
  }
}

/**
 * Clean the complete.txt file using OpenAI
 */
async function cleanCompleteText(bookTitle) {
  const doneDIr = process.env.DONE_DIR;
  const workingDir = process.env.WORKING_DIR;
  const inputFile = path.join(workingDir, "complete.txt");

  const fileNameFromBookTitle = bookTitle.replace(/[^a-zA-Z0-9]/g, "_");
  const outputFile = path.join(doneDIr, `${fileNameFromBookTitle}.txt`);

  try {
    // Check if complete.txt exists
    if (!fs.existsSync(inputFile)) {
      console.error("❌ complete.txt file not found in /text directory");
      console.log(
        "💡 Run 'npm run combine' first to create the complete.txt file"
      );
      return;
    }

    // Get book title from environment
    console.log(`📚 Book title: ${bookTitle}`);

    // Read the complete text
    const completeText = fs.readFileSync(inputFile, "utf8");
    console.log(`📄 Read complete.txt: ${completeText.length} characters`);

    if (completeText.trim().length === 0) {
      console.log("⚠️ complete.txt is empty");
      return;
    }

    // Split text into chunks
    console.log("✂️ Splitting text into chunks...");
    const chunks = splitTextIntoChunks(completeText);
    console.log(`📦 Created ${chunks.length} chunks for processing`);

    // Clean each chunk
    const cleanedChunks = [];
    for (let i = 0; i < chunks.length; i++) {
      const cleanedChunk = await cleanTextChunk(
        chunks[i],
        bookTitle,
        i,
        chunks.length
      );
      cleanedChunks.push(cleanedChunk);

      // Add a small delay to avoid rate limiting
      if (i < chunks.length - 1) {
        console.log("⏳ Waiting 1 second to avoid rate limiting...");
        await new Promise((resolve) => setTimeout(resolve, 1000));
      }
    }

    // Combine cleaned chunks
    const finalCleanedText = cleanedChunks.join("\n\n");

    // Write cleaned text to file
    fs.writeFileSync(outputFile, finalCleanedText, "utf8");

    console.log(`🎉 Text cleaning completed!`);
    console.log(`📊 Original: ${completeText.length} characters`);
    console.log(`📊 Cleaned: ${finalCleanedText.length} characters`);
    console.log(`💾 Output file: ${outputFile}`);

    // Show a preview of the cleaned text
    const preview = finalCleanedText.substring(0, 300);
  } catch (error) {
    console.error("❌ Fatal error during text cleaning:", error.message);
  }
}

// Export the function for use in other modules
export { cleanCompleteText };
