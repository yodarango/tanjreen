(() => {
  const styles = `
    .app-toast-region{position:fixed;z-index:10001;top:18px;right:18px;display:flex;flex-direction:column;gap:10px;width:min(92vw,380px)}
    .app-toast{padding:14px 16px;border-radius:10px;border:1px solid currentColor;background:#242424;color:#ff8c42;box-shadow:0 12px 36px #0008;animation:app-toast-in .18s ease-out}
    .app-toast.success{color:#06ffa5}.app-toast.error{color:#ff5555}.app-toast.warning{color:#ffbe0b}.app-toast.info{color:#ff8c42}
    .app-toast-message{color:#fff;line-height:1.45}.app-toast-close{float:right;border:0;background:none;color:inherit;font-size:1.15rem;cursor:pointer}
    .app-modal-backdrop{position:fixed;z-index:10000;inset:0;display:grid;place-items:center;padding:20px;background:#000b;backdrop-filter:blur(4px)}
    .app-modal{width:min(100%,480px);padding:24px;border:1px solid #555;border-radius:16px;background:#2a2a2a;color:#fff;box-shadow:0 24px 70px #0009}
    .app-modal h2{margin:0 0 12px;color:#ff8c42}.app-modal p{line-height:1.55;white-space:pre-line}.app-modal-actions{display:flex;justify-content:flex-end;flex-wrap:wrap;gap:10px;margin-top:22px}
    .app-modal-actions button{padding:10px 16px;border:1px solid #555;border-radius:8px;font:inherit;font-weight:700;cursor:pointer}
    .app-modal-cancel{background:#404040;color:#fff}.app-modal-confirm{background:#ff8c42;color:#1a1a1a;border-color:#ff8c42!important}.app-modal-confirm.danger{background:#ff006e;color:#fff;border-color:#ff006e!important}
    @keyframes app-toast-in{from{opacity:0;transform:translateY(-6px)}to{opacity:1;transform:translateY(0)}}
  `;
  const style = document.createElement("style");
  style.textContent = styles;
  document.head.appendChild(style);

  const region = document.createElement("div");
  region.className = "app-toast-region";
  region.setAttribute("aria-live", "polite");
  document.body.appendChild(region);

  function toast(message, type = "info", duration = 4500) {
    const item = document.createElement("div");
    item.className = `app-toast ${type}`;
    item.setAttribute("role", type === "error" ? "alert" : "status");
    const close = document.createElement("button");
    close.className = "app-toast-close";
    close.type = "button";
    close.setAttribute("aria-label", "Dismiss notification");
    close.textContent = "×";
    const text = document.createElement("span");
    text.className = "app-toast-message";
    text.textContent = message;
    item.append(close, text);
    region.appendChild(item);
    const dismiss = () => item.remove();
    close.addEventListener("click", dismiss);
    if (duration > 0) setTimeout(dismiss, duration);
  }

  function confirm({ title = "Please confirm", message, confirmText = "Confirm", cancelText = "Cancel", danger = false }) {
    return new Promise((resolve) => {
      const backdrop = document.createElement("div");
      const previousFocus = document.activeElement;
      backdrop.className = "app-modal-backdrop";
      const dialog = document.createElement("section");
      dialog.className = "app-modal";
      dialog.setAttribute("role", "dialog");
      dialog.setAttribute("aria-modal", "true");
      dialog.setAttribute("aria-labelledby", "app-modal-title");
      const heading = document.createElement("h2");
      heading.id = "app-modal-title";
      heading.textContent = title;
      const body = document.createElement("p");
      body.textContent = message;
      const actions = document.createElement("div");
      actions.className = "app-modal-actions";
      const cancel = document.createElement("button");
      cancel.className = "app-modal-cancel";
      cancel.type = "button";
      cancel.textContent = cancelText;
      const accept = document.createElement("button");
      accept.className = `app-modal-confirm${danger ? " danger" : ""}`;
      accept.type = "button";
      accept.textContent = confirmText;
      actions.append(cancel, accept);
      dialog.append(heading, body, actions);
      backdrop.appendChild(dialog);
      document.body.appendChild(backdrop);
      const done = (value) => { backdrop.remove(); previousFocus?.focus(); resolve(value); };
      cancel.addEventListener("click", () => done(false));
      accept.addEventListener("click", () => done(true));
      backdrop.addEventListener("click", (event) => { if (event.target === backdrop) done(false); });
      dialog.addEventListener("keydown", (event) => {
        if (event.key === "Escape") done(false);
        if (event.key === "Tab") {
          if (event.shiftKey && document.activeElement === cancel) { event.preventDefault(); accept.focus(); }
          else if (!event.shiftKey && document.activeElement === accept) { event.preventDefault(); cancel.focus(); }
        }
      });
      cancel.focus();
    });
  }

  window.AppUI = {
    toast,
    success: (message) => toast(message, "success"),
    error: (message) => toast(message, "error", 0),
    warning: (message) => toast(message, "warning", 6500),
    info: (message) => toast(message, "info"),
    confirm,
  };
})();