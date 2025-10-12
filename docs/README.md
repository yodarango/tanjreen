# tangerin 🍊

Transform images into audiobooks using OCR and AI.

---

## 🚀 Quick Start

```bash
# Install dependencies
npm install

# Start the server
npm start

# Open browser to http://localhost:3000
```

---

## 📋 Requirements

- Node.js v14+
- Tesseract OCR
- FFmpeg
- OpenAI API Key

---

## ⚙️ Setup

Create a `.env` file:

```env
OPENAI_API_KEY=your-api-key-here
PENDING_DIR=./src/content/1.pending
WORKING_DIR=./src/content/2.working
DONE_DIR=./src/content/3.done
TEXT_LANG=eng
```

---

## 🎯 How to Use

1. **Start the server:** `npm start`
2. **Open browser:** http://localhost:3000
3. **Upload images:** Drag & drop or click to browse
4. **Configure:** Enter book title, select voice, optional language
5. **Transform:** Click "Start Transformation"
6. **Download:** Get your audiobook MP3

---

## 📖 Documentation

- [Process Flow](docs/PROCESS_FLOW.md) - Detailed transformation steps
- [Usage Guide](USAGE.md) - Complete usage instructions

---

## ✨ Features

- Drag & drop image upload
- Real-time progress tracking
- Multiple TTS voices
- Translation support
- Modern web interface
- Automatic audio concatenation

---

## 📝 License

ISC

