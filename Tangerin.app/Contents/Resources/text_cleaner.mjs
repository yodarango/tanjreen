import fs from "fs";
import path from "path";
import OpenAI from "openai";
import dotenv from "dotenv";

// Load environment variables
dotenv.config();

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

/**
 * Split text into chunks that don't exceed token limit
 * Always split at sentence endings (periods) to avoid cutting words
 * @param {string} text - The text to split
 * @param {number} maxTokens - Maximum tokens per chunk (default: 3000)
 * @returns {string[]} - Array of text chunks
 */
function splitTextIntoChunks(text, maxTokens = 3000) {
  const chunks = [];
  
  // Rough estimation: 1 token ≈ 4 characters (conservative estimate)
  const maxCharsPerChunk = maxTokens * 3; // Being conservative
  
  let currentChunk = "";
  const sentences = text.split(/(?<=\.)\s+/); // Split on periods followed by whitespace
  
  for (const sentence of sentences) {
    // If adding this sentence would exceed the limit, save current chunk
    if (currentChunk.length + sentence.length > maxCharsPerChunk && currentChunk.length > 0) {
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

/**
 * Clean a text chunk using OpenAI
 * @param {string} textChunk - The text chunk to clean
 * @param {string} bookTitle - The book title
 * @param {number} chunkIndex - Index of the chunk (for logging)
 * @param {number} totalChunks - Total number of chunks (for logging)
 * @returns {Promise<string>} - Cleaned text
 */
async function cleanTextChunk(textChunk, bookTitle, chunkIndex, totalChunks) {
  const systemPrompt = `You are an ebook helping machine that cleans up the text before being narrated by an AI. The file must be in a humanly readable format. Therefore, symbols, words or numbers that seem not to be part of the flow of the reading must be removed. Book titles and page numbers must also be removed from the text. Exercise your best judgement as to what to remove but also in adding punctuation signs when you remove/edit something. Also make sure that the text does not contain orthography errors. The book title will be provided by the user prompt.`;
  
  const userPrompt = `Clean the following text with the book title "${bookTitle}":

${textChunk}`;

  try {
    console.log(`🧹 Cleaning chunk ${chunkIndex + 1}/${totalChunks} (${textChunk.length} characters)`);
    
    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt }
      ],
      temperature: 0.1, // Low temperature for consistent cleaning
      max_tokens: 4000
    });
    
    const cleanedText = response.choices[0].message.content.trim();
    console.log(`✅ Chunk ${chunkIndex + 1} cleaned (${cleanedText.length} characters)`);
    
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
async function cleanCompleteText() {
  const textDir = "./text";
  const inputFile = path.join(textDir, "complete.txt");
  const outputFile = path.join(textDir, "complete_cleaned.txt");
  
  try {
    // Check if complete.txt exists
    if (!fs.existsSync(inputFile)) {
      console.error("❌ complete.txt file not found in /text directory");
      console.log("💡 Run 'npm run combine' first to create the complete.txt file");
      return;
    }
    
    // Get book title from environment
    const bookTitle = process.env.BOOK_TITLE || "Unknown Book";
    console.log(`📚 Book title: ${bookTitle}`);
    
    // Read the complete text
    const completeText = fs.readFileSync(inputFile, 'utf8');
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
      const cleanedChunk = await cleanTextChunk(chunks[i], bookTitle, i, chunks.length);
      cleanedChunks.push(cleanedChunk);
      
      // Add a small delay to avoid rate limiting
      if (i < chunks.length - 1) {
        console.log("⏳ Waiting 1 second to avoid rate limiting...");
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }
    
    // Combine cleaned chunks
    const finalCleanedText = cleanedChunks.join("\n\n");
    
    // Write cleaned text to file
    fs.writeFileSync(outputFile, finalCleanedText, 'utf8');
    
    console.log(`🎉 Text cleaning completed!`);
    console.log(`📊 Original: ${completeText.length} characters`);
    console.log(`📊 Cleaned: ${finalCleanedText.length} characters`);
    console.log(`💾 Output file: ${outputFile}`);
    
    // Show a preview of the cleaned text
    const preview = finalCleanedText.substring(0, 300);
    console.log(`📝 Preview: ${preview}${finalCleanedText.length > 300 ? '...' : ''}`);
    
  } catch (error) {
    console.error("❌ Fatal error during text cleaning:", error.message);
  }
}

/**
 * Main function to run the text cleaner
 */
async function main() {
  console.log("🚀 Starting text cleaning with OpenAI...");
  await cleanCompleteText();
}

// Export the function for use in other modules
export { cleanCompleteText };

// Run if this file is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}
