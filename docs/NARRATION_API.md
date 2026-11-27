# Narration-only API

This API wraps the existing `copySourceText`, `processTextToSpeech`, and
`concatenateAudioFiles` functions without changing them or the normal upload flow.
It deliberately skips sanitization, translation, OCR, emails, and production file
transfer. Files stay isolated under `API_REQUESTS_DIR/narrations/<jobId>`.

All routes use the existing `X-API-Key` authentication:

- `POST /api/narrations`: JSON up to 8 MiB with `jobId` (32 lowercase hexadecimal
  characters), `content` (whole nonempty document), `voice` (existing voice, default
  `echo`). HTTP 202 after preparing/persisting the job. Reusing an ID returns the same
  job rather than creating another paid narration.
- `GET /api/narrations/:id`: status, phase, progress, optional remaining-time estimate;
  finished jobs include `fileSize`. Progress is based on audio files actually saved.
- `GET /api/narrations/:id/audio`: only available after TTS and concatenation finish
  successfully. Returns the entire final `audio/mpeg` MP3, not chunks, text, or a ZIP.
  Running/failed jobs return HTTP 409.

FFmpeg is required as with the existing normal pipeline. An isolated child worker
uses the normal TTS/concatenation implementation; it shuts down if its parent server
disconnects. Failed and interrupted jobs are not silently retried or billed again;
the caller may request a new job ID. Finished files/status persist across restarts.

Intermediate working files are deleted once a job finishes or fails. Finished MP3s
and status remain on disk for recovery; manage retention of this directory. Jobs run
independently of normal uploads and may share OpenAI rate limits. Never expose API
keys to browsers. The Zapohteh integration downloads the finished MP3 server-to-server
and saves it inside that Virtual's `sounds/narration.mp3`.