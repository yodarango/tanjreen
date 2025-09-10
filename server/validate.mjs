// Available voices (based on files in public/voices directory)
const AVAILABLE_VOICES = [
  "alloy",
  "ash",
  "ballad",
  "coral",
  "echo",
  "fable",
  "nova",
  "onyx",
  "sage",
  "shimmer",
  "verse",
];

/**
 * Validate transformation request parameters
 * @param {string} bookTitle - The book title provided by user
 * @param {string} voice - The voice name provided by user
 * @returns {Object} Validation result with success flag and error message if any
 */
export function validateTransformationRequest(bookTitle, voice) {
  const errors = [];

  // Validate book title
  if (!bookTitle) {
    errors.push("Book title is required");
  } else if (typeof bookTitle !== "string") {
    errors.push("Book title must be a string");
  } else if (bookTitle.trim().length === 0) {
    errors.push("Book title cannot be empty");
  } else if (bookTitle.trim().length > 100) {
    errors.push("Book title cannot exceed 100 characters");
  }

  // Validate voice
  if (!voice) {
    errors.push("Voice is required");
  } else if (typeof voice !== "string") {
    errors.push("Voice must be a string");
  } else if (!AVAILABLE_VOICES.includes(voice)) {
    errors.push(
      `Invalid voice "${voice}". Available voices: ${AVAILABLE_VOICES.join(
        ", "
      )}`
    );
  }

  return {
    isValid: errors.length === 0,
    errors: errors,
    availableVoices: AVAILABLE_VOICES,
  };
}
