class ContentLibrary {
  constructor() {
    this.authToken = localStorage.getItem("authToken");

    // Check authentication before initializing
    this.checkAuth().then((isAuthenticated) => {
      if (!isAuthenticated) {
        window.location.href = "/login";
        return;
      }

      this.initializeElements();
      this.setupEventListeners();
      this.loadContent();
    });
  }

  async checkAuth() {
    if (!this.authToken) {
      return false;
    }

    try {
      const response = await fetch("/api/progress", {
        headers: this.getAuthHeaders(),
      });
      return response.ok;
    } catch (error) {
      return false;
    }
  }

  getAuthHeaders() {
    return {
      Authorization: `Bearer ${this.authToken}`,
      "Content-Type": "application/json",
    };
  }

  initializeElements() {
    // States
    this.loadingState = document.getElementById("loadingState");
    this.emptyState = document.getElementById("emptyState");
    this.contentGrid = document.getElementById("contentGrid");
    this.errorState = document.getElementById("errorState");
    this.errorMessage = document.getElementById("errorMessage");

    // Buttons
    this.backBtn = document.getElementById("backBtn");
    this.logoutBtn = document.getElementById("logoutBtn");
    this.goToConverterBtn = document.getElementById("goToConverterBtn");
    this.retryBtn = document.getElementById("retryBtn");
  }

  setupEventListeners() {
    this.backBtn.addEventListener("click", () => this.goToConverter());
    this.logoutBtn.addEventListener("click", () => this.logout());
    this.goToConverterBtn.addEventListener("click", () => this.goToConverter());
    this.retryBtn.addEventListener("click", () => this.loadContent());
  }

  goToConverter() {
    window.location.href = "/";
  }

  logout() {
    localStorage.removeItem("authToken");
    window.location.href = "/login";
  }

  showState(state) {
    this.loadingState.classList.add("hidden");
    this.emptyState.classList.add("hidden");
    this.contentGrid.classList.add("hidden");
    this.errorState.classList.add("hidden");

    switch (state) {
      case "loading":
        this.loadingState.classList.remove("hidden");
        break;
      case "empty":
        this.emptyState.classList.remove("hidden");
        break;
      case "content":
        this.contentGrid.classList.remove("hidden");
        break;
      case "error":
        this.errorState.classList.remove("hidden");
        break;
    }
  }

  async loadContent() {
    this.showState("loading");

    try {
      const response = await fetch("/api/content", {
        headers: this.getAuthHeaders(),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();

      if (data.items.length === 0) {
        this.showState("empty");
      } else {
        this.renderContent(data.items);
        this.showState("content");
      }
    } catch (error) {
      console.error("Error loading content:", error);
      this.errorMessage.textContent = error.message;
      this.showState("error");
    }
  }

  renderContent(items) {
    this.contentGrid.innerHTML = "";

    items.forEach((item) => {
      const card = this.createContentCard(item);
      this.contentGrid.appendChild(card);
    });
  }

  createContentCard(item) {
    // Clone the template
    const template = document.getElementById("contentCardTemplate");
    const card = template.content
      .cloneNode(true)
      .querySelector(".content-card");

    // Get icon element
    const iconContainer = card.querySelector("[data-icon-container]");
    const iconElement = this.getFileIconElement(
      item.type === "folder" ? "folder" : item.name
    );
    iconContainer.appendChild(iconElement);

    // Set title
    card.querySelector("[data-title]").textContent = item.name;

    // Set metadata
    card.querySelector("[data-size]").textContent = this.formatFileSize(
      item.size
    );
    card.querySelector("[data-date]").textContent = this.formatDate(
      item.createdAt
    );

    // Handle file count for folders
    if (item.type === "folder" && item.fileCount > 0) {
      const fileCountItem = card.querySelector(".file-count-item");
      fileCountItem.classList.remove("hidden");
      card.querySelector("[data-file-count]").textContent = `${
        item.fileCount
      } file${item.fileCount !== 1 ? "s" : ""}`;
    }

    // Set download button text
    const downloadText = card.querySelector("[data-download-text]");
    downloadText.textContent =
      item.type === "folder" ? "Download ZIP" : "Download";

    // Add event listeners
    const downloadBtn = card.querySelector("[data-download-btn]");
    const deleteBtn = card.querySelector("[data-delete-btn]");

    // Disable download for empty folders (zipping one produces an invalid archive)
    if (item.type === "folder" && item.fileCount === 0) {
      downloadBtn.disabled = true;
      downloadText.textContent = "Empty Folder";
    }

    downloadBtn.addEventListener("click", () =>
      this.downloadItem(item.name, downloadBtn)
    );
    deleteBtn.addEventListener("click", () => this.deleteItem(item.name, card));

    return card;
  }

  getFileIconElement(filename) {
    const ext =
      filename === "folder"
        ? "folder"
        : filename.split(".").pop().toLowerCase();

    const iconMap = {
      folder: "iconFolder",
      mp3: "iconMusic",
      wav: "iconMusic",
      m4a: "iconMusic",
      ogg: "iconMusic",
      pdf: "iconPdf",
      txt: "iconText",
      zip: "iconArchive",
      json: "iconCode",
    };

    const templateId = iconMap[ext] || "iconFolder";
    const template = document.getElementById(templateId);
    return template.content.cloneNode(true);
  }

  formatFileSize(bytes) {
    if (bytes === 0) return "0 Bytes";
    const k = 1024;
    const sizes = ["Bytes", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + " " + sizes[i];
  }

  formatDate(dateString) {
    const date = new Date(dateString);
    const now = new Date();
    const diffTime = Math.abs(now - date);
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    if (diffDays === 0) {
      return "Today";
    } else if (diffDays === 1) {
      return "Yesterday";
    } else if (diffDays < 7) {
      return `${diffDays} days ago`;
    } else {
      return date.toLocaleDateString();
    }
  }

  escapeHtml(text) {
    const div = document.createElement("div");
    div.textContent = text;
    return div.innerHTML;
  }

  async downloadItem(filename, buttonElement) {
    // Store original button content
    const originalContent = buttonElement.innerHTML;

    try {
      // Disable button and show loading state
      buttonElement.disabled = true;
      buttonElement.innerHTML = `
        <span class="spinner"></span>
        Loading...
      `;

      // Use direct link with token in query parameter for progressive download
      // This allows the browser to show native download progress
      const downloadUrl = `/api/content/download/${encodeURIComponent(
        filename
      )}?token=${encodeURIComponent(this.authToken)}`;

      // Create a temporary link and trigger download
      const a = document.createElement("a");
      a.href = downloadUrl;
      a.style.display = "none";
      document.body.appendChild(a);
      a.click();

      // Small delay before restoring button to show loading state briefly
      setTimeout(() => {
        document.body.removeChild(a);
        // Restore button state
        buttonElement.disabled = false;
        buttonElement.innerHTML = originalContent;
      }, 500);
    } catch (error) {
      console.error("Error downloading item:", error);
      alert("Error downloading: " + error.message);
      // Restore button state on error
      buttonElement.disabled = false;
      buttonElement.innerHTML = originalContent;
    }
  }

  async deleteItem(filename, cardElement) {
    if (
      !confirm(
        `Are you sure you want to delete "${filename}"? This action cannot be undone.`
      )
    ) {
      return;
    }

    try {
      const response = await fetch(
        `/api/content/delete/${encodeURIComponent(filename)}`,
        {
          method: "DELETE",
          headers: this.getAuthHeaders(),
        }
      );

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();

      // Remove card with animation
      cardElement.style.opacity = "0";
      cardElement.style.transform = "scale(0.9)";

      setTimeout(() => {
        cardElement.remove();

        // Check if grid is empty
        if (this.contentGrid.children.length === 0) {
          this.showState("empty");
        }
      }, 300);

      console.log(`${data.message}`);
    } catch (error) {
      console.error("Error deleting item:", error);
      alert("Error deleting: " + error.message);
    }
  }
}

// Initialize the content library when the page loads
new ContentLibrary();
