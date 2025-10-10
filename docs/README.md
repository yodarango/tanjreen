# 🍊 Tangerin - OCR + Text-to-Speech Pipeline

Transform your images into complete audiobooks using OCR and AI. Tangerin provides a complete pipeline for processing images with OCR (Optical Character Recognition) and converting the extracted text to speech using OpenAI's TTS API.

## 📖 Documentation

For a detailed explanation of the complete process flow, including all steps, directory structure, and file paths, see:
**[PROCESS_FLOW.md](./PROCESS_FLOW.md)**

## Prerequisites

1. **Tesseract OCR**: You need to have Tesseract installed on your system

   - **macOS**: `brew install tesseract`
   - **Ubuntu/Debian**: `sudo apt-get install tesseract-ocr`
   - **Windows**: Download from [GitHub releases](https://github.com/UB-Mannheim/tesseract/wiki)

2. **OpenAI API Key**: Set your OpenAI API key in the `.env` file

## Setup

1. Install dependencies:

   ```bash
   npm install
   ```

2. Create your `.env` file with:
   ```
   OPENAI_API_KEY=your_openai_api_key_here
   BOOK_TITLE=Your Book Title Here
   ```

## Directory Structure

```
/images     - Place your image files here
/text       - OCR results will be saved here as numbered .txt files
/audio      - Generated audio files will be saved here
```

## Usage

### Option 1: Run OCR Only

Process images and extract text:

```bash
npm run ocr
```

### Option 2: Combine Text Files

Combine all individual text files into one complete.txt:

```bash
npm run combine
```

### Option 3: Clean Text with AI

Clean the combined text using OpenAI (removes page numbers, titles, errors):

```bash
npm run clean
```

### Option 4: Run TTS Only

Convert existing text files to speech:

```bash
npm run tts
```

### Option 5: Run Complete Pipeline

Process images with OCR, combine texts, clean with AI, and convert to speech:

```bash
npm run process-all
```

## How It Works

### OCR Processing (`ocr-processor.mjs`)

1. Scans the `/images` directory for image files
2. Automatically converts HEIC/HEIF files to JPEG (common on iOS devices)
3. Processes each image using Tesseract OCR
4. Saves extracted text as numbered files: `1.txt`, `2.txt`, etc.
5. Supports image formats: JPG, PNG, GIF, BMP, TIFF, WebP, HEIC, HEIF

### Text Combination (`text-combiner.mjs`)

1. Reads all numbered text files from `/text` directory
2. Combines them in numerical order (1.txt, 2.txt, 3.txt, etc.)
3. Adds file separators and headers for each section
4. Creates a single `complete.txt` file with all content
5. Provides statistics on total characters and files processed

### AI Text Cleaning (`text-cleaner.mjs`)

1. Reads the `complete.txt` file from `/text` directory
2. Splits text into chunks at sentence boundaries (never cuts words)
3. Sends each chunk to OpenAI for intelligent cleaning
4. Removes page numbers, book titles, OCR errors, and unwanted symbols
5. Fixes orthography errors and improves punctuation
6. Creates a cleaned `complete_cleaned.txt` file
7. Uses the book title from `.env` file for context

### Text-to-Speech (`index.mjs` and `process-all.mjs`)

1. Reads text files from `/text` directory
2. Splits long text into chunks (OpenAI has a 4000 character limit)
3. Converts text to speech using OpenAI's TTS API
4. Saves audio files as MP3 format

## Configuration

### OCR Settings

You can modify the Tesseract configuration in `ocr-processor.mjs`:

- `lang`: Language (default: "eng", change to "ita" for Italian)
- `oem`: OCR Engine Mode
- `psm`: Page Segmentation Mode

### TTS Settings

You can modify the OpenAI TTS settings in the speech creation:

- `model`: TTS model (default: "tts-1")
- `voice`: Voice type (options: alloy, echo, fable, onyx, nova, shimmer)

## File Naming

- Images are processed in alphabetical order
- Text files are numbered sequentially: `1.txt`, `2.txt`, `3.txt`, etc.
- Audio files maintain the same numbering: `1.mp3`, `2.mp3`, `3.mp3`, etc.
- Long texts are split into parts: `1_part1.mp3`, `1_part2.mp3`, etc.

## Error Handling

- If an image fails to process, an error message is saved to the corresponding text file
- The sequence numbering is maintained even if some images fail
- Detailed error messages are logged to the console

## Examples

1. Place images in `/images/` folder:

   ```
   /images/page1.jpg
   /images/page2.png
   /images/page3.heic  (iOS photos supported!)
   /images/page4.jpg
   ```

2. Run OCR:

   ```bash
   npm run ocr
   ```

3. Results in `/text/`:

   ```
   /text/1.txt  (from page1.jpg)
   /text/2.txt  (from page2.png)
   /text/3.txt  (from page3.jpg)
   ```

4. Combine texts (optional):

   ```bash
   npm run combine
   ```

   Results in:

   ```
   /text/complete.txt  (all files combined)
   ```

5. Run TTS:

   ```bash
   npm run tts
   ```

6. Results in `/audio/`:
   ```
   /audio/1.mp3
   /audio/2.mp3
   /audio/3.mp3
   ```
