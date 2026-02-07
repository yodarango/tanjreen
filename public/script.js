class AudiobookConverter {
  constructor() {
    this.isProcessing = false;
    this.currentStep = 0;
    this.totalSteps = 5;
    this.authToken = localStorage.getItem("authToken");
    this.inputMode = "images"; // 'images' or 'text'

    // Multi-process management
    this.currentView = "processes"; // 'processes', 'form', 'progress'
    this.selectedProcessId = null;
    this.processes = [];

    // Check authentication before initializing
    this.checkAuth().then((isAuthenticated) => {
      if (!isAuthenticated) {
        window.location.href = "/login";
        return;
      }

      this.initializeElements();
      this.setupEventListeners();
      this.loadProcesses(); // Load processes first
      this.loadImages();
    });
  }

  async checkAuth() {
    if (!this.authToken) {
      return false;
    }

    // Verify token is valid
    try {
      const response = await fetch("/api/progress", {
        headers: {
          Authorization: `Bearer ${this.authToken}`,
        },
      });

      if (!response.ok) {
        localStorage.removeItem("authToken");
        return false;
      }

      return true;
    } catch (error) {
      console.error("Auth check error:", error);
      localStorage.removeItem("authToken");
      return false;
    }
  }

  async checkProcessStatus() {
    try {
      const response = await fetch("/api/progress", {
        headers: this.getAuthHeaders(),
      });

      if (!response.ok) {
        return;
      }

      const data = await response.json();

      // If a process is running or not yet completed, resume polling
      if (
        data.isRunning ||
        (data.progress > 0 && !data.completed && !data.error)
      ) {
        console.log("🔄 Process in progress detected, resuming polling...");
        this.isProcessing = true;
        this.startBtn.disabled = true;
        this.startBtn.innerHTML =
          '<i class="fas fa-spinner fa-spin"></i> Processing...';

        // Update UI with current state
        this.updateProgress(data.progress);
        this.updateSteps(data.currentStep, data.currentStepProcess);

        // Start polling
        this.pollProgress();
      }
    } catch (error) {
      console.error("Error checking process status:", error);
    }
  }

  getAuthHeaders() {
    return {
      Authorization: `Bearer ${this.authToken}`,
    };
  }

  initializeElements() {
    // Multi-process elements
    this.processesListSection = document.getElementById("processesListSection");
    this.processesList = document.getElementById("processesList");
    this.startNewProcessBtn = document.getElementById("startNewProcessBtn");
    this.configSection = document.getElementById("configSection");

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
    this.logoutBtn = document.getElementById("logoutBtn");
    this.viewContentBtn = document.getElementById("viewContentBtn");
    this.cleanPendingBtn = document.getElementById("cleanPendingBtn");

    // Input mode elements
    this.modeImagesBtn = document.getElementById("modeImages");
    this.modeTextBtn = document.getElementById("modeText");
    this.imagesInputSection = document.getElementById("imagesInputSection");
    this.textInputSection = document.getElementById("textInputSection");
    this.textInput = document.getElementById("textInput");
    this.imagesSectionDisplay = document.getElementById("imagesSectionDisplay");

    // Drag and drop elements
    this.dropZone = document.getElementById("dropZone");
    this.fileInput = document.getElementById("fileInput");
    this.uploadProgress = document.getElementById("uploadProgress");
    this.uploadProgressFill = document.getElementById("uploadProgressFill");
    this.uploadProgressText = document.getElementById("uploadProgressText");
  }

  setupEventListeners() {
    // Multi-process listeners
    this.startNewProcessBtn.addEventListener("click", () => this.showForm());

    this.startBtn.addEventListener("click", () => this.startTransformation());
    this.playVoiceSampleBtn.addEventListener("click", () =>
      this.playVoiceSample(),
    );
    this.voiceSelect.addEventListener("change", () => {
      this.updateVoiceSample();
      // Also validate text input when voice changes (in text mode)
      if (this.inputMode === "text") {
        this.validateTextInput();
      }
    });
    this.languageSelect.addEventListener("change", () =>
      this.updateTranslationStep(),
    );
    this.logoutBtn.addEventListener("click", () => this.logout());
    this.viewContentBtn.addEventListener("click", () => this.viewContent());
    this.cleanPendingBtn.addEventListener("click", () =>
      this.cleanPendingContent(),
    );

    // Book title input listener (for text mode validation)
    this.bookTitleInput.addEventListener("input", () => {
      if (this.inputMode === "text") {
        this.validateTextInput();
      }
    });

    // Input mode toggle listeners
    this.modeImagesBtn.addEventListener("click", () =>
      this.switchInputMode("images"),
    );
    this.modeTextBtn.addEventListener("click", () =>
      this.switchInputMode("text"),
    );

    // Text input listeners to enable/disable start button
    this.textInput.addEventListener("input", () => this.validateTextInput());
    this.textInput.addEventListener("paste", () => {
      // Use setTimeout to allow paste to complete before validating
      setTimeout(() => this.validateTextInput(), 10);
    });

    // Drag and drop event listeners
    this.setupDragAndDrop();
  }

  logout() {
    localStorage.removeItem("authToken");
    window.location.href = "/login";
  }

  viewContent() {
    window.location.href = "/content";
  }

  async cleanPendingContent() {
    if (
      !confirm(
        "⚠️ Are you sure you want to clean all pending content? This will delete all files in the pending directory.",
      )
    ) {
      return;
    }

    try {
      const response = await fetch("/api/clear-pending", {
        method: "POST",
        headers: this.getAuthHeaders(),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();

      // Refresh the images count
      this.loadImages();
    } catch (error) {
      console.error("Error cleaning pending content:", error);
      alert("✗ Error cleaning pending content: " + error.message);
    }
  }

  switchInputMode(mode) {
    this.inputMode = mode;

    if (mode === "images") {
      // Show images section, hide text section
      this.imagesInputSection.classList.remove("hidden");
      this.textInputSection.classList.add("hidden");
      this.imagesSectionDisplay.classList.remove("hidden");
      this.modeImagesBtn.classList.add("active");
      this.modeTextBtn.classList.remove("active");

      // Update start button state based on images
      this.loadImages();
    } else {
      // Show text section, hide images section
      this.imagesInputSection.classList.add("hidden");
      this.textInputSection.classList.remove("hidden");
      this.imagesSectionDisplay.classList.add("hidden");
      this.modeImagesBtn.classList.remove("active");
      this.modeTextBtn.classList.add("active");

      // Update start button state based on text
      this.validateTextInput();
    }
  }

  validateTextInput() {
    const text = this.textInput.value.trim();
    const bookTitle = this.bookTitleInput.value.trim();
    const voice = this.voiceSelect.value;

    // Enable start button if we have text, title, and voice
    if (
      text &&
      bookTitle &&
      voice &&
      voice !== "--- select a voice ---" &&
      !this.isProcessing
    ) {
      this.startBtn.disabled = false;
    } else {
      this.startBtn.disabled = true;
    }
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

    // Filter for image and PDF files
    const validFiles = Array.from(files).filter((file) => {
      return (
        file.type.startsWith("image/") ||
        file.type === "application/pdf" ||
        file.name.toLowerCase().endsWith(".heic") ||
        file.name.toLowerCase().endsWith(".heif") ||
        file.name.toLowerCase().endsWith(".pdf")
      );
    });

    if (validFiles.length === 0) {
      alert("Please select valid image or PDF files");
      return;
    }

    // Extract filename from first file and populate title input
    if (validFiles.length > 0 && !this.bookTitleInput.value.trim()) {
      const firstFile = validFiles[0];
      // Remove file extension
      let nameWithoutExt = firstFile.name.replace(/\.[^/.]+$/, "");
      // Remove all text after __ (double underscore)
      const doubleUnderscoreIndex = nameWithoutExt.indexOf("__");
      if (doubleUnderscoreIndex !== -1) {
        nameWithoutExt = nameWithoutExt.substring(0, doubleUnderscoreIndex);
      }
      // Replace dashes and underscores with spaces
      const formattedTitle = nameWithoutExt.replace(/[-_]/g, " ");
      // Set the title input value
      this.bookTitleInput.value = formattedTitle;
    }

    // Show upload progress
    this.uploadProgress.classList.remove("hidden");
    this.dropZone.querySelector(".drop-zone-content").classList.add("hidden");

    try {
      // Step 1: Clear pending directory first
      this.uploadProgressText.textContent = "Clearing old images...";
      this.uploadProgressFill.style.width = "25%";

      const clearResponse = await fetch("/api/clear-pending", {
        method: "POST",
        headers: this.getAuthHeaders(),
      });

      if (!clearResponse.ok) {
        throw new Error("Failed to clear pending directory");
      }

      // Step 2: Create FormData and append files
      const formData = new FormData();
      validFiles.forEach((file) => {
        formData.append("images", file);
      });

      // Step 3: Upload files
      this.uploadProgressText.textContent = `Uploading ${validFiles.length} files...`;
      this.uploadProgressFill.style.width = "50%";

      const response = await fetch("/api/upload-images", {
        method: "POST",
        headers: this.getAuthHeaders(),
        body: formData,
      });

      if (!response.ok) {
        throw new Error("Upload failed");
      }

      const result = await response.json();

      // Complete progress
      this.uploadProgressFill.style.width = "100%";
      this.uploadProgressText.textContent = `✓ Uploaded ${result.files.length} images successfully!`;

      // Wait a moment then hide progress and reload images
      setTimeout(() => {
        this.uploadProgress.classList.add("hidden");
        this.dropZone
          .querySelector(".drop-zone-content")
          .classList.remove("hidden");
        this.uploadProgressFill.style.width = "0%";
        this.loadImages();
      }, 2000);
    } catch (error) {
      console.error("Upload error:", error);
      this.uploadProgressText.textContent =
        "✗ Upload failed. Please try again.";
      this.uploadProgressFill.style.width = "0%";

      setTimeout(() => {
        this.uploadProgress.classList.add("hidden");
        this.dropZone
          .querySelector(".drop-zone-content")
          .classList.remove("hidden");
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
      translateStep.classList.remove("hidden");
    } else {
      translateStep.classList.add("hidden");
    }
  }

  async playVoiceSample() {
    try {
      this.playVoiceSampleBtn.innerHTML =
        '<i class="fas fa-spinner fa-spin"></i> Loading...';
      this.playVoiceSampleBtn.disabled = true;

      console.log(this.voiceSamplePlayer);
      await this.voiceSamplePlayer.play();

      this.playVoiceSampleBtn.innerHTML =
        '<i class="fas fa-volume-up"></i> Play Sample';
      this.playVoiceSampleBtn.disabled = false;
    } catch (error) {
      console.error("Error playing voice sample:", error);
      this.playVoiceSampleBtn.innerHTML =
        '<i class="fas fa-volume-up"></i> Play Sample';
      this.playVoiceSampleBtn.disabled = false;
    }
  }

  async loadImages() {
    try {
      const response = await fetch("/api/images", {
        headers: this.getAuthHeaders(),
      });
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

    // Check input mode specific requirements
    if (this.inputMode === "text") {
      const text = this.textInput.value.trim();
      if (!text) {
        alert("Please paste some text");
        return;
      }
    }

    this.isProcessing = true;
    this.startBtn.disabled = true;
    this.startBtn.innerHTML =
      '<i class="fas fa-spinner fa-spin"></i> Processing...';

    try {
      let responseData;

      // Different endpoints based on input mode
      if (this.inputMode === "text") {
        // Use text input endpoint
        const response = await fetch("/api/start-transformation-from-text", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            ...this.getAuthHeaders(),
          },
          body: JSON.stringify({
            bookTitle: bookTitle,
            voice: voice,
            language: language || null,
            text: this.textInput.value.trim(),
          }),
        });

        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }

        responseData = await response.json();
      } else {
        // Use images endpoint (original flow)
        const response = await fetch("/api/start-transformation", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            ...this.getAuthHeaders(),
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

        responseData = await response.json();
      }

      // Get the processId from response
      const processId = responseData.processId;

      // Reload processes list
      await this.loadProcesses();

      // Show the progress for this new process
      this.showProgress(processId);
    } catch (error) {
      console.error("Error starting transformation:", error);
      alert("Error starting transformation: " + error.message);
      this.resetStartButton();
    }
  }

  async pollProgress() {
    try {
      // Use specific process endpoint if we have a selected process
      const endpoint = this.selectedProcessId
        ? `/api/process/${this.selectedProcessId}`
        : "/api/progress";

      const response = await fetch(endpoint, {
        headers: this.getAuthHeaders(),
      });
      const responseData = await response.json();

      // Extract state from response (process endpoint returns {state: {...}})
      const data = responseData.state || responseData;

      this.updateProgress(data.progress);
      this.updateSteps(data.currentStep, data.currentStepProcess);

      if (data.completed) {
        this.resetStartButton();
        this.updateStepStatus(
          "step-complete",
          "completed",
          '<i class="fas fa-check-circle"></i>',
        );
        this.hideAllSubsteps();

        // Reload processes list to update status
        await this.loadProcesses();

        alert("Transformation completed successfully!");
      } else if (data.error) {
        this.resetStartButton();
        this.hideAllSubsteps();

        // Reload processes list to update status
        await this.loadProcesses();

        alert("✗ Transformation failed: " + data.error);
      } else {
        // Continue polling
        setTimeout(() => this.pollProgress(), 1000);

        // Also update the processes list periodically (every 5 seconds)
        if (
          !this.lastProcessListUpdate ||
          Date.now() - this.lastProcessListUpdate > 5000
        ) {
          this.lastProcessListUpdate = Date.now();
          this.loadProcesses();
        }
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

  updateSteps(currentStep, currentStepProcess) {
    const steps = [
      "step-ocr",
      "step-combine",
      "step-clean",
      "step-translate",
      "step-tts",
      "step-transfer",
      "step-complete",
    ];

    const substepIds = [
      "ocr",
      "combine",
      "clean",
      "translate",
      "tts",
      "transfer",
      "complete",
    ];

    // Check if translation step is visible
    const translateStep = document.getElementById("step-translate");
    const isTranslationVisible = !translateStep.classList.contains("hidden");

    steps.forEach((stepId, index) => {
      const stepElement = document.getElementById(stepId);

      // Skip translation step if it's not visible
      if (stepId === "step-translate" && !isTranslationVisible) {
        return;
      }

      if (index < currentStep) {
        this.updateStepStatus(
          stepId,
          "completed",
          '<i class="fas fa-check-circle"></i>',
        );
        this.hideSubstep(substepIds[index]);
      } else if (index === currentStep) {
        this.updateStepStatus(
          stepId,
          "active",
          '<i class="fas fa-spinner fa-spin"></i>',
        );
        // Update substep progress for current step
        if (currentStepProcess && currentStepProcess.totalItems > 0) {
          this.updateSubstepProgress(
            substepIds[index],
            currentStepProcess.currentItem,
            currentStepProcess.totalItems,
          );
        } else {
          this.hideSubstep(substepIds[index]);
        }
      } else {
        this.updateStepStatus(
          stepId,
          "",
          '<i class="fas fa-hourglass-half"></i>',
        );
        this.hideSubstep(substepIds[index]);
      }
    });
  }

  updateStepStatus(stepId, className, statusIcon) {
    const stepElement = document.getElementById(stepId);
    stepElement.className = "step " + className;
    stepElement.querySelector(".step-status").innerHTML = statusIcon;
  }

  updateSubstepProgress(substepId, currentItem, totalItems) {
    const substepElement = document.getElementById(`substep-${substepId}`);
    const substepFill = document.getElementById(`substep-fill-${substepId}`);
    const substepText = document.getElementById(`substep-text-${substepId}`);

    if (!substepElement || !substepFill || !substepText) {
      return;
    }

    // Show the substep progress
    substepElement.classList.remove("hidden");

    // Calculate percentage
    const percentage = totalItems > 0 ? (currentItem / totalItems) * 100 : 0;

    // Update the progress bar
    substepFill.style.width = percentage + "%";

    // Update the text
    substepText.textContent = `${currentItem}/${totalItems}`;
  }

  hideSubstep(substepId) {
    const substepElement = document.getElementById(`substep-${substepId}`);
    if (substepElement) {
      substepElement.classList.add("hidden");
    }
  }

  hideAllSubsteps() {
    const substepIds = [
      "ocr",
      "combine",
      "clean",
      "translate",
      "tts",
      "complete",
    ];
    substepIds.forEach((id) => this.hideSubstep(id));
  }

  resetStartButton() {
    this.isProcessing = false;
    this.startBtn.disabled = false;
    this.startBtn.innerHTML =
      '<i class="fas fa-rocket"></i> Start Transformation';
  }

  // ============================================
  // MULTI-PROCESS MANAGEMENT METHODS
  // ============================================

  async loadProcesses() {
    try {
      const response = await fetch("/api/processes", {
        headers: this.getAuthHeaders(),
      });

      if (!response.ok) {
        console.error("Failed to load processes");
        return;
      }

      const data = await response.json();
      this.processes = data.processes || [];
      const mostRecentId = data.mostRecentId;

      // If there are processes, show the most recent one
      if (mostRecentId) {
        this.selectedProcessId = mostRecentId;
        this.showProgress(mostRecentId);
      } else {
        // No processes, show the form
        this.showForm();
      }

      this.renderProcessesList();
    } catch (error) {
      console.error("Error loading processes:", error);
      this.showForm(); // Fallback to form
    }
  }

  renderProcessesList() {
    if (!this.processesList) return;

    if (this.processes.length === 0) {
      this.processesList.innerHTML = `
        <div class="processes-empty">
          <i class="fas fa-inbox"></i>
          <p>No active processes</p>
          <p style="font-size: 0.9rem;">Click "Start New Conversion" to begin</p>
        </div>
      `;
      return;
    }

    this.processesList.innerHTML = this.processes
      .map((process) => {
        const isActive = process.processId === this.selectedProcessId;
        const statusClass = process.completed
          ? "completed"
          : process.error
            ? "error"
            : "running";
        const statusText = process.completed
          ? "Completed"
          : process.error
            ? "Error"
            : "Running";
        const statusIcon = process.completed
          ? "fa-check-circle"
          : process.error
            ? "fa-exclamation-circle"
            : "fa-spinner fa-spin";

        return `
          <div class="process-item ${isActive ? "active" : ""}" data-process-id="${process.processId}">
            <div class="process-item-header">
              <h3 class="process-title">${process.bookTitle || "Untitled"}</h3>
              <span class="process-id">${process.processId}</span>
            </div>

            <div class="process-status">
              <span class="process-status-badge ${statusClass}">
                <i class="fas ${statusIcon}"></i>
                ${statusText}
              </span>

              <div class="process-progress-mini">
                <div class="process-progress-bar">
                  <div class="process-progress-fill" style="width: ${process.progress}%"></div>
                </div>
                <div class="process-progress-text">${Math.round(process.progress)}%</div>
              </div>
            </div>

            <div class="process-meta">
              <span class="process-step">
                <i class="fas fa-tasks"></i>
                Step ${process.currentStep}/7
              </span>
              <span class="process-time">
                ${this.formatDate(process.createdAt)}
              </span>
            </div>
          </div>
        `;
      })
      .join("");

    // Add click listeners to process items
    this.processesList.querySelectorAll(".process-item").forEach((item) => {
      item.addEventListener("click", () => {
        const processId = item.dataset.processId;
        this.showProgress(processId);
      });
    });
  }

  formatDate(dateString) {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now - date;
    const diffMins = Math.floor(diffMs / 60000);

    if (diffMins < 1) return "Just now";
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffMins < 1440) return `${Math.floor(diffMins / 60)}h ago`;
    return date.toLocaleDateString();
  }

  showForm() {
    this.currentView = "form";
    this.selectedProcessId = null;

    // Hide processes list and progress
    if (this.processesListSection) {
      this.processesListSection.classList.add("hidden");
    }
    if (this.configSection) {
      this.configSection.classList.remove("hidden");
    }

    // Stop polling if active
    if (this.pollInterval) {
      clearInterval(this.pollInterval);
      this.pollInterval = null;
    }
  }

  showProgress(processId) {
    this.currentView = "progress";
    this.selectedProcessId = processId;

    // Hide form, show processes list
    if (this.configSection) {
      this.configSection.classList.add("hidden");
    }
    if (this.processesListSection) {
      this.processesListSection.classList.remove("hidden");
    }

    // Update active state in list
    this.renderProcessesList();

    // Load and poll this specific process
    this.loadProcessDetails(processId);
  }

  async loadProcessDetails(processId) {
    try {
      const response = await fetch(`/api/process/${processId}`, {
        headers: this.getAuthHeaders(),
      });

      if (!response.ok) {
        console.error("Failed to load process details");
        return;
      }

      const data = await response.json();

      // Update UI with process state
      this.updateProgress(data.state.progress);
      this.updateSteps(data.state.currentStep, data.state.currentStepProcess);

      // If process is still running, start polling
      if (data.state.isRunning) {
        this.isProcessing = true;
        this.pollProgress();
      }
    } catch (error) {
      console.error("Error loading process details:", error);
    }
  }
}

// Initialize the application when the page loads
document.addEventListener("DOMContentLoaded", () => {
  new AudiobookConverter();
});
