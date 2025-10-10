# Complete Process Flow Documentation

## Overview
This document describes the complete audiobook conversion process from images to final audio file.

## Directory Structure

### Input
- `src/content/1.pending/` - Contains source images (HEIC, JPG, PNG, etc.)

### Working
- `src/content/2.working/{bookTitle}/text/` - OCR text files and combined text
- `src/content/2.working/{bookTitle}/audio/` - Individual audio chunks
- `src/content/2.working/temp.json` - Process configuration

### Output
- `src/content/3.done/{bookTitle}/` - Final cleaned text and audio (no translation)
- `src/content/3.done/{bookTitle}_{language}/` - Final translated text and audio (with translation)

## Process Steps

### Step 0: Initialization (server.mjs)
**Input:** User provides via API:
- `bookTitle` (required)
- `voice` (optional, default: "echo")
- `language` (optional, default: null)

**Actions:**
1. Validates input parameters
2. Cleans working directory (removes old files)
3. Creates `temp.json` with configuration
4. Spawns child process to run `process.web.mjs`

**Output:**
- `src/content/2.working/temp.json`

---

### Step 1: OCR Processing (1.process_images_with_ocr.mjs)
**Input:**
- Images from `PENDING_DIR` (src/content/1.pending/)
- `bookTitle` parameter

**Actions:**
1. Sanitizes book title: `bookTitle` → `sanitizedBookTitle`
2. Creates output directory: `WORKING_DIR/{sanitizedBookTitle}/text/`
3. Reads all image files from pending directory
4. Converts HEIC files to JPEG if needed
5. Performs OCR on each image using Tesseract
6. Saves text to numbered files: `1.txt`, `2.txt`, `3.txt`, etc.

**Output:**
- `src/content/2.working/{sanitizedBookTitle}/text/1.txt`
- `src/content/2.working/{sanitizedBookTitle}/text/2.txt`
- ... (one file per image)

**Example:**
- Input: `bookTitle = "Daniel In Babylon"`
- Output dir: `src/content/2.working/Daniel_In_Babylon/text/`

---

### Step 2: Amalgamate Text (2.amalgamate_text_files.mjs)
**Input:**
- Text files from `WORKING_DIR/{sanitizedBookTitle}/text/`
- `bookTitle` parameter

**Actions:**
1. Sanitizes book title
2. Reads all `.txt` files (excluding `complete.txt`)
3. Sorts files numerically
4. Combines all text with double newlines between files
5. Saves combined text

**Output:**
- `src/content/2.working/{sanitizedBookTitle}/text/complete.txt`

**Example:**
- Input: `src/content/2.working/Daniel_In_Babylon/text/1.txt`, `2.txt`, `3.txt`
- Output: `src/content/2.working/Daniel_In_Babylon/text/complete.txt`

---

### Step 3: Clean Text with AI (3.sanitize_text.mjs)
**Input:**
- `src/content/2.working/{sanitizedBookTitle}/text/complete.txt`
- `bookTitle` parameter

**Actions:**
1. Sanitizes book title
2. Reads complete.txt
3. Splits text into chunks (~3000 tokens each)
4. Sends each chunk to OpenAI GPT-4o-mini for cleaning
5. Removes OCR errors, page numbers, book title insertions
6. Fixes grammar and punctuation
7. Combines cleaned chunks
8. Creates output directory in DONE_DIR
9. Saves cleaned text

**Output:**
- `src/content/3.done/{sanitizedBookTitle}/{sanitizedBookTitle}.txt`

**Example:**
- Input: `src/content/2.working/Daniel_In_Babylon/text/complete.txt`
- Output: `src/content/3.done/Daniel_In_Babylon/Daniel_In_Babylon.txt`

---

### Step 4: Translate (4.translate.mjs) - OPTIONAL
**Condition:** Only runs if `language` is provided and not empty

**Input:**
- `src/content/2.working/{sanitizedBookTitle}/text/complete.txt`
- `bookTitle` parameter
- `language` parameter

**Actions:**
1. Sanitizes book title
2. Reads complete.txt from working directory
3. Splits text into chunks
4. Translates each chunk using OpenAI GPT-3.5-turbo
5. Combines translated chunks
6. Appends language to sanitized title: `{sanitizedBookTitle}_{language}`
7. Creates output directory in DONE_DIR
8. Saves translated text

**Output:**
- `src/content/3.done/{sanitizedBookTitle}_{language}/{sanitizedBookTitle}_{language}.txt`

**Example:**
- Input: `bookTitle = "Daniel In Babylon"`, `language = "italian"`
- Output: `src/content/3.done/Daniel_In_Babylon_italian/Daniel_In_Babylon_italian.txt`

**Important:** If no language is provided, this step is skipped and no language-suffixed directory is created.

---

### Step 5: Text-to-Speech (5.process_tts.mjs)
**Input:**
- Cleaned/translated text from DONE_DIR
- `voice` parameter
- `bookTitle` parameter
- `language` parameter (optional)

**Actions:**
1. Sanitizes book title
2. Appends language suffix ONLY if language is provided: `{sanitizedBookTitle}_{language}`
3. Determines source text file:
   - If language provided: `DONE_DIR/{sanitizedBookTitle}_{language}/{sanitizedBookTitle}_{language}.txt`
   - If no language: `DONE_DIR/{sanitizedBookTitle}/{sanitizedBookTitle}.txt`
4. Creates audio output directory: `WORKING_DIR/{sanitizedBookTitle}_{language}/audio/` or `WORKING_DIR/{sanitizedBookTitle}/audio/`
5. Splits text into chunks (max 4000 chars)
6. Converts each chunk to speech using OpenAI TTS
7. Saves audio chunks as numbered MP3 files

**Output:**
- `src/content/2.working/{sanitizedBookTitle}_{language}/audio/1.mp3` (if language provided)
- `src/content/2.working/{sanitizedBookTitle}_{language}/audio/2.mp3`
- ... OR ...
- `src/content/2.working/{sanitizedBookTitle}/audio/1.mp3` (if no language)
- `src/content/2.working/{sanitizedBookTitle}/audio/2.mp3`

**Example with language:**
- Input: `bookTitle = "Daniel In Babylon"`, `language = "italian"`
- Output dir: `src/content/2.working/Daniel_In_Babylon_italian/audio/`

**Example without language:**
- Input: `bookTitle = "Daniel In Babylon"`, `language = null`
- Output dir: `src/content/2.working/Daniel_In_Babylon/audio/`

---

### Step 6: Concatenate Audio (6.concatenate_audio.mjs + concat.sh)
**Input:**
- Audio chunks from `WORKING_DIR/{sanitizedTitle}/audio/`
- `bookTitle` parameter
- `language` parameter (optional)

**Actions:**
1. Sanitizes book title
2. Appends language suffix ONLY if language is provided
3. Verifies concat.sh script exists
4. Calls bash script with sanitized title
5. Script reads all MP3 files from working directory
6. Concatenates using FFmpeg with 128kbps bitrate
7. Saves final audio to DONE_DIR

**Output:**
- `src/content/3.done/{sanitizedBookTitle}_{language}/{sanitizedBookTitle}_{language}.mp3` (if language)
- `src/content/3.done/{sanitizedBookTitle}/{sanitizedBookTitle}.mp3` (if no language)

**Example with language:**
- Input: Audio chunks from `src/content/2.working/Daniel_In_Babylon_italian/audio/`
- Output: `src/content/3.done/Daniel_In_Babylon_italian/Daniel_In_Babylon_italian.mp3`

**Example without language:**
- Input: Audio chunks from `src/content/2.working/Daniel_In_Babylon/audio/`
- Output: `src/content/3.done/Daniel_In_Babylon/Daniel_In_Babylon.mp3`

---

## Final Output Structure

### Without Translation (language = null or empty)
```
src/content/3.done/
└── Daniel_In_Babylon/
    ├── Daniel_In_Babylon.txt    (cleaned text)
    └── Daniel_In_Babylon.mp3    (final audio)
```

### With Translation (language = "italian")
```
src/content/3.done/
├── Daniel_In_Babylon/
│   ├── Daniel_In_Babylon.txt    (cleaned English text)
│   └── Daniel_In_Babylon.mp3    (NOT CREATED - no audio for non-translated)
└── Daniel_In_Babylon_italian/
    ├── Daniel_In_Babylon_italian.txt    (translated text)
    └── Daniel_In_Babylon_italian.mp3    (final audio)
```

**Note:** When translation is requested, only the translated version gets audio generated.

---

## Key Fixes Applied

1. **Prevented "undefined" folders**: Added validation and proper handling of undefined/null values
2. **Consistent path handling**: All steps now use correct paths based on sanitized book title
3. **Language suffix logic**: Only appends `_{language}` when language is actually provided
4. **Error handling**: All log functions now properly throw errors instead of silently returning
5. **Directory structure**: Consistent use of `{bookTitle}/text/` and `{bookTitle}/audio/` in working dir
6. **concat.sh paths**: Updated to match actual directory structure

---

## Environment Variables Required

```
OPENAI_API_KEY=your_api_key
PENDING_DIR=./src/content/1.pending
WORKING_DIR=./src/content/2.working
DONE_DIR=./src/content/3.done
TEXT_LANG=eng
```

