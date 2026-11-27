import fs from "node:fs";
import path from "node:path";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import { authenticateApiKey } from "./middleware/apiKey.mjs";
import { validateTransformationRequest } from "./utils/validate.mjs";

// Separate API workspace: never touches interactive uploads, cleanup, or library transfer.
export function registerNarrationApi(app, jsonParser) {
  const root = path.resolve(process.env.API_REQUESTS_DIR || "./src/content/api_requests", "narrations");
  const worker = fileURLToPath(new URL("./narration_worker.mjs", import.meta.url));
  const active = new Set();
  const validID = (id) => typeof id === "string" && /^[a-f0-9]{32}$/.test(id);
  const directory = (id) => path.join(root, id);
  const save = (job) => {
    const filename = path.join(directory(job.id), "status.json");
    fs.writeFileSync(`${filename}.tmp`, JSON.stringify(job), { mode: 0o600 });
    fs.renameSync(`${filename}.tmp`, filename);
  };
  const load = (id) => {
    if (!validID(id)) return null;
    try {
      const job = JSON.parse(fs.readFileSync(path.join(directory(id), "status.json"), "utf8"));
      if (job.status === "running" && !active.has(id)) {
        job.status = "failed";
        job.error = "Tangereen restarted during narration. Please start a new narration.";
        save(job);
      }
      return job;
    } catch (error) {
      if (error.code === "ENOENT") return null;
      throw error;
    }
  };

  app.post("/api/narrations", authenticateApiKey, jsonParser, (req, res) => {
    const { jobId, content, voice = "echo" } = req.body || {};
    const validation = validateTransformationRequest("Narration", voice);
    if (!validID(jobId) || typeof content !== "string" || !content.trim() || !validation.isValid) {
      return res.status(400).json({ error: "Invalid narration request or voice" });
    }
    try {
      const previous = load(jobId);
      if (previous) return res.status(202).json(previous);
      const dir = directory(jobId);
      fs.mkdirSync(path.join(dir, "working", "text"), { recursive: true, mode: 0o700 });
      fs.mkdirSync(path.join(dir, "working", "audio"), { recursive: true });
      fs.mkdirSync(path.join(dir, "done"), { recursive: true });
      fs.writeFileSync(path.join(dir, "working", "text", "complete.txt"), content, { mode: 0o600 });
      const job = { id: jobId, status: "running", phase: "speech", progress: 0, voice, error: "", remainingSeconds: null };
      save(job);
      const startedAt = Date.now();
      let total = 0;
      let completed = 0;
      let pending = "";
      let stderr = "";
      active.add(jobId);
      const child = spawn(process.execPath, [worker], {
        cwd: process.cwd(),
        env: {
          ...process.env,
          // Relative paths also keep the existing concat script working when the repo path contains spaces.
          WORKING_DIR: path.relative(process.cwd(), path.join(dir, "working")),
          DONE_DIR: path.relative(process.cwd(), path.join(dir, "done")),
          NARRATION_VOICE: voice,
          INTERACTIVE_WORKER: "1",
        },
        detached: true,
        stdio: ["ignore", "pipe", "pipe", "ipc"],
      });
      child.stdout.on("data", (data) => {
        pending += data.toString();
        const lines = pending.split("\n");
        pending = lines.pop();
        for (const line of lines) {
          if (line.includes("Saved audio:") || line.includes("Reusing audio:")) completed++;
          try {
            const message = JSON.parse(line);
            if (message.type === "NARRATION_CONCATENATING") {
              job.phase = "concatenating";
              job.progress = 95;
              job.remainingSeconds = null;
            } else if (message.type === "STEP_PROGRESS" && job.phase === "speech") {
              total = message.totalItems;
            }
          } catch { /* Human-readable worker output is not a status message. */ }
          if (job.phase === "speech" && total > 0) {
            job.progress = Math.min(94, Math.floor(completed / total * 94));
            job.remainingSeconds = completed > 0 && completed < total
              ? Math.max(1, Math.ceil((Date.now() - startedAt) / 1000 / completed * (total - completed))) : null;
          }
        }
        save(job);
      });
      child.stderr.on("data", (data) => { stderr = (stderr + data.toString()).slice(-2000); });
      const finish = (error) => {
        if (!active.delete(jobId)) return;
        const output = path.join(dir, "done", "Narration", "Narration.mp3");
        const size = fs.existsSync(output) ? fs.statSync(output).size : 0;
        job.status = !error && size > 0 ? "completed" : "failed";
        job.phase = job.status;
        job.error = job.status === "failed" ? "Narration failed. Check Tangereen server logs and retry." : "";
        if (job.status === "completed") { job.progress = 100; job.fileSize = size; }
        job.remainingSeconds = null;
        save(job);
        if (error) console.error(`Narration ${jobId}:`, error.message, stderr);
        // Keep only the final concatenated output; never expose partial chunks.
        fs.rmSync(path.join(dir, "working"), { recursive: true, force: true });
      };
      child.once("error", finish);
      child.once("close", (code) => finish(code === 0 ? null : new Error(`Worker exited ${code}`)));
      return res.status(202).json(job);
    } catch (error) {
      console.error("Could not start API narration:", error.message);
      return res.status(500).json({ error: "Could not start narration" });
    }
  });

  app.get("/api/narrations/:id", authenticateApiKey, (req, res) => {
    try {
      const job = load(req.params.id);
      return job ? res.json(job) : res.status(404).json({ error: "Narration not found" });
    } catch { return res.status(500).json({ error: "Could not read narration status" }); }
  });
  app.get("/api/narrations/:id/audio", authenticateApiKey, (req, res) => {
    try {
      const job = load(req.params.id);
      if (!job) return res.status(404).json({ error: "Narration not found" });
      if (job.status !== "completed") return res.status(409).json({ error: "The full MP3 is not ready" });
      res.type("audio/mpeg");
      return res.download(path.join(directory(job.id), "done", "Narration", "Narration.mp3"), "narration.mp3");
    } catch { return res.status(500).json({ error: "Could not read finished narration" }); }
  });
}