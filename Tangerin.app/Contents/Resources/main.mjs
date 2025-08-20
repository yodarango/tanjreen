import { combineTextFiles } from "./amalgamate_text_files.mjs";
import { processImagesWithOCR } from "./ocr_processor.mjs";
import { processTextToSpeech } from "./process_tts.mjs";
import { cleanCompleteText } from "./text_cleaner.mjs";
import { spawn } from "child_process";
import fs from "fs";
import dotenv from "dotenv";

// Load environment variables
dotenv.config();

/**
 * Check if a file exists
 */
function fileExists(filePath) {
  try {
    return fs.existsSync(filePath);
  } catch (error) {
    return false;
  }
}

/**
 * Concatenate audio files using the existing concat.sh script
 */
async function concatenateAudioFiles() {
  return new Promise((resolve) => {
    console.log("🎵 Starting audio concatenation...");
    
    // Check if concat.sh exists
    if (!fileExists("concat.sh")) {
      console.log("⚠️ concat.sh script not found, skipping concatenation...");
      resolve();
      return;
    }
    
    console.log("🔧 Running concat.sh script...");
    
    const concatProcess = spawn("bash", ["concat.sh"], {
      stdio: ["pipe", "pipe", "pipe"],
      cwd: process.cwd(),
    });
    
    concatProcess.stdout.on("data", (data) => {
      const output = data.toString().trim();
      if (output) {
        console.log(output);
      }
    });
    
    concatProcess.stderr.on("data", (data) => {
      const output = data.toString().trim();
      if (output) {
        console.error(output);
      }
    });
    
    concatProcess.on("close", (code) => {
      if (code === 0) {
        console.log("✅ Audio concatenation completed successfully");
      } else {
        console.log(`⚠️ concat.sh exited with code ${code}, but continuing...`);
      }
      resolve(); // Don't fail the whole process for concatenation issues
    });
    
    concatProcess.on("error", (error) => {
      console.log(`⚠️ concat.sh error: ${error.message}`);
      resolve(); // Don't fail the whole process
    });
  });
}

/**
 * Main function to run the complete pipeline
 */
async function main() {
  try {
    console.log('🍊 Tangerin - Complete Processing Pipeline');
    console.log('==========================================');
    console.log('');
    
    // Step 1: OCR Processing
    console.log('📖 Step 1: Processing images with OCR...');
    await processImagesWithOCR();
    console.log('');
    
    // Step 2: Text Combination
    console.log('📚 Step 2: Combining text files...');
    await combineTextFiles();
    console.log('');
    
    // Step 3: AI Text Cleaning
    console.log('🧹 Step 3: Cleaning text with OpenAI...');
    await cleanCompleteText();
    console.log('');
    
    // Step 4: Text-to-Speech
    console.log('🎤 Step 4: Converting text to speech...');
    await processTextToSpeech();
    console.log('');
    
    // Step 5: Audio Concatenation
    console.log('🎵 Step 5: Concatenating audio files...');
    await concatenateAudioFiles();
    console.log('');
    
    // Final success message
    console.log('🎉 Complete pipeline finished successfully!');
    console.log('');
    
    // Show output information
    const bookTitle = process.env.BOOK_TITLE || 'audiobook';
    const sanitizedTitle = bookTitle.toLowerCase().replace(/[^a-z0-9]/g, '_');
    const audioDir = `./audio/${sanitizedTitle}`;
    
    if (fs.existsSync(audioDir)) {
      console.log(`📁 Output directory: ${audioDir}`);
      
      const files = fs.readdirSync(audioDir);
      const audioFiles = files.filter(f => f.endsWith('.mp3'));
      
      if (audioFiles.length > 0) {
        console.log(`🎧 Generated ${audioFiles.length} audio files`);
        
        // Check for complete.mp3
        if (files.includes('complete.mp3')) {
          console.log(`🎵 Complete audiobook: ${audioDir}/complete.mp3`);
        }
      }
    }
    
    console.log('');
    console.log('🍊 Tangerin processing complete! Your audiobook is ready.');
    
  } catch (error) {
    console.error('❌ Pipeline failed:', error.message);
    process.exit(1);
  }
}

// Run the pipeline
main();
