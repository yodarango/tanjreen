import { test } from "node:test";
import assert from "node:assert/strict";
import { spawn, execFileSync } from "node:child_process";
import { once } from "node:events";
import http from "node:http";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { JSDOM } from "jsdom";

const root = process.cwd();
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
async function waitFor(fn, timeout = 15000) {
  const deadline = Date.now() + timeout;
  while (Date.now() < deadline) {
    const result = await fn();
    if (result) return result;
    await sleep(50);
  }
  throw new Error("Timed out waiting for condition");
}

test("cancel running and paused jobs, preserve files and existing books, and download unfinished snapshots", async (t) => {
  const temp = fs.mkdtempSync(path.join(os.tmpdir(), "tanjcancel-"));
  const audio = fs.readFileSync(path.join(root, "public/voices/sample-echo.mp3"));
  let blockSpeech = false;
  let failedSpeech = false;
  let blockedRequest = null;
  const mock = http.createServer(async (req, res) => {
    let body = "";
    for await (const chunk of req) body += chunk;
    const input = JSON.parse(body).input;
    if (failedSpeech && input.includes("B")) {
      res.writeHead(400, { "Content-Type": "application/json" });
      return res.end(JSON.stringify({ error: { message: "expected failure" } }));
    }
    if (blockSpeech) { blockedRequest = res; return; }
    res.writeHead(200, { "Content-Type": "audio/mpeg" });
    res.end(audio);
  });
  await new Promise((resolve) => mock.listen(0, "127.0.0.1", resolve));
  const reserve = http.createServer();
  await new Promise((resolve) => reserve.listen(0, "127.0.0.1", resolve));
  const port = reserve.address().port;
  await new Promise((resolve) => reserve.close(resolve));
  const bin = path.join(temp, "bin");
  fs.mkdirSync(bin);
  const marker = path.join(temp, "ocr-child-pid");
  fs.writeFileSync(path.join(bin, "tesseract"), `#!/bin/sh\necho $$ > '${marker}'\ntrap '' TERM\nwhile :; do sleep 1; done\n`, { mode: 0o755 });
  const server = spawn(process.execPath, ["server.mjs"], {
    cwd: root,
    env: {
      ...process.env, PORT: String(port), PATH: `${bin}:${process.env.PATH}`,
      AUTH_PASSWORD: "password", JWT_SECRET: "secret", OPENAI_API_KEY: "test",
      OPENAI_BASE_URL: `http://127.0.0.1:${mock.address().port}/v1`,
      WORKING_DIR: path.join(temp, "working"), DONE_DIR: path.join(temp, "done"),
      PENDING_DIR: path.join(temp, "pending"), TEXT_LANG: "eng",
      EMAIL_USER: "", EMAIL_PASSWORD: "", EMAIL_TO: "",
    }, stdio: "ignore",
  });
  t.after(async () => {
    blockedRequest?.destroy();
    server.kill("SIGTERM");
    if (server.exitCode === null && server.signalCode === null) await once(server, "close");
    mock.closeAllConnections();
    await new Promise((resolve) => mock.close(resolve));
    fs.rmSync(temp, { recursive: true, force: true });
  });
  const base = `http://127.0.0.1:${port}`;
  await waitFor(async () => { try { return (await fetch(`${base}/login`)).ok; } catch { return false; } });
  const auth = await fetch(`${base}/api/login`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ password: "password" }) });
  const token = (await auth.json()).token;
  const headers = { Authorization: `Bearer ${token}`, "Content-Type": "application/json" };
  const post = (url, body = {}) => fetch(`${base}${url}`, { method: "POST", headers, body: JSON.stringify(body) });
  const progress = async () => (await fetch(`${base}/api/progress`, { headers })).json();
  const waitState = (predicate) => waitFor(async () => { const state = await progress(); return predicate(state) && state; });

  fs.mkdirSync(path.join(temp, "done/Existing"), { recursive: true });
  fs.writeFileSync(path.join(temp, "done/Existing/Existing.txt"), "old book");
  blockSpeech = true;
  assert.equal((await post("/api/start-transformation-from-text", { bookTitle: "Existing", voice: "echo", text: "New source text.", sanitize: false })).status, 200);
  let state = await waitState((s) => s.currentStep === 4 && blockedRequest);
  assert.equal(fs.readFileSync(path.join(temp, "done/Existing/Existing.txt"), "utf8"), "old book");
  assert.equal((await post("/api/cancel-transformation", { jobId: "old-job" })).status, 409);
  const cancelled = await post("/api/cancel-transformation", { jobId: state.jobId });
  assert.equal(cancelled.status, 200);
  const { itemName } = await cancelled.json();
  state = await progress();
  assert.equal(state.cancelled, true);
  assert.equal(state.isRunning, false);
  assert.equal(state.completed, false);
  assert.equal(fs.readFileSync(path.join(temp, "done/Existing/Existing.txt"), "utf8"), "old book");
  assert.equal(fs.readFileSync(path.join(temp, "done", itemName, "text/complete.txt"), "utf8"), "New source text.");
  assert.equal(fs.readFileSync(path.join(temp, "done", itemName, "output/Existing/Existing.txt"), "utf8"), "New source text.");
  const library = await (await fetch(`${base}/api/content`, { headers })).json();
  assert.equal(library.items.find((item) => item.name === itemName).unfinished, true);
  assert.equal(library.items.find((item) => item.name === itemName).title, "Existing");
  const download = await fetch(`${base}/api/content/download/${encodeURIComponent(itemName)}`, { headers });
  assert.equal(download.status, 200);
  const zipPath = path.join(temp, "unfinished.zip");
  fs.writeFileSync(zipPath, Buffer.from(await download.arrayBuffer()));
  const listing = execFileSync("unzip", ["-l", zipPath], { encoding: "utf8" });
  assert.match(listing, /text\/complete.txt/);
  assert.match(listing, /README.txt/);
  assert.equal((await post("/api/cancel-transformation", { jobId: state.jobId })).status, 409);

  blockSpeech = false;
  failedSpeech = true;
  const text = `${"A".repeat(3900)}. ${"B".repeat(3900)}.`;
  assert.equal((await post("/api/start-transformation-from-text", { bookTitle: "Paused", voice: "echo", text, sanitize: false })).status, 200);
  state = await waitState((s) => s.paused);
  assert.equal(state.failedStep, 5);
  // Saving failure must not release the lock or discard the working files.
  fs.renameSync(path.join(temp, "done"), path.join(temp, "done-backup"));
  fs.writeFileSync(path.join(temp, "done"), "not a directory");
  assert.equal((await post("/api/cancel-transformation", { jobId: state.jobId })).status, 500);
  state = await progress();
  assert.equal(state.savePending, true);
  assert.equal(state.isRunning, true);
  assert.equal((await post("/api/start-transformation-from-text", { bookTitle: "Other", voice: "echo", text })).status, 400);
  fs.unlinkSync(path.join(temp, "done"));
  fs.renameSync(path.join(temp, "done-backup"), path.join(temp, "done"));
  const pausedCancel = await post("/api/cancel-transformation", { jobId: state.jobId });
  assert.equal(pausedCancel.status, 200);
  const pausedName = (await pausedCancel.json()).itemName;
  assert.ok(fs.existsSync(path.join(temp, "done", pausedName, "audio/1.mp3")));
  assert.equal((await post("/api/retry-step")).status, 409);

  fs.mkdirSync(path.join(temp, "pending"), { recursive: true });
  fs.writeFileSync(path.join(temp, "pending", "page.png"), "test input");
  assert.equal((await post("/api/start-transformation", { bookTitle: "OCR", voice: "echo" })).status, 200);
  state = await waitState(() => fs.existsSync(marker));
  const pid = Number(fs.readFileSync(marker, "utf8"));
  const ocrCancel = await post("/api/cancel-transformation", { jobId: state.jobId });
  assert.equal(ocrCancel.status, 200);
  const ocrName = (await ocrCancel.json()).itemName;
  assert.equal(fs.readFileSync(path.join(temp, "done", ocrName, "source-files/page.png"), "utf8"), "test input");
  await waitFor(() => { try { process.kill(pid, 0); return false; } catch (e) { return e.code === "ESRCH"; } });
});

test("library cards show unfinished status and custom confirmation gates deletion", async () => {
  const dom = new JSDOM(fs.readFileSync(path.join(root, "public/content.html"), "utf8"), { url: "http://localhost/", runScripts: "outside-only" });
  const { window } = dom;
  window.localStorage.setItem("authToken", "token");
  let accepted = false;
  let deletions = 0;
  window.AppUI = { confirm: async () => accepted, success: () => {}, error: () => {} };
  window.fetch = async (url, options = {}) => {
    if (url === "/api/progress") return { ok: true };
    if (url === "/api/content") return { ok: true, json: async () => ({ items: [
      { name: "snapshot", title: "My book", unfinished: true, type: "folder", size: 10, fileCount: 2, createdAt: new Date().toISOString() },
    ] }) };
    if (options.method === "DELETE") { deletions++; return { ok: true, json: async () => ({ message: "Deleted" }) }; }
    throw new Error(`Unexpected request ${url}`);
  };
  window.eval(fs.readFileSync(path.join(root, "public/content.js"), "utf8"));
  const card = await waitFor(() => window.document.querySelector(".content-grid .content-card"));
  assert.equal(card.querySelector("[data-title]").textContent, "My book");
  assert.equal(card.querySelector("[data-unfinished]").classList.contains("hidden"), false);
  assert.equal(card.querySelector("[data-sync-btn]").classList.contains("hidden"), true);
  assert.equal(card.querySelector("[data-download-btn]").disabled, false);
  card.querySelector("[data-delete-btn]").click();
  await sleep(20);
  assert.equal(deletions, 0);
  accepted = true;
  card.querySelector("[data-delete-btn]").click();
  await waitFor(() => deletions === 1);
  dom.window.close();
});

test("cancel button asks for confirmation and sends the displayed job id", async () => {
  const dom = new JSDOM(fs.readFileSync(path.join(root, "public/index.html"), "utf8"), { url: "http://localhost/", runScripts: "outside-only" });
  const { window } = dom;
  window.localStorage.setItem("authToken", "token");
  let confirmed = false;
  let requests = 0;
  let sentId;
  window.AppUI = { confirm: async () => confirmed, success: () => {}, error: () => {}, warning: () => {}, info: () => {} };
  window.fetch = async (url, options = {}) => {
    if (url === "/api/progress") return { ok: true, json: async () => ({
      jobId: "job-123", isRunning: true, progress: 20, currentStep: 2,
      currentStepProcess: { currentItem: 0, totalItems: 1 },
    }) };
    if (url === "/api/images") return { ok: true, json: async () => [] };
    if (url === "/api/cancel-transformation") {
      requests++;
      sentId = JSON.parse(options.body).jobId;
      return { ok: true, json: async () => ({ success: true }) };
    }
    throw new Error(`Unexpected request ${url}`);
  };
  window.eval(fs.readFileSync(path.join(root, "public/script.js"), "utf8"));
  const button = window.document.querySelector("#cancelTransformation");
  await waitFor(() => !button.disabled && !window.document.querySelector("#transformationInProgress").classList.contains("hidden"));
  button.click();
  await sleep(30);
  assert.equal(requests, 0);
  confirmed = true;
  button.click();
  await waitFor(() => requests === 1);
  assert.equal(sentId, "job-123");
  dom.window.close();
});