# Tanjreen 🍊

Transform images into audiobooks using OCR and AI.

---

## Quick Start

### Docker (Recommended)

```bash
# Start on port 8011
docker-compose up -d

# Access at http://localhost:8011
# Or http://anjreen.danielrangel.com:8011 (after hosts file setup)
```

### Local

```bash
npm install
npm start
# Access at http://localhost:3000
```

---

## Requirements

### Docker

- Docker & Docker Compose
- OpenAI API Key

### Local

- Node.js v14+
- Tesseract OCR
- FFmpeg
- OpenAI API Key

---

## Configuration

Create `.env` file:

```env
OPENAI_API_KEY=your-api-key-here
PENDING_DIR=./src/content/1.pending
WORKING_DIR=./src/content/2.working
DONE_DIR=./src/content/3.done
TEXT_LANG=eng
```

---

## How to Use

1. Start the server (Docker or local)
2. Open browser to the URL
3. Drag & drop images/PDFs or click to browse
4. Enter book title, select voice, optional language
5. Click "Start Transformation"
6. Download your audiobook MP3

---

## Docker Commands

```bash
# Start in background
docker-compose up -d

# Stop
docker-compose down

# View logs
docker-compose logs -f

# Restart
docker-compose restart

# Rebuild
docker-compose up -d --build

# Check status
docker-compose ps
```

---

## Local Domain Setup

To use `anjreen.danielrangel.com` instead of `localhost:8011`:

**macOS/Linux:**

```bash
sudo nano /etc/hosts
```

Add line:

```
127.0.0.1 tanjreen.danielrangel.com
```

**Windows:**
Edit `C:\Windows\System32\drivers\etc\hosts` as Administrator, add:

```
127.0.0.1 tanjreen.danielrangel.com
```

Access at: `http://tanjreen.danielrangel.com:8011`

---

## Process Flow

1. **Text Extraction** - Extract text from images (Tesseract OCR) or PDFs (pdf-parse)
2. **Text Amalgamation** - Combine all text files
3. **Text Sanitization** - Clean and format with AI (OpenAI GPT)
4. **Translation** (optional) - Translate to selected language (OpenAI)
5. **Text-to-Speech** - Convert to audio (OpenAI TTS)
6. **Audio Concatenation** - Combine chunks into final MP3 (FFmpeg)

---

## Directory Structure

```
src/content/
├── 1.pending/     - Uploaded images/PDFs (cleared on each upload)
├── 2.working/     - Temporary processing files
│   ├── text/      - Extracted text files, complete.txt
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

## Features

- Drag & drop image/PDF upload
- PDF text extraction (no OCR needed for PDFs)
- Image OCR processing (Tesseract)
- Real-time progress tracking
- Multiple TTS voices (alloy, echo, fable, onyx, nova, shimmer)
- Translation support (50+ languages)
- Auto-cleanup of pending directory
- Modern UI (charcoal background, orange accents, Space Mono font)
- Docker support with auto-restart
- Runs in background

---

## API Endpoints

```
GET  /api/images              - List images in pending directory
GET  /api/voices              - List available TTS voices
GET  /api/languages           - List available translation languages
GET  /api/completed           - List completed audiobooks
GET  /api/progress            - Get transformation progress
POST /api/clear-pending       - Clear pending directory
POST /api/upload-images       - Upload images (multipart/form-data)
POST /api/start-transformation - Start the transformation process
GET  /api/download/:folder/:file - Download completed files
```

---

## Manual Processing

Run individual steps:

```bash
node src/1.process_images_with_ocr.mjs
node src/2.amalgamate_text_files.mjs
node src/3.sanitize_text.mjs
node src/4.translate.mjs
node src/5.process_tts.mjs
node src/6.concatenate_audio.mjs
```

---

## Docker Details

**Container includes:**

- Node.js 18
- Tesseract OCR (English)
- FFmpeg
- All npm dependencies

**Port:** 8011 (configurable)

**Restart policy:** `unless-stopped` (auto-starts on boot, survives sleep/wake)

**Volumes:** `./src/content` mounted for data persistence

**Sleep/Wake:** Container automatically resumes when laptop wakes

---

## Troubleshooting

**Container won't start:**

```bash
docker-compose logs
docker-compose up -d --build
```

**Port 8011 in use:**

```bash
lsof -i :8011
# Or change port in docker-compose.yml
```

**Upload fails:**

```bash
chmod -R 755 src/content
```

**Transformation fails:**

- Check OpenAI API key in `.env`
- Check logs: `docker-compose logs -f`
- Verify internet connection

**Can't access domain:**

- Check `/etc/hosts` file has the entry
- Flush DNS cache: `sudo dscacheutil -flushcache; sudo killall -HUP mDNSResponder`

---

## Files

```
.
├── Dockerfile              - Container definition
├── docker-compose.yml      - Docker Compose config
├── .dockerignore          - Build exclusions
├── .env                   - Environment variables (create this)
├── server.mjs             - Express web server
├── package.json           - Dependencies
├── public/                - Web interface
│   ├── index.html
│   ├── script.js
│   └── styles.css
└── src/
    ├── 1.process_images_with_ocr.mjs
    ├── 2.amalgamate_text_files.mjs
    ├── 3.sanitize_text.mjs
    ├── 4.translate.mjs
    ├── 5.process_tts.mjs
    ├── 6.concatenate_audio.mjs
    ├── process.web.mjs    - Web-based processing
    ├── content/           - Data directories
    ├── scripts/
    │   └── concat.sh      - Audio concatenation script
    └── utils/
        └── sanitize.mjs   - Filename sanitization
```

---

## License

ISC
