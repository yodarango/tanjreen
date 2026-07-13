import dotenv from "dotenv";

dotenv.config();

/**
 * Middleware to verify API key for programmatic API access.
 * Accepts the key in the `X-API-Key` header or the `apiKey` query parameter.
 */
export function authenticateApiKey(req, res, next) {
  const configuredKey = process.env.API_KEY;

  if (!configuredKey) {
    console.error("API_KEY environment variable is not configured");
    return res.status(500).json({
      error: "API key authentication is not configured on the server.",
    });
  }

  const providedKey =
    req.headers["x-api-key"] || req.query?.apiKey || req.body?.apiKey;

  if (!providedKey) {
    return res.status(401).json({
      error: "API key is required. Provide it via the X-API-Key header or apiKey query parameter.",
    });
  }

  // Use a timing-safe comparison to avoid timing attacks
  let mismatch = false;
  const configuredLength = configuredKey.length;
  const providedLength = providedKey.length;

  // Compare up to the length of the longer string to prevent early returns
  const maxLength = Math.max(configuredLength, providedLength);
  for (let i = 0; i < maxLength; i++) {
    const configuredChar = i < configuredLength ? configuredKey[i] : "";
    const providedChar = i < providedLength ? providedKey[i] : "";
    if (configuredChar !== providedChar) {
      mismatch = true;
    }
  }

  if (mismatch) {
    return res.status(403).json({ error: "Invalid API key." });
  }

  next();
}
