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
    const card = document.createElement("div");
    card.className = "content-card";

    const icon = item.type === "folder" ? "📁" : this.getFileIcon(item.name);
    const formattedSize = this.formatFileSize(item.size);
    const formattedDate = this.formatDate(item.createdAt);

    // Build metadata HTML
    let metaHTML = `
      <div class="content-meta-item">
        <span>📦</span>
        <span>${formattedSize}</span>
      </div>
      <div class="content-meta-item">
        <span>📅</span>
        <span>${formattedDate}</span>
      </div>
    `;

    // Add file count for folders
    if (item.type === "folder" && item.fileCount > 0) {
      metaHTML += `
        <div class="content-meta-item">
          <span>📄</span>
          <span>${item.fileCount} file${item.fileCount !== 1 ? "s" : ""}</span>
        </div>
      `;
    }

    card.innerHTML = `
      <div class="content-card-header">
        <div class="content-icon">${icon}</div>
        <div class="content-info">
          <h3 class="content-title">${this.escapeHtml(item.name)}</h3>
          <div class="content-meta">
            ${metaHTML}
          </div>
        </div>
      </div>
      <div class="content-actions">
        <button class="download-btn" data-filename="${this.escapeHtml(
          item.name
        )}">
          ⬇️ Download${item.type === "folder" ? " ZIP" : ""}
        </button>
        <button class="delete-btn" data-filename="${this.escapeHtml(
          item.name
        )}">
          🗑️
        </button>
      </div>
    `;

    // Add event listeners
    const downloadBtn = card.querySelector(".download-btn");
    const deleteBtn = card.querySelector(".delete-btn");

    downloadBtn.addEventListener("click", () => this.downloadItem(item.name));
    deleteBtn.addEventListener("click", () => this.deleteItem(item.name, card));

    return card;
  }

  getFileIcon(filename) {
    const ext = filename.split(".").pop().toLowerCase();
    const iconMap = {
      mp3: "🎵",
      wav: "🎵",
      m4a: "🎵",
      ogg: "🎵",
      pdf: "📄",
      txt: "📝",
      zip: "📦",
      json: "📋",
    };
    return iconMap[ext] || "📁";
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

  async downloadItem(filename) {
    try {
      const response = await fetch(
        `/api/content/download/${encodeURIComponent(filename)}`,
        {
          headers: {
            Authorization: `Bearer ${this.authToken}`,
          },
        }
      );

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;

      // Get filename from Content-Disposition header or use original
      const contentDisposition = response.headers.get("Content-Disposition");
      let downloadFilename = filename;
      if (contentDisposition) {
        const filenameMatch = contentDisposition.match(
          /filename[^;=\n]*=((['"]).*?\2|[^;\n]*)/
        );
        if (filenameMatch && filenameMatch[1]) {
          downloadFilename = filenameMatch[1].replace(/['"]/g, "");
        }
      }

      a.download = downloadFilename;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (error) {
      console.error("Error downloading item:", error);
      alert("❌ Error downloading: " + error.message);
    }
  }

  async deleteItem(filename, cardElement) {
    if (
      !confirm(
        `⚠️ Are you sure you want to delete "${filename}"? This action cannot be undone.`
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

      console.log(`✅ ${data.message}`);
    } catch (error) {
      console.error("Error deleting item:", error);
      alert("❌ Error deleting: " + error.message);
    }
  }
}

// Initialize the content library when the page loads
new ContentLibrary();
