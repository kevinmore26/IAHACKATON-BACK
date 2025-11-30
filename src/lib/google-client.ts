import { GoogleGenAI } from '@google/genai';

// Hardcoded pool of API keys. 
// TODO: Replace with actual different keys if available.
const GOOGLE_API_KEYS = [
  "AIzaSyCsZAfCoBEBXXa4rzFGm_Xf9FtGc6bZFAs",
  "AIzaSyA4xe0QcEBfrxDVYb39jifEbJ2hkxY_Gh4",
  "AIzaSyChlLU--KFf6HjbQMs91Qynb3b7Efj8rPg",
  "AIzaSyCqCiRgEpCs7HoqynHPsAWokGG_FvFq-xM",
  "AIzaSyBNFJjTYDsAN7zdm2VxZtvQIe20z59aINs",
  "AIzaSyAlLEG7ufYzaLjQXW076eS2fzF2JELTS0g",
  "AIzaSyAKL3bYf1BAgdNAhRebYw62O_0kLh5lsZQ",
  "AIzaSyB05xfcriAKtyulyIDpDXSuDtDPfMLrvBQ",
  "AIzaSyBLpfotp-eLXyemBJw0R9pTYEOilcLKGpE",
  "AIzaSyA2KwYcWYYaw_mqMP7JKQ9fP3QXj34c-Mo",
].filter((key): key is string => !!key);

/**
 * Executes an operation with the Google Gen AI client, retrying with different keys on failure.
 * @param operation A function that takes a GoogleGenAI client and returns a promise.
 * @param maxRetries Maximum number of retries (default: 3).
 */
export async function withGoogleAIRetry<T>(
  operation: (client: GoogleGenAI) => Promise<T>,
  maxRetries: number = 4
): Promise<T> {
  let lastError: any;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    // Pick a random key
    const randomKey = GOOGLE_API_KEYS[Math.floor(Math.random() * GOOGLE_API_KEYS.length)];
    
    if (!randomKey) {
      throw new Error("No Google API keys available.");
    }

    const client = new GoogleGenAI({ apiKey: randomKey });

    try {
      return await operation(client);
    } catch (error: any) {
      console.warn(`Google API attempt ${attempt + 1} failed with key ending in ...${randomKey.slice(-4)}:`, error.message);
      lastError = error;
      
      // If it's the last attempt, don't wait, just throw (or let the loop finish and throw)
      if (attempt === maxRetries) break;

      // Optional: Check if error is retryable (e.g., 429). For now, we retry on all errors as requested.
      // We can add a small delay if needed, but the key rotation is the main strategy.
    }
  }

  throw lastError;
}
