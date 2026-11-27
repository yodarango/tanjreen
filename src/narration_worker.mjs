// API-only worker. Reuse the normal TTS and final concatenation steps unchanged.
import { copySourceText } from "./utils/prepare_text.mjs";
import { processTextToSpeech } from "./5.process_tts.mjs";
import { concatenateAudioFiles } from "./6.concatenate_audio.mjs";
import { disconnectWorker } from "./utils/retry_step.mjs";

try {
  await copySourceText("Narration");
  await processTextToSpeech(process.env.NARRATION_VOICE || "echo", "Narration", null);
  console.log(JSON.stringify({ type: "NARRATION_CONCATENATING" }));
  await concatenateAudioFiles("Narration", null);
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
} finally {
  disconnectWorker();
}