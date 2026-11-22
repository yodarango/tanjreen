import { test } from "node:test";
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import http from "node:http";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { JSDOM } from "jsdom";

const root = process.cwd();
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function waitFor(fn, timeout = 15000) {
  const end = Date.now() + timeout;
  while (Date.now() < end) {
    const result = await fn();
    if (result) return result;
    await sleep(100);
  }
  throw new Error("Timed out waiting for test condition");
}

test("interactive jobs pause, retry the failed step, and retain completed audio", async (t) => {
  const temp = fs.mkdtempSync(path.join(os.tmpdir(), "tanjretry-"));
  const audio = fs.readFileSync(path.join(root, "public/voices/sample-echo.mp3"));
  let failSpeech = true;
  let failCleaning = true;
  const speechCalls = [];
  const mock = http.createServer(async (req, res) => {
    let body = "";
    for await (const chunk of req) body += chunk;
    const request = JSON.parse(body);
    if (req.url === "/v1/audio/speech") {
      speechCalls.push(request.input);
      if (failSpeech && request.input.includes("B")) {
        res.writeHead(400, { "Content-Type": "application/json" });
        return res.end(JSON.stringify({ error: { message: "speech test failure" } }));
      }
      res.writeHead(200, { "Content-Type": "audio/mpeg" });
      return res.end(audio);
    }
    if (req.url === "/v1/chat/completions") {
      if (failCleaning) {
        res.writeHead(400, { "Content-Type": "application/json" });
        return res.end(JSON.stringify({ error: { message: "cleaning test failure" } }));
      }
      res.writeHead(200, { "Content-Type": "application/json" });
      return res.end(JSON.stringify({ choices: [{ message: { content: "Cleaned text." } }] }));
    }
    res.writeHead(404).end();
  });
  await new Promise((resolve) => mock.listen(0, "127.0.0.1", resolve));
  const reserve = http.createServer();
  await new Promise((resolve) => reserve.listen(0, "127.0.0.1", resolve));
  const port = reserve.address().port;
  await new Promise((resolve) => reserve.close(resolve));
  const server = spawn(process.execPath, ["server.mjs"], {
    cwd: root,
    env: {
      ...process.env,
      PORT: String(port), AUTH_PASSWORD: "test-password", JWT_SECRET: "test-secret", API_KEY: "test-api-key",
      OPENAI_API_KEY: "test-key", OPENAI_BASE_URL: `http://127.0.0.1:${mock.address().port}/v1`,
      WORKING_DIR: path.join(temp, "working"), DONE_DIR: path.join(temp, "done"),
      PENDING_DIR: path.join(temp, "pending"), EMAIL_USER: "", EMAIL_PASSWORD: "", EMAIL_TO: "",
      API_REQUESTS_DIR: path.join(temp, "api"),
    },
    stdio: "ignore",
  });
  t.after(async () => {
    server.kill("SIGTERM");
    await new Promise((resolve) => mock.close(resolve));
    fs.rmSync(temp, { recursive: true, force: true });
  });
  const base = `http://127.0.0.1:${port}`;
  await waitFor(async () => {
    try { return (await fetch(`${base}/login`)).ok; } catch { return false; }
  });
  const login = await fetch(`${base}/api/login`, {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ password: "test-password" }),
  });
  const { token } = await login.json();
  const headers = { Authorization: `Bearer ${token}`, "Content-Type": "application/json" };
  const post = (url, body = {}) => fetch(`${base}${url}`, { method: "POST", headers, body: JSON.stringify(body) });
  const progress = async () => (await fetch(`${base}/api/progress`, { headers })).json();

  assert.equal((await post("/api/retry-step")).status, 409);
  const text = `${"A".repeat(3900)}. ${"B".repeat(3900)}.`;
  assert.equal((await post("/api/start-transformation-from-text", {
    bookTitle: "Retry test", voice: "echo", text, sanitize: false,
  })).status, 200);
  let state = await waitFor(async () => { const s = await progress(); return s.paused && s; });
  assert.equal(state.failedStep, 5);
  assert.match(state.error, /speech test failure/);
  assert.equal(state.isRunning, true);
  assert.equal((await post("/api/start-transformation-from-text", { bookTitle: "Other", voice: "echo", text })).status, 400);
  assert.equal((await post("/api/clear-pending")).status, 409);
  assert.equal(speechCalls.length, 2);
  assert.ok(fs.existsSync(path.join(temp, "working/audio/1.mp3")));
  assert.equal((await post("/api/retry-step")).status, 200);
  state = await waitFor(async () => { const s = await progress(); return s.paused && speechCalls.length >= 3 && s; });
  assert.equal(state.failedStep, 5);
  assert.equal(speechCalls.filter((input) => input.includes("A")).length, 1);
  failSpeech = false;
  assert.equal((await post("/api/retry-step")).status, 200);
  state = await waitFor(async () => { const s = await progress(); return (s.completed || (!s.isRunning && s.error)) && s; });
  assert.equal(state.completed, true, state.error);
  assert.ok(fs.existsSync(path.join(temp, "done/Retry_test/Retry_test.mp3")));
  assert.equal(speechCalls.filter((input) => input.includes("A")).length, 1);

  assert.equal((await post("/api/start-transformation-from-text", {
    bookTitle: "Cleaning test", voice: "echo", text: "Some source text.", sanitize: true,
  })).status, 200);
  state = await waitFor(async () => { const s = await progress(); return s.paused && s; });
  assert.equal(state.failedStep, 3);
  assert.match(state.error, /cleaning test failure/);
  failCleaning = false;
  assert.equal((await post("/api/retry-step")).status, 200);
  state = await waitFor(async () => { const s = await progress(); return (s.completed || (!s.isRunning && s.error)) && s; });
  assert.equal(state.completed, true, state.error);
  assert.equal(fs.readFileSync(path.join(temp, "done/Cleaning_test/Cleaning_test.txt"), "utf8"), "Cleaned text.");

  failCleaning = true;
  const stream = await fetch(`${base}/api/transform`, {
    method: "POST",
    headers: { "X-API-Key": "test-api-key", "Content-Type": "application/json" },
    body: JSON.stringify({ bookTitle: "API fail", voice: "echo", text: "Text", sanitize: true }),
    signal: AbortSignal.timeout(10000),
  });
  const events = await stream.text();
  assert.match(events, /event: error/);
  assert.match(events, /cleaning test failure/);

  assert.equal((await post("/api/start-transformation", { bookTitle: "Missing files", voice: "echo" })).status, 200);
  state = await waitFor(async () => { const s = await progress(); return s.paused && s; });
  assert.equal(state.failedStep, 1);
  assert.match(state.error, /directory does not exist/);
  assert.equal((await post("/api/retry-step")).status, 200);
  await waitFor(async () => { const s = await progress(); return s.paused && s.failedStep === 1; });
});

test("converter markup includes an accessible sanitize switch and retry controls", () => {
  const dom = new JSDOM(fs.readFileSync(path.join(root, "public/index.html"), "utf8"));
  const document = dom.window.document;
  const toggle = document.querySelector("#sanitizeToggle");
  assert.equal(toggle.checked, true);
  assert.equal(toggle.labels.length, 1);
  assert.ok(toggle.nextElementSibling.classList.contains("sanitize-switch-track"));
  assert.ok(document.querySelector("#retryPanel #retryStep"));
  assert.ok(document.querySelector("#transformationFormFields #languageSelect"));
  assert.ok(document.querySelector("#transformationFormFields #startTransformation"));
});

test("reloading the converter displays a paused step and sends retry", async () => {
  const dom = new JSDOM(fs.readFileSync(path.join(root, "public/index.html"), "utf8"), {
    url: "http://localhost/", runScripts: "outside-only",
  });
  const { window } = dom;
  window.localStorage.setItem("authToken", "token");
  window.AppUI = { error: () => {}, success: () => {}, warning: () => {} };
  let retries = 0;
  const paused = {
    isRunning: true, paused: true, failedStep: 5, currentStep: 4,
    progress: 50, error: "temporary failure", language: null,
    currentStepProcess: { currentItem: 1, totalItems: 2 },
  };
  window.fetch = async (url, options = {}) => {
    if (url === "/api/progress") return { ok: true, json: async () => paused };
    if (url === "/api/images") return { ok: true, json: async () => [] };
    if (url === "/api/retry-step" && options.method === "POST") {
      retries++;
      return { ok: true, json: async () => ({ success: true }) };
    }
    throw new Error(`Unexpected request: ${url}`);
  };
  window.eval(fs.readFileSync(path.join(root, "public/script.js"), "utf8"));
  await waitFor(() => window.document.querySelector("#retryError").textContent.includes("temporary failure"));
  assert.equal(window.document.querySelector("#transformationStatusTitle").textContent, "Transformation paused");
  assert.ok(window.document.querySelector("#step-tts").classList.contains("failed"));
  assert.ok(window.document.querySelector("#step-translate").classList.contains("hidden"));
  window.document.querySelector("#retryStep").click();
  await waitFor(() => retries === 1);
  dom.window.close();
});