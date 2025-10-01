// a set of functions that log the current step and return with an error if it fails

export async function logOne(step) {
  try {
    console.log(
      "*****************************************************************************\n" +
        "🚀 Step 1: Starting complete OCR + Text Combination + AI Cleaning + TTS pipeline... \n" +
        "*****************************************************************************\n"
    );
    await step();
    console.log(
      ` ✅ Step 1: OCR processing completed! Processed ${imageFiles.length} images. \n\n\n`
    );
  } catch (error) {
    return error;
  }
}

export async function logTwo(step) {
  try {
    console.log(
      "*****************************************************************************\n" +
        "📚 Step 2: Combining text files...\n" +
        "*****************************************************************************\n\n"
    );

    await step();
    console.log(` ✅ Step 2: Done combining text files. \n\n\n`);
  } catch (error) {
    return error;
  }
}

export async function logThree(step, bookTitle) {
  try {
    console.log(
      "*****************************************************************************\n" +
        "🧹 Step 3: Cleaning text with OpenAI...\n" +
        "*****************************************************************************\n\n"
    );
    await step(bookTitle);

    console.log(` ✅ Step 3: Done cleaning text with OpenAI. \n\n\n`);
  } catch (error) {
    return error;
  }
}

export async function logFour(step, bookTitle, language) {
  try {
    console.log(
      "*****************************************************************************\n" +
        `🌍 Step 4: Translating text to ${language}...\n` +
        "*****************************************************************************\n\n"
    );
    await step(bookTitle, language);

    console.log(` ✅ Step 4: Done translating text to ${language}. \n\n\n`);
  } catch (error) {
    return error;
  }
}

export async function logFive(step, voice, bookTitle, language) {
  try {
    console.log(
      "***************************************************************************** \n" +
        "🎤 Step 5: Converting text to speech...\n" +
        "*****************************************************************************\n\n"
    );
    await step(voice, bookTitle, language);

    console.log(` ✅ Step 5: Done converting text to speech. \n\n\n`);
  } catch (error) {
    return error;
  }
}

export async function logSix(step, bookTitle) {
  try {
    console.log(
      "*****************************************************************************\n" +
        "🎵 Step 6: Concatenating audio files...\n" +
        "*****************************************************************************\n\n"
    );
    await step(bookTitle);
    console.log(` ✅ Step 6: Audio concatenation completed! \n\n\n`);
  } catch (error) {
    return error;
  }
}
