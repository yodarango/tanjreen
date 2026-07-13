# Tanjreen API

The Tanjreen API lets you convert images, PDFs, or raw text into an audiobook MP3 in a single HTTP request. The pipeline runs in the background and streams progress back to you as Server-Sent Events (SSE).

---

## Authentication

All API endpoints require an API key. Set `API_KEY` in your environment (or `.env` file) before starting the server.

Provide the key in either:

- Header: `X-API-Key: your-api-key`
- Query parameter: `?apiKey=your-api-key`

```bash
curl -X POST https://your-server/api/transform \
  -H "X-API-Key: your-api-key" \
  ...
```

---

## Endpoints

### POST `/api/transform`

Start an audiobook transformation and receive real-time progress updates.

#### Content-Type

`multipart/form-data`

#### Request fields

| Field      | Type     | Required | Description                                                                 |
|------------|----------|----------|-----------------------------------------------------------------------------|
| `bookTitle`| string   | yes      | Title of the book. Used for the output file name.                          |
| `voice`    | string   | yes      | OpenAI TTS voice. Example: `echo`, `alloy`, `onyx`, `shimmer`.               |
| `language` | string   | no       | Target language for translation. See the list of supported languages below. |
| `text`     | string   | no*      | Raw text to convert. If provided, OCR is skipped.                           |
| `files`    | file[]   | no*      | Images or PDFs to process via OCR. At least one file or `text` is required. |

\* You must provide **either** `text` **or** at least one `files` entry.

#### Supported voices

`alloy`, `ash`, `ballad`, `coral`, `echo`, `fable`, `nova`, `onyx`, `sage`, `shimmer`, `verse`

#### Supported languages

`spanish`, `french`, `german`, `italian`, `portuguese`, `russian`, `japanese`, `korean`, `chinese`, `arabic`, `hindi`, `dutch`, `swedish`, `norwegian`, `danish`, `polish`, `turkish`, `greek`, `hebrew`, `thai`

#### Response

The response is an SSE stream (`text/event-stream`). Each line is a separate event.

```
event: status
data: {"requestId":"...","status":"started","bookTitle":"...","voice":"...","language":null,"hasText":true,"fileCount":0}

event: progress
data: {"step":3,"totalSteps":4,"progress":0,"message":"🧹 Step 3: Cleaning text with OpenAI...","currentStepProcess":{"totalItems":0,"currentItem":0}}

event: progress
data: {"step":3,"totalSteps":4,"progress":0,"message":"{\"type\":\"STEP_PROGRESS\",\"totalItems\":2,\"currentItem\":1}","currentStepProcess":{"totalItems":2,"currentItem":1}}

event: complete
data: {"success":true,"requestId":"...","bookTitle":"...","voice":"...","language":null,"outputFile":"My_Book.mp3","outputPath":"...","fileSize":1234567,"downloadUrl":"/api/download/{requestId}/My_Book"}
```

#### Event types

| Event     | Description                                                                 |
|-----------|-----------------------------------------------------------------------------|
| `status`  | Sent once when the request is accepted and the pipeline begins.             |
| `progress`| Sent whenever the pipeline logs a new step or sub-step progress update.     |
| `message` | Raw stderr lines that are not recognized as structured error events.        |
| `error`   | Sent when a step fails or the process exits with a non-zero code.           |
| `complete`| Sent once at the end with the result and a download URL.                    |

#### Progress payload

```json
{
  "step": 3,
  "totalSteps": 4,
  "progress": 75,
  "message": "✅ Step 3: Done cleaning text with OpenAI.",
  "currentStepProcess": {
    "totalItems": 5,
    "currentItem": 2
  }
}
```

- `step` — the pipeline step number currently running (1–7). When you provide `text`, steps 1 and 2 are skipped, so the first event will show `step: 3`.
- `totalSteps` — the number of steps that will run for this request (6 or 7 for OCR mode, 4 or 5 for text mode). It can be smaller than `step` when steps 1 and 2 are skipped.
- `progress` — approximate completion percentage (0–100).
- `message` — the log line from the pipeline.
- `currentStepProcess` — how many items the current step has processed so far.

#### Complete payload

```json
{
  "success": true,
  "requestId": "uuid",
  "bookTitle": "My Book",
  "voice": "echo",
  "language": null,
  "outputFile": "My_Book.mp3",
  "outputPath": "...",
  "fileSize": 1234567,
  "downloadUrl": "/api/download/{requestId}/My_Book"
}
```

#### Error payload

```json
{
  "message": "Process exited with code 1"
}
```

---

### GET `/api/download/:requestId/:filename`

Download the finished MP3 file from a completed transformation. The request directory intermediate files (`pending`, `working`) are cleaned up when the pipeline finishes, but the `done` directory is kept for downloads.

#### Authentication

Same API key authentication as `/api/transform`.

#### Parameters

- `requestId` — returned in the `status` and `complete` events.
- `filename` — the output folder name (e.g., `My_Book` or `My_Book_spanish`). The `complete` event returns the exact `downloadUrl`.

#### Example

```bash
curl -H "X-API-Key: your-api-key" \
  "https://your-server/api/download/{requestId}/My_Book" \
  --output My_Book.mp3
```

---

## Example: text-only request

```bash
API_KEY="your-api-key"

# 1. Start transformation
curl -N -X POST http://localhost:8011/api/transform \
  -H "X-API-Key: $API_KEY" \
  -F "bookTitle=My Book" \
  -F "voice=echo" \
  -F "text=Once upon a time..."

# 2. Download the result using the downloadUrl from the complete event
curl -H "X-API-Key: $API_KEY" \
  "http://localhost:8011/api/download/{requestId}/My_Book" \
  --output My_Book.mp3
```

---

## Example: OCR from images/PDFs

```bash
API_KEY="your-api-key"

# 1. Start transformation with files
curl -N -X POST http://localhost:8011/api/transform \
  -H "X-API-Key: $API_KEY" \
  -F "bookTitle=My Book" \
  -F "voice=echo" \
  -F "files=@page1.jpg" \
  -F "files=@page2.png" \
  -F "files=@chapter.pdf"

# 2. Download the result
curl -H "X-API-Key: $API_KEY" \
  "http://localhost:8011/api/download/{requestId}/My_Book" \
  --output My_Book.mp3
```

---

## Example: JavaScript client with SSE

```javascript
const form = new FormData();
form.append("bookTitle", "My Book");
form.append("voice", "echo");
form.append("text", "Once upon a time...");

const eventSource = new EventSource("");
// Note: EventSource cannot send custom headers or POST bodies.
// Use fetch with ReadableStream for full API control:

const response = await fetch("/api/transform", {
  method: "POST",
  headers: { "X-API-Key": "your-api-key" },
  body: form,
});

const reader = response.body.getReader();
const decoder = new TextDecoder();
let buffer = "";

while (true) {
  const { done, value } = await reader.read();
  if (done) break;
  buffer += decoder.decode(value, { stream: true });

  const lines = buffer.split("\n\n");
  buffer = lines.pop();

  for (const chunk of lines) {
    const eventLine = chunk.split("\n")[0]?.replace("event: ", "");
    const dataLine = chunk.split("\n")[1]?.replace("data: ", "");
    if (dataLine) {
      const data = JSON.parse(dataLine);
      console.log(eventLine, data);
    }
  }
}
```

---

## Configuration

Add `API_KEY` to your environment before starting the server:

```env
API_KEY=your-secure-api-key
```

For Docker, set it in your `.env` file or pass it directly:

```bash
API_KEY=your-secure-api-key docker-compose up -d
```

Per-request working files are stored under `./src/content/api_requests/{requestId}` and cleaned up automatically after the pipeline finishes, except for the final `done/{folder}/{folder}.mp3` file.

---

## Notes

- The API is independent of the browser UI authentication (JWT). The UI still uses the existing password login.
- The pipeline uses the same OCR, sanitization, translation, and TTS logic as the UI, so it behaves the same way.
- Long-running requests will keep the HTTP connection open for the entire transformation. Use a client that supports streaming responses.
