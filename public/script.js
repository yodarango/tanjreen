class AudiobookConverter {
  constructor() {
    this.isProcessing = false;
    this.currentStep = 0;
    this.totalSteps = 5;

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
    this.voiceSamplePlayer = document.getElementById("voiceSamplePlayer");
  }

  setupEventListeners() {
    this.startBtn.addEventListener("click", () => this.startTransformation());
    this.playVoiceSampleBtn.addEventListener("click", () =>
      this.playVoiceSample()
    );
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
      console.error("Error playing voice sample:", error);
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
      }
    } catch (error) {
      console.error("Error loading images:", error);
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
      alert("Please enter a book title");
      this.resetStartButton();
      return;
    }

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
      console.error("Error starting transformation:", error);
      alert("Error starting transformation: " + error.message);
      this.resetStartButton();
    }
  }

  async pollProgress() {
    try {
      const response = await fetch("/api/progress");
      const data = await response.json();

      this.updateProgress(data.progress);
      this.updateSteps(data.currentStep);

      if (data.completed) {
        this.resetStartButton();
        this.updateStepStatus("step-complete", "completed", "✅");
        alert("🎉 Transformation completed successfully!");
      } else if (data.error) {
        this.resetStartButton();
        alert("❌ Transformation failed: " + data.error);
      } else {
        // Continue polling
        setTimeout(() => this.pollProgress(), 1000);
      }
    } catch (error) {
      console.error("Error checking progress:", error);
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
