import { spawn } from "child_process";
import fs from "fs";

export async function concatenateAudioFiles(bookTitle, language) {
  return new Promise((resolve, reject) => {
    const sanitizedTitle =
      bookTitle.replace(/[^a-zA-Z0-9]+/g, "_").replace(/^_+|_+$/g, "") +
        `_${language}` || "";

    if (!fs.existsSync("./scripts/concat.sh")) {
      console.log(" ❌ concat.sh script not found in server directory");
      reject(new Error("    - concat.sh script not found"));
      return;
    }

    console.log(` - Running concat.sh with title: ${sanitizedTitle}`);

    const concatProcess = spawn("bash", ["concat.sh", sanitizedTitle], {
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
