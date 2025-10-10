import { spawn } from "child_process";
import fs from "fs";

export async function concatenateAudioFiles(bookTitle, language) {
  return new Promise((resolve, reject) => {
    // Sanitize book title and append language if provided
    let sanitizedTitle = bookTitle
      .replace(/[^a-zA-Z0-9]+/g, "_")
      .replace(/^_+|_+$/g, "");

    // Only append language if it's a valid non-empty string
    if (language && typeof language === "string" && language.trim() !== "") {
      sanitizedTitle += `_${language}`;
    }

    const scriptPath = "./src/scripts/concat.sh";

    if (!fs.existsSync(scriptPath)) {
      console.log(` ❌ concat.sh script not found at ${scriptPath}`);
      reject(new Error(`concat.sh script not found at ${scriptPath}`));
      return;
    }

    console.log(` - Running concat.sh with title: ${sanitizedTitle}`);

    const concatProcess = spawn("bash", [scriptPath, sanitizedTitle], {
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
      console.log(` ❌ Error concatinating: \n ${data}`);
    });

    concatProcess.on("close", (code) => {
      if (code === 0) {
        console.log(" ✔ Audio concatenation completed successfully");
        resolve();
      } else {
        console.log(` ❌ concat.sh exited with code ${code}`);
        reject(new Error(`concat.sh failed with exit code ${code}`));
      }
    });

    concatProcess.on("error", (error) => {
      console.log(` ❌ concat.sh error: \n ${error.message}`);
      reject(error);
    });
  });
}
