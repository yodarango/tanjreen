import fs from "fs";
import path from "path";

/** Copy extracted source text to the location expected by translation/TTS. */
export async function copySourceText(bookTitle) {
  const workingDir = process.env.WORKING_DIR;
  const doneDir = process.env.DONE_DIR;
  const sanitizedBookTitle = bookTitle
    .replace(/[^a-zA-Z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
  const inputPath = path.join(workingDir, "text", "complete.txt");
  const outputDir = path.join(doneDir, sanitizedBookTitle);
  const outputPath = path.join(outputDir, `${sanitizedBookTitle}.txt`);

  if (!fs.existsSync(inputPath)) {
    throw new Error(`Source text file not found: ${inputPath}`);
  }

  const sourceText = fs.readFileSync(inputPath, "utf8");
  if (!sourceText.trim()) {
    throw new Error("Source text is empty");
  }

  fs.mkdirSync(outputDir, { recursive: true });
  fs.writeFileSync(outputPath, sourceText, "utf8");
  console.log(` - Sanitization disabled; copied source text to: ${outputPath}`);
}