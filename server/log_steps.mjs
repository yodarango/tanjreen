// a set of functions that log the current step and return with an error if it fails

export async function logOne(step) {
  try {
    console.log("📖 Step 1: Processing images with OCR...");
    await step();
    console.log(
      `*****************************************************************************
    🚀 Starting complete OCR + Text Combination + AI Cleaning + TTS pipeline...
     *****************************************************************************
     \n\n
     `
    );
  } catch (error) {
    return error;
  }
}

export async function callTwo(step) {
  try {
    console.log("📚 Step 2: Combining text files...");
    await step();
    console.log(
      `*****************************************************************************
    📚 Step 2: Combining text files...
     *****************************************************************************
     \n\n
     `
    );
  } catch (error) {
    return error;
  }
}

export async function callThree(step, bookTitle) {
  try {
    console.log("🧹 Step 3: Cleaning text with OpenAI...");
    await step(bookTitle);
    console.log(
      `*****************************************************************************
    🧹 Step 3: Cleaning text with OpenAI...
     *****************************************************************************
     \n\n
     `
    );
  } catch (error) {
    return error;
  }
}

export async function callFour(step, bookTitle, language) {
  try {
    console.log(`🌍 Step 4: Translating text to ${language}...`);
    await step(bookTitle, language);
    console.log(
      `*****************************************************************************
    🌍 Step 4: Translating text to ${language}...
     *****************************************************************************
     \n\n
     `
    );
  } catch (error) {
    return error;
  }
}

export async function callFive(step, voice, bookTitle, language) {
  try {
    console.log("🎤 Step 5: Converting text to speech...");
    await step(voice, bookTitle, language);
    console.log(
      `*****************************************************************************
    🎤 Step 5: Converting text to speech...
     *****************************************************************************
     \n\n
     `
    );
  } catch (error) {
    return error;
  }
}
