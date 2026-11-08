import fetch from "node-fetch";
import dotenv from "dotenv";

dotenv.config();

const REQUEST_TIMEOUT_MS = 15000;

/**
 * Audiobookshelf integration: after a finished MP3 is copied into the
 * Audiobookshelf library folder, trigger a library scan via the ABS API
 * so the new book entry is created and becomes listenable right away.
 *
 * Required env vars:
 *   ABS_URL   - e.g. https://abs.example.com
 *   ABS_TOKEN - user API token (ABS web app: config -> users -> your account)
 * Optional:
 *   ABS_LIBRARY_ID - skip auto-detection of the book library
 */
function getAbsConfig() {
  const url = (process.env.ABS_URL || "").trim().replace(/\/+$/, "");
  const token = (process.env.ABS_TOKEN || "").trim();

  if (!url || !token) return null;

  return {
    url,
    token,
    libraryId: (process.env.ABS_LIBRARY_ID || "").trim() || null,
  };
}

/** Make an authenticated request to the Audiobookshelf API. */
async function absRequest(config, method, endpoint) {
  let response;
  try {
    response = await fetch(`${config.url}${endpoint}`, {
      method,
      headers: { Authorization: `Bearer ${config.token}` },
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });
  } catch (error) {
    throw new Error(`Audiobookshelf is unreachable at ${config.url}: ${error.message}`);
  }

  if (!response.ok) {
    const body = await response.text().catch(() => "");
    throw new Error(
      `Audiobookshelf API ${method} ${endpoint} failed (HTTP ${response.status}): ${body || response.statusText}`
    );
  }

  // The scan endpoint returns an empty body on success
  const text = await response.text();
  return text ? JSON.parse(text) : null;
}

/**
 * Find the book library to scan. Uses ABS_LIBRARY_ID when set, otherwise
 * picks the first library with mediaType "book" (fallback: first library).
 */
async function resolveLibraryId(config) {
  if (config.libraryId) return config.libraryId;

  const data = await absRequest(config, "GET", "/api/libraries");
  const libraries = data?.libraries || [];
  const bookLibrary = libraries.find((lib) => lib.mediaType === "book") || libraries[0];

  if (!bookLibrary) {
    throw new Error("No libraries found on the Audiobookshelf server");
  }

  return bookLibrary.id;
}

/**
 * Trigger a library scan on the Audiobookshelf server so newly copied
 * books get an entry. Throws on failure - callers decide if that is fatal.
 * @returns {Promise<boolean>} false when ABS is not configured, true when a scan was started
 */
export async function triggerAudiobookshelfScan() {
  const config = getAbsConfig();

  if (!config) {
    console.log(" ℹ️  ABS_URL/ABS_TOKEN not configured, skipping Audiobookshelf scan");
    return false;
  }

  const libraryId = await resolveLibraryId(config);

  console.log(` 📚 Triggering Audiobookshelf library scan (library: ${libraryId})...`);
  console.log(
    JSON.stringify({ type: "STEP_PROGRESS", totalItems: 1, currentItem: 0 })
  );

  await absRequest(config, "POST", `/api/libraries/${libraryId}/scan`);

  console.log(" ✔ Audiobookshelf scan started - the new book will appear in the app shortly");
  console.log(
    JSON.stringify({
      type: "INFO",
      message: "Audiobookshelf scan triggered successfully",
    })
  );

  return true;
}
