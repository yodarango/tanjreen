import dotenv from "dotenv";

dotenv.config();

/**
 * Step 7: no longer transfers automatically.
 * Audiobookshelf delivery is manual via the "Sync" button on the content page
 * (POST /api/content/sync-abs/:filename), which copies the MP3 into the ABS
 * library folder and triggers a library scan.
 * @param {string} bookTitle - The sanitized book title
 * @param {string} language - Optional language suffix
 */
export async function transferFile(bookTitle, language) {
  console.log(
    " ℹ️  Automatic Audiobookshelf transfer is disabled - use the Sync button on the content page instead"
  );
  console.log(
    JSON.stringify({
      type: "INFO",
      message:
        "Automatic transfer skipped (manual Audiobookshelf sync available from the content page)",
    })
  );
}
