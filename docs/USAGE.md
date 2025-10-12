# tangerin 🍊

Transform images into audiobooks using OCR and AI.

---

## 🚀 Quick Start

### 1. Install Dependencies
```bash
npm install
```

### 2. Configure Environment
Create a `.env` file with your OpenAI API key:
```bash
OPENAI_API_KEY=your-api-key-here
PENDING_DIR=./src/content/1.pending
WORKING_DIR=./src/content/2.working
DONE_DIR=./src/content/3.done
TEXT_LANG=eng
```

### 3. Start the Server
```bash
npm start
```

Or for development with auto-reload:
```bash
npm run web
```

### 4. Open in Browser
Navigate to: **http://localhost:3000**

---

## 📖 How to Use

### Step 1: Upload Images
- Drag and drop images into the upload zone
- Or click to browse and select files
- Supported formats: JPG, PNG, GIF, BMP, TIFF, WebP, HEIC, HEIF

### Step 2: Configure
- **Book Title:** Enter the name of your book
- **Voice:** Select a voice for the audiobook
- **Language (optional):** Select a language for translation

### Step 3: Transform
- Click "Start Transformation"
- Watch the progress in real-time
- Wait for completion

### Step 4: Download
- Your audiobook will appear in the completed section
- Download the MP3 file
- Enjoy! 🎧

---

## 🔧 Process Flow

The transformation happens in these steps:

1. **OCR Processing** - Extract text from images using Tesseract
2. **Text Amalgamation** - Combine all text files into one
3. **Text Sanitization** - Clean and format the text using AI
4. **Translation (optional)** - Translate to selected language
5. **Text-to-Speech** - Convert text to audio using OpenAI TTS
6. **Audio Concatenation** - Combine all audio chunks into final audiobook

---

## 📁 Directory Structure

```
src/content/
├── 1.pending/     - Upload images here (via web interface)
├── 2.working/     - Temporary processing files
│   ├── text/      - OCR text files
│   └── audio/     - Audio chunks
└── 3.done/        - Final audiobooks
    ├── BookTitle/
    │   ├── BookTitle.txt
    │   └── BookTitle.mp3
    └── BookTitle_language/
        ├── BookTitle_language.txt
        └── BookTitle_language.mp3
```

---

## 🎯 Requirements

- **Node.js** 14 or higher
- **Tesseract OCR** (for image text extraction)
- **FFmpeg** (for audio concatenation)
- **OpenAI API Key** (for text cleaning, translation, and TTS)
- **Internet connection** (for API calls)

---

## 🛠️ Development

### Start with auto-reload:
```bash
npm run web
```

### Run individual steps manually:
```bash
# OCR processing
node src/1.process_images_with_ocr.mjs

# Amalgamate text
node src/2.amalgamate_text_files.mjs

# Sanitize text
node src/3.sanitize_text.mjs

# Translate (optional)
node src/4.translate.mjs

# Generate audio
node src/5.process_tts.mjs

# Concatenate audio
node src/6.concatenate_audio.mjs
```

---

## 🎨 Features

- ✅ **Drag & Drop Upload** - Easy image upload
- ✅ **Real-time Progress** - See transformation status
- ✅ **Multiple Voices** - Choose from various TTS voices
- ✅ **Translation Support** - Translate to different languages
- ✅ **Auto-cleanup** - Old files removed on new upload
- ✅ **Web Interface** - Clean, modern UI with charcoal & orange theme
- ✅ **Typewriter Font** - Space Mono for authentic feel

---

## 📝 Notes

- The web interface runs on **port 3000** by default
- Images are processed in the order they're uploaded
- Large books may take several minutes to process
- Keep the server running during transformation
- Check the terminal for detailed progress logs

---

## 🐛 Troubleshooting

### Server won't start:
- Check if port 3000 is already in use
- Make sure all dependencies are installed: `npm install`

### Upload fails:
- Check if `.env` file exists
- Verify directory permissions
- Check browser console for errors

### Transformation fails:
- Verify OpenAI API key is valid
- Check internet connection
- Look at terminal logs for specific errors
- Ensure Tesseract and FFmpeg are installed

---

## 🎉 That's It!

tangerin is now a simple web application. Just run `npm start` and open your browser to http://localhost:3000 to start converting images to audiobooks!

