// Interactive web jobs use IPC to wait for an explicit retry. CLI and the
// streaming API have no IPC channel and continue to fail immediately.
const exitOnDisconnect = () => {
  // Detached interactive workers must not leave OCR or ffmpeg running if the
  // server disappears unexpectedly.
  if (process.env.INTERACTIVE_WORKER === "1") {
    try { process.kill(-process.pid, "SIGTERM"); } catch (error) {
      if (error.code !== "ESRCH") console.error("Could not stop worker group:", error);
    }
  }
  process.exit(1);
};
if (process.connected) process.once("disconnect", exitOnDisconnect);

export function disconnectWorker() {
  if (process.connected) {
    process.off("disconnect", exitOnDisconnect);
    process.disconnect();
  }
}

export async function runStep(number, step) {
  while (true) {
    if (process.connected) process.send({ type: "STEP_START", step: number });
    try {
      const result = await step();
      if (process.connected) process.send({ type: "STEP_COMPLETE", step: number });
      return result;
    } catch (error) {
      if (!process.connected) throw error;
      await new Promise((resolve, reject) => {
        const cleanup = () => {
          process.off("message", onMessage);
          process.off("disconnect", onDisconnect);
        };
        const onMessage = (message) => {
          if (message?.type !== "RETRY_STEP" || message.step !== number) return;
          cleanup();
          resolve();
        };
        const onDisconnect = () => {
          cleanup();
          reject(error);
        };
        process.on("message", onMessage);
        process.once("disconnect", onDisconnect);
        process.send({ type: "STEP_ERROR", step: number, message: error.message || String(error) });
      });
    }
  }
}