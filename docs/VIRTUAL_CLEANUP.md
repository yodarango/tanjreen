# Zapohteh cleanup-only API

Set `ZAPOHTEH_BASE_URL` to Zapohteh's externally reachable `BASE_URL`. Zapohteh must
set `TANJREEN_API_KEY` to this app's existing `API_KEY`. Credentials stay server-side.

`POST /api/cleanup` uses `X-API-Key` authentication and accepts JSON up to 8 MiB:

- `jobId`: 32 lowercase hex characters.
- `bookTitle`: nonempty string.
- `sections`: nonempty array of nonempty chapter Markdown strings.
- `callbackUrl`: exactly `ZAPOHTEH_BASE_URL` plus `/api/virtual-cleanup/callback`.
- `callbackToken`: 64 lowercase hex characters, generated per job by Zapohteh.

HTTP 202 means the job was saved under `API_REQUESTS_DIR/cleanup-jobs`. A serial
worker reuses the text sanitizer, preserves Markdown headings, and never starts TTS,
translation, file transfer, or the interactive audiobook pipeline.

The final callback uses `Authorization: Bearer <callbackToken>` and sends
`{jobId, sections}` or `{jobId, error}`. Redirects are forbidden. Callback delivery
retries with backoff for 24 hours; queue state/results persist across restarts.
Delivered jobs are deleted. Undeliverable jobs remain on disk (including source or
cleaned text and callback credentials), so protect this directory and manage retention.
Interruptions before saving a result can repeat sanitization work on restart.

Zapohteh validates the token, original content revision, chapter count, headings,
and nonempty content before backing up and replacing chapter files. It times out
pending jobs after two hours and ignores later results. Both apps require the new code.
Use HTTPS in production; HTTP is available for local development.

For local development set `ZAPOHTEH_BASE_URL=http://localhost:8014` (the Go backend,
not the Vite frontend). `npm run dev` watches `.env` changes; restart any nodemon
supervisor that was launched before this watcher configuration was added. With
`npm start`, restart manually after changing `.env`.