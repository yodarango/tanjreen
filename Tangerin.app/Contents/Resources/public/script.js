class AudiobookConverter {
  constructor() {
    this.isProcessing = false;
    this.currentStep = 0;
    this.totalSteps = 5;
    this.consoleLines = [];

    this.initializeElements();
    this.setupEventListeners();
    this.loadImages();
    this.setupVoiceSamples();
  }

  initializeElements() {
    this.bookTitleInput = document.getElementById("bookTitle");
    this.voiceSelect = document.getElementById("voiceSelect");
    this.playVoiceSampleBtn = document.getElementById("playVoiceSample");
    this.imagesList = document.getElementById("imagesList");
    this.imagesCount = document.getElementById("imagesCount");
    this.startBtn = document.getElementById("startTransformation");
    this.progressFill = document.getElementById("progressFill");
    this.progressText = document.getElementById("progressText");
    this.console = document.getElementById("console");
    this.clearConsoleBtn = document.getElementById("clearConsole");
    this.downloadLogsBtn = document.getElementById("downloadLogs");
    this.voiceSamplePlayer = document.getElementById("voiceSamplePlayer");
  }

  setupEventListeners() {
    this.startBtn.addEventListener("click", () => this.startTransformation());
    this.playVoiceSampleBtn.addEventListener("click", () =>
      this.playVoiceSample()
    );
    this.clearConsoleBtn.addEventListener("click", () => this.clearConsole());
    this.downloadLogsBtn.addEventListener("click", () => this.downloadLogs());
    this.voiceSelect.addEventListener("change", () => this.updateVoiceSample());
  }

  setupVoiceSamples() {
    this.voiceSamples = {
      alloy: "/api/voice-sample/alloy",
      ash: "/api/voice-sample/ash",
      ballad: "/api/voice-sample/ballad",
      coral: "/api/voice-sample/coral",
      echo: "/api/voice-sample/echo",
      fable: "/api/voice-sample/fable",
      nova: "/api/voice-sample/nova",
      onyx: "/api/voice-sample/onyx",
      sage: "/api/voice-sample/sage",
      shimmer: "/api/voice-sample/shimmer",
      verse: "/api/voice-sample/verse",
    };
    this.updateVoiceSample();
  }

  updateVoiceSample() {
    const selectedVoice = this.voiceSelect.value;
    this.voiceSamplePlayer.src = this.voiceSamples[selectedVoice];
  }

  async playVoiceSample() {
    try {
      this.playVoiceSampleBtn.textContent = "🔄 Loading...";
      this.playVoiceSampleBtn.disabled = true;

      await this.voiceSamplePlayer.play();

      this.playVoiceSampleBtn.textContent = "🔊 Play Sample";
      this.playVoiceSampleBtn.disabled = false;
    } catch (error) {
      this.addConsoleMessage(
        "Error playing voice sample: " + error.message,
        "error"
      );
      this.playVoiceSampleBtn.textContent = "🔊 Play Sample";
      this.playVoiceSampleBtn.disabled = false;
    }
  }

  async loadImages() {
    try {
      const response = await fetch("/api/images");
      const images = await response.json();

      this.displayImages(images);
      this.imagesCount.textContent = images.length;

      if (images.length > 0) {
        this.startBtn.disabled = false;
        this.addConsoleMessage(
          `Found ${images.length} images ready for processing`,
          "success"
        );
      } else {
        this.addConsoleMessage(
          "No images found in /images directory",
          "warning"
        );
      }
    } catch (error) {
      this.addConsoleMessage("Error loading images: " + error.message, "error");
    }
  }

  displayImages(images) {
    if (images.length === 0) {
      this.imagesList.innerHTML = '<div class="loading">No images found</div>';
      return;
    }

    this.imagesList.innerHTML = images
      .map((image) => `<div class="image-item">${image}</div>`)
      .join("");
  }

  async startTransformation() {
    if (this.isProcessing) return;

    this.isProcessing = true;
    this.startBtn.disabled = true;
    this.startBtn.textContent = "🔄 Processing...";

    const bookTitle = this.bookTitleInput.value.trim();
    const voice = this.voiceSelect.value;

    if (!bookTitle) {
      this.addConsoleMessage("Please enter a book title", "error");
      this.resetStartButton();
      return;
    }

    this.addConsoleMessage("🚀 Starting transformation process...", "info");
    this.addConsoleMessage(`📖 Book: ${bookTitle}`, "info");
    this.addConsoleMessage(`🗣️ Voice: ${voice}`, "info");

    try {
      // Start the transformation process
      const response = await fetch("/api/start-transformation", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          bookTitle: bookTitle,
          voice: voice,
        }),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      // Start polling for progress updates
      this.pollProgress();
    } catch (error) {
      this.addConsoleMessage(
        "Error starting transformation: " + error.message,
        "error"
      );
      this.resetStartButton();
    }
  }

  async pollProgress() {
    try {
      const response = await fetch("/api/progress");
      const data = await response.json();

      this.updateProgress(data.progress);
      this.updateSteps(data.currentStep);

      if (data.messages && data.messages.length > 0) {
        data.messages.forEach((msg) => {
          this.addConsoleMessage(msg.text, msg.type || "info");
        });
      }

      if (data.completed) {
        this.addConsoleMessage(
          "🎉 Transformation completed successfully!",
          "success"
        );
        this.addConsoleMessage(
          `📁 Output saved to: ${data.outputPath}`,
          "success"
        );
        this.resetStartButton();
        this.updateStepStatus("step-complete", "completed", "✅");
      } else if (data.error) {
        this.addConsoleMessage(
          "❌ Transformation failed: " + data.error,
          "error"
        );
        this.resetStartButton();
      } else {
        // Continue polling
        setTimeout(() => this.pollProgress(), 1000);
      }
    } catch (error) {
      this.addConsoleMessage(
        "Error checking progress: " + error.message,
        "error"
      );
      this.resetStartButton();
    }
  }

  updateProgress(progress) {
    this.progressFill.style.width = progress + "%";
    this.progressText.textContent = Math.round(progress) + "%";
  }

  updateSteps(currentStep) {
    const steps = [
      "step-ocr",
      "step-combine",
      "step-clean",
      "step-tts",
      "step-complete",
    ];

    steps.forEach((stepId, index) => {
      const stepElement = document.getElementById(stepId);

      if (index < currentStep) {
        this.updateStepStatus(stepId, "completed", "✅");
      } else if (index === currentStep) {
        this.updateStepStatus(stepId, "active", "🔄");
      } else {
        this.updateStepStatus(stepId, "", "⏳");
      }
    });
  }

  updateStepStatus(stepId, className, statusIcon) {
    const stepElement = document.getElementById(stepId);
    stepElement.className = "step " + className;
    stepElement.querySelector(".step-status").textContent = statusIcon;
  }

  addConsoleMessage(message, type = "info") {
    const timestamp = new Date().toLocaleTimeString();
    const line = `[${timestamp}] ${message}`;

    this.consoleLines.push({ text: line, type: type });

    const lineElement = document.createElement("div");
    lineElement.className = `console-line ${type}`;
    lineElement.textContent = line;

    this.console.appendChild(lineElement);
    this.console.scrollTop = this.console.scrollHeight;
  }

  clearConsole() {
    this.console.innerHTML =
      '<div class="console-line">Console cleared...</div>';
    this.consoleLines = [];
  }

  downloadLogs() {
    const logs = this.consoleLines.map((line) => line.text).join("\n");
    const blob = new Blob([logs], { type: "text/plain" });
    const url = URL.createObjectURL(blob);

    const a = document.createElement("a");
    a.href = url;
    a.download = `audiobook-conversion-logs-${new Date()
      .toISOString()
      .slice(0, 19)}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  resetStartButton() {
    this.isProcessing = false;
    this.startBtn.disabled = false;
    this.startBtn.textContent = "🚀 Start Transformation";
  }
}

// Initialize the application when the page loads
document.addEventListener("DOMContentLoaded", () => {
  new AudiobookConverter();
});
