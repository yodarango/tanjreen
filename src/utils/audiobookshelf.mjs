import fetch from "node-fetch";
import dotenv from "dotenv";
import fs from "fs";
import path from "path";

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
async function absRequest(config, method, endpoint, body = null) {
  const headers = { Authorization: `Bearer ${config.token}` };
  if (body !== null) {
    headers["Content-Type"] = "application/json";
  }

  let response;
  try {
    response = await fetch(`${config.url}${endpoint}`, {
      method,
      headers,
      body: body !== null ? JSON.stringify(body) : undefined,
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

  // Some endpoints return JSON, others plain text (e.g. scan returns "OK")
  const text = await response.text();
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    return { raw: text };
  }
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


/**
 * Find a library item by its file name (matches on the item's path suffix)
 * using the library search endpoint.
 */
async function findLibraryItemByFilename(config, libraryId, filename) {
  const query = filename.replace(/\.mp3$/i, "");
  const data = await absRequest(
    config,
    "GET",
    `/api/libraries/${libraryId}/search?q=${encodeURIComponent(query)}&limit=10`,
  );

  const books = data?.book || [];
  for (const entry of books) {
    const item = entry.libraryItem || {};
    if (item.path && item.path.endsWith(`/${filename}`)) {
      return item;
    }
  }
  return null;
}

/** Upload a cover image file for a library item (multipart form). */
async function uploadItemCover(config, itemId, coverPath) {
  const buffer = await fs.promises.readFile(coverPath);
  const form = new FormData();
  form.append(
    "cover",
    new Blob([buffer], { type: "image/jpeg" }),
    path.basename(coverPath),
  );

  // Use the global (undici) fetch here: it accepts spec FormData/Blob bodies,
  // which node-fetch (used everywhere else in this module) does not
  let response;
  try {
    response = await globalThis.fetch(
      `${config.url}/api/items/${itemId}/cover`,
      {
        method: "POST",
        headers: { Authorization: `Bearer ${config.token}` },
        body: form,
        signal: AbortSignal.timeout(60000),
      },
    );
  } catch (error) {
    throw new Error(`Cover upload failed: ${error.message}`);
  }

  if (!response.ok) {
    const body = await response.text().catch(() => "");
    throw new Error(
      `Audiobookshelf cover upload failed (HTTP ${response.status}): ${body || response.statusText}`,
    );
  }
}

/**
 * After a book is synced: find its library item and attach the description
 * and cover art. The item lookup retries because the library scan may still
 * be running when enrichment finishes.
 */
export async function updateAudiobookshelfEntry({
  filename,
  description,
  coverPath,
  maxAttempts = 5,
  delayMs = 10000,
}) {
  const config = getAbsConfig();
  if (!config) {
    console.log(" ℹ️  ABS_URL/ABS_TOKEN not configured, skipping record update");
    return false;
  }

  const libraryId = await resolveLibraryId(config);

  let item = null;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    item = await findLibraryItemByFilename(config, libraryId, filename);
    if (item) break;
    console.log(
      ` - Book not found in Audiobookshelf yet (attempt ${attempt}/${maxAttempts}), retrying...`,
    );
    await new Promise((resolve) => setTimeout(resolve, delayMs));
  }

  if (!item) {
    throw new Error(
      `Could not find "${filename}" in Audiobookshelf after scanning`,
    );
  }

  if (description) {
    await absRequest(config, "PATCH", `/api/items/${item.id}/media`, {
      metadata: { description },
    });
    console.log(" ✔ Description set on the Audiobookshelf record");
  }

  if (coverPath && fs.existsSync(coverPath)) {
    await uploadItemCover(config, item.id, coverPath);
    console.log(" ✔ Cover uploaded to the Audiobookshelf record");
  }

  return true;
}
