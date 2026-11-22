import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { JSDOM, VirtualConsole } from "jsdom";

const root = process.cwd();
const html = fs.readFileSync(path.join(root, "public/index.html"), "utf8");
const script = fs.readFileSync(path.join(root, "public/script.js"), "utf8");

for (const outcome of ["completed", "cancelled"]) {
  test(`${outcome} clears browser storage and reloads`, async () => {
    const errors = [];
    const virtualConsole = new VirtualConsole();
    virtualConsole.on("jsdomError", (error) => errors.push(error));
    const dom = new JSDOM(html, {
      url: "http://localhost/", runScripts: "outside-only", virtualConsole,
    });
    const { window } = dom;
    const addListener = window.document.addEventListener.bind(window.document);
    window.document.addEventListener = (type, listener, options) => {
      if (type !== "DOMContentLoaded") addListener(type, listener, options);
    };
    window.localStorage.setItem("authToken", "token");
    window.localStorage.setItem("draft", "old text");
    window.sessionStorage.setItem("draft", "old text");
    window.fetch = async () => ({ json: async () => ({
      [outcome]: true, isRunning: false, progress: 100, currentStep: 7,
    }) });
    window.eval(`${script}\nwindow.AudiobookConverter = AudiobookConverter;`);
    const converter = Object.create(window.AudiobookConverter.prototype);
    converter.getAuthHeaders = () => ({});
    converter.updateProgress = () => {};
    converter.updateSteps = () => {};
    converter.retryPanel = window.document.getElementById("retryPanel");
    converter.cancelBtn = window.document.getElementById("cancelTransformation");
    converter.processingIndicator = window.document.getElementById("processingIndicator");
    converter.transformationStatusTitle = window.document.getElementById("transformationStatusTitle");
    converter.transformationStatusText = window.document.getElementById("transformationStatusText");
    await converter.pollProgress();
    assert.equal(window.localStorage.length, 0);
    assert.equal(window.sessionStorage.length, 0);
    // jsdom reports reload as unsupported navigation instead of navigating.
    assert.equal(errors.filter((error) => /not implemented.*navigation/i.test(error.message)).length, 1);
    dom.window.close();
  });
}