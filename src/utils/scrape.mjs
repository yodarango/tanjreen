import { Readability } from "@mozilla/readability";
import { JSDOM } from "jsdom";
import fetch from "node-fetch";

const MAX_HTML_BYTES = 5 * 1024 * 1024; // 5 MB
const MAX_TEXT_CHARS = 100000; // cap narration length / TTS cost
const FETCH_TIMEOUT_MS = 30000;
const MIN_ARTICLE_CHARS = 200; // below this, fall back to raw body text

const BROWSER_HEADERS = {
  "User-Agent":
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36",
  Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
  "Accept-Language": "en-US,en;q=0.9",
};

// Hosts the scraper must never fetch (SSRF protection)
const BLOCKED_HOST_PATTERNS = [
  /^localhost$/i,
  /\.localhost$/i,
  /\.local$/i,
  /\.internal$/i,
  /^127\./,
  /^10\./,
  /^192\.168\./,
  /^172\.(1[6-9]|2[0-9]|3[0-1])\./,
  /^169\.254\./,
  /^0\.0\.0\.0$/,
  /^\[?::1\]?$/,
];

/**
 * Normalize and validate a user-provided URL.
 * Adds https:// when missing, only allows http(s), blocks local hosts.
 * @returns {string} normalized URL
 * @throws {Error} with a user-friendly message
 */
export function normalizeUrl(rawUrl) {
  if (!rawUrl || typeof rawUrl !== "string" || rawUrl.trim() === "") {
    throw new Error("A URL is required");
  }

  let candidate = rawUrl.trim();
  if (!/^https?:\/\//i.test(candidate)) {
    candidate = `https://${candidate}`;
  }

  let parsed;
  try {
    parsed = new URL(candidate);
  } catch {
    throw new Error(`"${rawUrl}" is not a valid URL`);
  }

  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    throw new Error("Only http:// and https:// URLs are supported");
  }

  if (BLOCKED_HOST_PATTERNS.some((pattern) => pattern.test(parsed.hostname))) {
    throw new Error("This URL points to a local or private address");
  }

  return parsed.toString();
}

/** Collapse excessive whitespace while keeping paragraph breaks. */
function normalizeText(text) {
  return text
    .split("\n")
    .map((line) => line.replace(/[ \t]+/g, " ").trim())
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

/**
 * Fetch a web page and extract its readable text content.
 * Uses Mozilla Readability (reader-mode extraction) with a raw body fallback.
 * @returns {{ title: string, text: string, url: string, truncated: boolean }}
 */
export async function extractTextFromUrl(rawUrl) {
  const url = normalizeUrl(rawUrl);

  let response;
  try {
    response = await fetch(url, {
      headers: BROWSER_HEADERS,
      redirect: "follow",
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    });
  } catch (error) {
    const isTimeout = error.name === "TimeoutError" || error.name === "AbortError";
    throw new Error(
      isTimeout ? `Fetching the page timed out` : `Could not fetch the page: ${error.message}`,
    );
  }

  if (!response.ok) {
    throw new Error(`The page returned an error (HTTP ${response.status})`);
  }

  const contentType = response.headers.get("content-type") || "";
  if (!contentType.includes("text/html") && !contentType.includes("application/xhtml")) {
    throw new Error(`The URL did not return a web page (content type: ${contentType || "unknown"})`);
  }

  const contentLength = parseInt(response.headers.get("content-length") || "0", 10);
  if (contentLength > MAX_HTML_BYTES) {
    throw new Error("The page is too large to process");
  }

  const html = await response.text();
  if (html.length > MAX_HTML_BYTES) {
    throw new Error("The page is too large to process");
  }

  const dom = new JSDOM(html, { url: response.url || url });
  const document = dom.window.document;

  const article = new Readability(document).parse();

  let title = article?.title || document.title || "";
  let text = normalizeText(article?.textContent || "");

  // Fallback: Readability found little or nothing - take raw body text instead
  if (text.length < MIN_ARTICLE_CHARS && document.body) {
    document
      .querySelectorAll("script, style, noscript, iframe, nav, footer, header, aside, form")
      .forEach((el) => el.remove());
    const bodyText = normalizeText(document.body.textContent || "");
    if (bodyText.length > text.length) {
      text = bodyText;
    }
  }

  if (text.length === 0) {
    throw new Error(
      "Could not extract any readable text from this page (it may require JavaScript or login)",
    );
  }

  const truncated = text.length > MAX_TEXT_CHARS;
  if (truncated) {
    text = text.slice(0, MAX_TEXT_CHARS);
  }

  return { title: title.trim(), text, url: response.url || url, truncated };
}
