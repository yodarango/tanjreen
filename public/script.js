class AudiobookConverter {
  constructor() {
    this.isProcessing = false;
    this.currentStep = 0;
    this.totalSteps = 5;

    this.initializeElements();
    this.setupEventListeners();
    this.loadImages();
  }

  initializeElements() {
    this.bookTitleInput = document.getElementById("bookTitle");
    this.voiceSelect = document.getElementById("voiceSelect");
    this.languageSelect = document.getElementById("languageSelect");
    this.playVoiceSampleBtn = document.getElementById("playVoiceSample");
    this.imagesList = document.getElementById("imagesList");
    this.imagesCount = document.getElementById("imagesCount");
    this.startBtn = document.getElementById("startTransformation");
    this.progressFill = document.getElementById("progressFill");
    this.progressText = document.getElementById("progressText");
    this.voiceSamplePlayer = document.getElementById("voiceSamplePlayer");

    // Drag and drop elements
    this.dropZone = document.getElementById("dropZone");
    this.fileInput = document.getElementById("fileInput");
    this.uploadProgress = document.getElementById("uploadProgress");
    this.uploadProgressFill = document.getElementById("uploadProgressFill");
    this.uploadProgressText = document.getElementById("uploadProgressText");
  }

  setupEventListeners() {
    this.startBtn.addEventListener("click", () => this.startTransformation());
    this.playVoiceSampleBtn.addEventListener("click", () =>
      this.playVoiceSample()
    );
    this.voiceSelect.addEventListener("change", () => this.updateVoiceSample());
    this.languageSelect.addEventListener("change", () =>
      this.updateTranslationStep()
    );

    // Drag and drop event listeners
    this.setupDragAndDrop();
  }

  setupDragAndDrop() {
    // Prevent default drag behaviors
    ["dragenter", "dragover", "dragleave", "drop"].forEach((eventName) => {
      this.dropZone.addEventListener(eventName, this.preventDefaults, false);
      document.body.addEventListener(eventName, this.preventDefaults, false);
    });

    // Highlight drop zone when item is dragged over it
    ["dragenter", "dragover"].forEach((eventName) => {
      this.dropZone.addEventListener(eventName, () => {
        this.dropZone.classList.add("drag-over");
      });
    });

    ["dragleave", "drop"].forEach((eventName) => {
      this.dropZone.addEventListener(eventName, () => {
        this.dropZone.classList.remove("drag-over");
      });
    });

    // Handle dropped files
    this.dropZone.addEventListener("drop", (e) => {
      const files = e.dataTransfer.files;
      this.handleFiles(files);
    });

    // Handle click to browse
    this.dropZone.addEventListener("click", () => {
      this.fileInput.click();
    });

    // Handle file input change
    this.fileInput.addEventListener("change", (e) => {
      const files = e.target.files;
      this.handleFiles(files);
    });
  }

  preventDefaults(e) {
    e.preventDefault();
    e.stopPropagation();
  }

  async handleFiles(files) {
    if (files.length === 0) return;

    // Filter for image files only
    const imageFiles = Array.from(files).filter((file) => {
      return (
        file.type.startsWith("image/") ||
        file.name.toLowerCase().endsWith(".heic") ||
        file.name.toLowerCase().endsWith(".heif")
      );
    });

    if (imageFiles.length === 0) {
      alert("Please select valid image files");
      return;
    }

    // Show upload progress
    this.uploadProgress.style.display = "block";
    this.dropZone.querySelector(".drop-zone-content").style.display = "none";

    try {
      // Step 1: Clear pending directory first
      this.uploadProgressText.textContent = "Clearing old images...";
      this.uploadProgressFill.style.width = "25%";

      const clearResponse = await fetch("/api/clear-pending", {
        method: "POST",
      });

      if (!clearResponse.ok) {
        throw new Error("Failed to clear pending directory");
      }

      // Step 2: Create FormData and append files
      const formData = new FormData();
      imageFiles.forEach((file) => {
        formData.append("images", file);
      });

      // Step 3: Upload files
      this.uploadProgressText.textContent = `Uploading ${imageFiles.length} images...`;
      this.uploadProgressFill.style.width = "50%";

      const response = await fetch("/api/upload-images", {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        throw new Error("Upload failed");
      }

      const result = await response.json();

      // Complete progress
      this.uploadProgressFill.style.width = "100%";
      this.uploadProgressText.textContent = `✅ Uploaded ${result.files.length} images successfully!`;

      // Wait a moment then hide progress and reload images
      setTimeout(() => {
        this.uploadProgress.style.display = "none";
        this.dropZone.querySelector(".drop-zone-content").style.display =
          "block";
        this.uploadProgressFill.style.width = "0%";
        this.loadImages();
      }, 2000);
    } catch (error) {
      console.error("Upload error:", error);
      this.uploadProgressText.textContent =
        "❌ Upload failed. Please try again.";
      this.uploadProgressFill.style.width = "0%";

      setTimeout(() => {
        this.uploadProgress.style.display = "none";
        this.dropZone.querySelector(".drop-zone-content").style.display =
          "block";
      }, 3000);
    }
  }

  updateVoiceSample() {
    const selectedVoice = this.voiceSelect.value;
    this.voiceSamplePlayer.src =
      "/voices/sample-" + selectedVoice.toLowerCase() + ".mp3";
    console.log(this.voiceSamplePlayer);
  }

  updateTranslationStep() {
    const selectedLanguage = this.languageSelect.value;
    const translateStep = document.getElementById("step-translate");

    if (selectedLanguage && selectedLanguage !== "") {
      translateStep.style.display = "flex";
    } else {
      translateStep.style.display = "none";
    }
  }

  async playVoiceSample() {
    try {
      this.playVoiceSampleBtn.textContent = "🔄 Loading...";
      this.playVoiceSampleBtn.disabled = true;

      console.log(this.voiceSamplePlayer);
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

    const bookTitle = this.bookTitleInput.value.trim();
    const voice = this.voiceSelect.value;
    const language = this.languageSelect.value;

    if (!bookTitle) {
      alert("Please enter a book title");
      return;
    }

    if (!voice || voice === "--- select a voice ---") {
      alert("Please select a voice");
      return;
    }

    this.isProcessing = true;
    this.startBtn.disabled = true;
    this.startBtn.textContent = "🔄 Processing...";

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
          language: language || null,
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
