import fs from "node:fs/promises";
import path from "node:path";
import { cleanDocument, documentChunkCount } from "./3.sanitize_text.mjs";
import { authenticateApiKey } from "./middleware/apiKey.mjs";

// Durable cleanup-only queue; completely separate from audiobook working files.
export function registerCleanupApi(app, jsonParser) {
  const directory = path.resolve(process.env.API_REQUESTS_DIR || "./src/content/api_requests", "cleanup-jobs");
  let busy = false;
  const save = async (file, job) => {
    await fs.writeFile(`${file}.tmp`, JSON.stringify(job), { mode: 0o600 });
    await fs.rename(`${file}.tmp`, file);
  };
  const sendCallback = async (job, payload) => {
    const response = await fetch(job.callbackUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${job.callbackToken}` },
      body: JSON.stringify({ jobId: job.jobId, ...payload }),
      redirect: "error",
      signal: AbortSignal.timeout(10000),
    });
    await response.body?.cancel();
    if (!response.ok) throw new Error(`Callback HTTP ${response.status}`);
  };
  const reportProgress = async (job, phase, completedChunks, totalChunks, startedAt) => {
    const elapsed = startedAt ? (Date.now() - startedAt) / 1000 : 0;
    const remainingSeconds = completedChunks > 0 && completedChunks < totalChunks
      ? Math.max(1, Math.ceil(elapsed / completedChunks * (totalChunks - completedChunks))) : null;
    try {
      await sendCallback(job, { progress: { phase, completedChunks, totalChunks, remainingSeconds } });
    } catch (error) {
      // A transient progress failure must not discard cleaned work or fail the job.
      console.error(`Cleanup ${job.jobId} progress update failed:`, error.message);
    }
  };
  const tick = async () => {
    if (busy) return;
    busy = true;
    try {
      await fs.mkdir(directory, { recursive: true, mode: 0o700 });
      for (const name of await fs.readdir(directory)) {
        if (!/^[a-f0-9]{32}\.json$/.test(name)) continue;
        const file = path.join(directory, name);
        try {
          const job = JSON.parse(await fs.readFile(file, "utf8"));
          if (job.nextAttempt > Date.now()) continue;
          if (!job.result) {
            try {
              // Flatten old queued requests as well; chapter boundaries have no cleanup meaning.
              const content = typeof job.content === "string" ? job.content : (job.sections || []).join("\n\n");
              const totalChunks = documentChunkCount(content);
              const startedAt = Date.now();
              let completedChunks = 0;
              await reportProgress(job, "cleaning", 0, totalChunks, startedAt);
              const cleaned = await cleanDocument(content, job.bookTitle, async () => {
                completedChunks++;
                await reportProgress(job, "cleaning", completedChunks, totalChunks, startedAt);
              });
              job.result = { jobId: job.jobId, content: cleaned };
            } catch (error) {
              console.error(`Cleanup ${job.jobId} failed:`, error.message);
              job.result = { jobId: job.jobId, error: "Text sanitization failed" };
            }
            delete job.sections;
            delete job.content;
            await save(file, job);
          }
          if (Array.isArray(job.result.sections)) {
            job.result.content = job.result.sections.join("\n\n");
            delete job.result.sections;
            await save(file, job);
          }
          try {
            await sendCallback(job, job.result);
            await fs.unlink(file);
          } catch (error) {
            job.attempts = (job.attempts || 0) + 1;
            job.nextAttempt = Date.now() + Math.min(300000, 10000 * 2 ** Math.min(job.attempts, 5));
            console.error(`Cleanup ${job.jobId} callback failed:`, error.message);
            // Keep the result on disk for recovery, but stop retrying after 24 hours.
            if (Date.now() - job.createdAt > 86400000) job.nextAttempt = Number.MAX_SAFE_INTEGER;
            await save(file, job);
          }
        } catch (error) {
          console.error(`Could not process cleanup job ${name}:`, error.message);
        }
      }
    } catch (error) {
      console.error("Cleanup queue error:", error.message);
    } finally {
      busy = false;
    }
  };

  app.post("/api/cleanup", authenticateApiKey, jsonParser, async (req, res) => {
    const { jobId, bookTitle, content, callbackUrl, callbackToken } = req.body || {};
    const base = (process.env.ZAPOHTEH_BASE_URL || "").replace(/\/+$/, "");
    if (!base) return res.status(503).json({ error: "ZAPOHTEH_BASE_URL is not configured" });
    let allowed;
    try { allowed = new URL(`${base}/api/virtual-cleanup/callback`); } catch { return res.status(503).json({ error: "Invalid ZAPOHTEH_BASE_URL" }); }
    if (!["https:", "http:"].includes(allowed.protocol) || callbackUrl !== allowed.href) {
      return res.status(400).json({ error: "Callback URL is not allowed" });
    }
    if (typeof jobId !== "string" || !/^[a-f0-9]{32}$/.test(jobId) ||
        typeof callbackToken !== "string" || !/^[a-f0-9]{64}$/.test(callbackToken) ||
        typeof bookTitle !== "string" || !bookTitle.trim() || bookTitle.length > 2000 ||
        typeof content !== "string" || !content.trim()) {
      return res.status(400).json({ error: "Invalid cleanup request" });
    }
    try {
      await fs.mkdir(directory, { recursive: true, mode: 0o700 });
      const file = path.join(directory, `${jobId}.json`);
      try {
        await fs.writeFile(file, JSON.stringify({ jobId, bookTitle, content, callbackUrl, callbackToken, createdAt: Date.now() }), { flag: "wx", mode: 0o600 });
      } catch (error) {
        if (error.code !== "EEXIST") throw error;
      }
      res.status(202).json({ jobId, status: "queued" });
      void tick();
    } catch (error) {
      console.error("Could not enqueue cleanup:", error.message);
      res.status(500).json({ error: "Could not save cleanup job" });
    }
  });
  const timer = setInterval(() => void tick(), 10000);
  timer.unref();
  void tick();
}