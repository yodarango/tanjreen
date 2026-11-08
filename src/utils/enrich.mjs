import { updateAudiobookshelfEntry } from "./audiobookshelf.mjs";
import OpenAI from "openai";
import sharp from "sharp";
import fs from "fs";

import dotenv from "dotenv";
dotenv.config();

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

const DESCRIPTION_MODEL = "gpt-4o-mini";
const MAX_DESCRIPTION_WORDS = 500;
const SAMPLE_CHUNK_SIZE = 2000; // chars per sampled chunk
const SAMPLE_CHUNK_COUNT = 12; // chunks sampled evenly across the whole book
const COVER_TARGET_BYTES = 500 * 1024; // 500 KB hard ceiling

/**
 * Sample random text chunks from across the ENTIRE text: the text is divided
 * into evenly spaced regions and one random chunk is taken from each, so long
 * books are represented beginning-to-end without exceeding token limits.
 */
export function sampleTextChunks(
  text,
  chunkSize = SAMPLE_CHUNK_SIZE,
  targetChunks = SAMPLE_CHUNK_COUNT,
) {
  const clean = text.replace(/\s+/g, " ").trim();
  if (!clean) return [];

  // Short text: use it whole
  if (clean.length <= chunkSize * targetChunks) return [clean];

  const step = Math.floor(clean.length / targetChunks);
  const chunks = [];
  for (let i = 0; i < targetChunks; i++) {
    const regionStart = i * step;
    const maxOffset = Math.max(0, step - chunkSize);
    const start = regionStart + Math.floor(Math.random() * (maxOffset + 1));
    chunks.push(clean.slice(start, start + chunkSize).trim());
  }
  return chunks;
}

/**
 * Generate a book description (max 500 words) from sampled excerpts.
 */
export async function generateBookDescription(title, text) {
  const chunks = sampleTextChunks(text);
  if (chunks.length === 0) {
    throw new Error("No text available to generate a description from");
  }

  const sampled = chunks
    .map((chunk, i) => `[Excerpt ${i + 1} of ${chunks.length}]\n${chunk}`)
    .join("\n\n");

  const response = await openai.chat.completions.create({
    model: DESCRIPTION_MODEL,
    messages: [
      {
        role: "system",
        content: "You write concise, engaging audiobook descriptions.",
      },
      {
        role: "user",
        content:
          `The following are excerpts sampled from throughout a book titled "${title}".\n\n` +
          `${sampled}\n\n` +
          `Based on these excerpts, write a description of what the book is about. ` +
          `Hard limit: no more than ${MAX_DESCRIPTION_WORDS} words. ` +
          `Plain prose only - no headings, lists, or bullet points.`,
      },
    ],
  });

  let description = (response.choices?.[0]?.message?.content || "").trim();
  if (!description) {
    throw new Error("AI returned an empty description");
  }

  // Defensive hard cap at the word limit
  const words = description.split(/\s+/);
  if (words.length > MAX_DESCRIPTION_WORDS) {
    description = words.slice(0, MAX_DESCRIPTION_WORDS).join(" ") + "...";
  }

  return description;
}

/**
 * Compress a generated cover image: portrait, JPEG, under 500 KB.
 * Steps down quality first, then dimensions, keeping the best-looking result.
 */
export async function compressCover(inputBuffer, outputPath) {
  const widths = [800, 640, 512, 400];
  const qualities = [82, 70, 60, 50, 40];
  let fallback = null;

  for (const width of widths) {
    for (const quality of qualities) {
      const buffer = await sharp(inputBuffer)
        .resize({ width, withoutEnlargement: true })
        .jpeg({ quality, mozjpeg: true })
        .toBuffer();

      if (buffer.length <= COVER_TARGET_BYTES) {
        await fs.promises.writeFile(outputPath, buffer);
        return { bytes: buffer.length, width, quality, metTarget: true };
      }
      if (!fallback || buffer.length < fallback.buffer.length) {
        fallback = { buffer, width, quality };
      }
    }
  }

  // Extremely unlikely to get here (400px/q40 is tiny), but never fail the sync
  await fs.promises.writeFile(outputPath, fallback.buffer);
  return {
    bytes: fallback.buffer.length,
    width: fallback.width,
    quality: fallback.quality,
    metTarget: false,
  };
}

/**
 * Generate a portrait-orientation cover image with AI and compress it.
 */
export async function generateBookCover(title, description, outputPath) {
  // Keep the image prompt short - a flavor of the book is enough
  const flavor = description.split(/\s+/).slice(0, 120).join(" ");

  const response = await openai.images.generate({
    model: "dall-e-3",
    prompt:
      `Portrait-orientation audiobook cover artwork for a book titled "${title}". ` +
      `The book is about: ${flavor}. ` +
      `Style: clean, professional, atmospheric book cover illustration. ` +
      `Do not include any text, letters, or words in the image.`,
    size: "1024x1792", // portrait
    quality: "standard",
    response_format: "b64_json",
    n: 1,
  });

  const b64 = response.data?.[0]?.b64_json;
  if (!b64) {
    throw new Error("Image API returned no image");
  }

  const stats = await compressCover(Buffer.from(b64, "base64"), outputPath);
  console.log(
    ` - Cover compressed to ${Math.round(stats.bytes / 1024)} KB (${stats.width}px, q${stats.quality})`,
  );
  return outputPath;
}


/**
 * Full enrichment pipeline (fire-and-forget): generate a description from
 * sampled excerpts, generate + compress a cover image, save both next to the
 * mp3/txt (so they are included in zip downloads), then update the
 * Audiobookshelf record. Existing files are reused, never regenerated.
 * Never throws - logs errors so a failure cannot crash the server.
 */
export async function enrichAndUpdateAudiobookshelf({
  title,
  filename,
  textPath,
  descriptionPath,
  coverPath,
}) {
  try {
    if (!fs.existsSync(textPath)) {
      console.log(
        ` ℹ️  No text file for "${title}" - skipping description/cover generation`,
      );
      return;
    }

    let description;
    if (fs.existsSync(descriptionPath)) {
      description = fs.readFileSync(descriptionPath, "utf8");
      console.log(` ℹ️  Description already exists for "${title}", reusing it`);
    } else {
      console.log(` ✨ Generating description for "${title}"...`);
      const text = fs.readFileSync(textPath, "utf8");
      description = await generateBookDescription(title, text);
      fs.writeFileSync(descriptionPath, description, "utf8");
      console.log(
        ` ✔ Description saved (${description.split(/\s+/).length} words): ${descriptionPath}`,
      );
    }

    if (fs.existsSync(coverPath)) {
      console.log(` ℹ️  Cover already exists for "${title}", reusing it`);
    } else {
      console.log(` 🎨 Generating cover art for "${title}"...`);
      await generateBookCover(title, description, coverPath);
      console.log(` ✔ Cover saved: ${coverPath}`);
    }

    console.log(` 📝 Updating Audiobookshelf record for "${title}"...`);
    await updateAudiobookshelfEntry({ filename, description, coverPath });
    console.log(` ✅ Audiobookshelf record updated for "${title}"`);
  } catch (error) {
    console.error(` ❌ Enrichment failed for "${title}":`, error.message);
  }
}
