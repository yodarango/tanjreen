import fs from "fs";
import path from "path";

/* ********************************************************************************
 * Combine all text files created by the processImagesWithOCR function. It
 * will grab the files, sort them in numerical order, and combine them
 * into a single file.
 *
 * The output file will be saved to the working directory, which is specified
 * by the WORKING_DIR environment variable as complete.text
 *
 * ********************************************************************************
 */
async function amalgamateFiles() {
  const textDir = "./text";
  const outputFile = process.env.WORKING_DIR;

  try {
    // Check if text directory exists
    if (!fs.existsSync(textDir)) {
      console.error("❌ Text directory does not exist");
      return;
    }

    // Read all files from text directory
    const files = fs.readdirSync(textDir);

    // Filter for .txt files (excluding complete.txt if it already exists)
    const textFiles = files.filter(
      (file) => file.endsWith(".txt") && file !== "complete.txt"
    );

    if (textFiles.length === 0) {
      console.log("📄 No text files found in /text directory");
      return;
    }

    // Sort files numerically (1.txt, 2.txt, 3.txt, etc.)
    textFiles.sort((a, b) => {
      const numA = parseInt(a.split(".")[0]);
      const numB = parseInt(b.split(".")[0]);
      return numA - numB;
    });

    console.log(`📚 Found ${textFiles.length} text files to combine`);
    console.log(`📋 Files order: ${textFiles.join(", ")}`);

    let combinedContent = "";
    let totalCharacters = 0;

    // Process each text file
    for (let i = 0; i < textFiles.length; i++) {
      const textFile = textFiles[i];
      const filePath = path.join(textDir, textFile);

      console.log(`📖 Reading file ${i + 1}/${textFiles.length}: ${textFile}`);

      try {
        const content = fs.readFileSync(filePath, "utf8");
        const trimmedContent = content.trim();

        if (trimmedContent.length === 0) {
          console.log(`⚠️ Skipping empty file: ${textFile}`);
          continue;
        }

        // Add content with simple spacing
        if (combinedContent.length > 0) {
          combinedContent += "\n\n";
        }

        // Add the content
        combinedContent += trimmedContent;
        totalCharacters += trimmedContent.length;

        console.log(
          `✅ Added ${trimmedContent.length} characters from ${textFile}`
        );
      } catch (error) {
        console.error(`❌ Error reading ${textFile}:`, error.message);

        // Add error note to combined content
        if (combinedContent.length > 0) {
          combinedContent += "\n\n";
        }
        combinedContent += `Error reading file ${textFile}: ${error.message}`;
      }
    }

    if (combinedContent.length === 0) {
      console.log(
        "⚠️ No content to combine - all files were empty or had errors"
      );
      return;
    }

    // Write the combined content to complete.txt
    fs.writeFileSync(outputFile, combinedContent, "utf8");

    console.log(
      `🎉 Successfully combined ${textFiles.length} files into complete.txt`
    );
    console.log(`📊 Total characters: ${totalCharacters}`);
    console.log(`💾 Output file: ${outputFile}`);

    // Show a preview of the combined content
    const preview = combinedContent.substring(0, 200);
    console.log(
      `📝 Preview: ${preview}${combinedContent.length > 200 ? "..." : ""}`
    );
  } catch (error) {
    console.error("❌ Fatal error during text combination:", error.message);
  }
}

// Export the function for use in other modules
export { amalgamateFiles };
