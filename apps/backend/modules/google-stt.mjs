import fs from "fs";
import dotenv from "dotenv";
import { GoogleAuth } from "google-auth-library";

dotenv.config();

/**
 * Transcribe audio using Google Cloud Speech-to-Text API v1 (Free tier)
 * 
 * To use this, you need to:
 * 1. Create a Google Cloud project
 * 2. Enable the Speech-to-Text API
 * 3. Create a service account and download the JSON key
 * 4. Set the GOOGLE_APPLICATION_CREDENTIALS environment variable to point to the JSON key file
 * 
 * Uses the v1 REST API endpoint which is free for basic usage
 */

async function transcribeWithGoogle(audioFilePath, language = "english") {
  try {
    console.log(`[Google STT] ===== Starting transcription =====`);
    console.log(`[Google STT] Language parameter: ${language}`);
    console.log(`[Google STT] Audio file: ${audioFilePath}`);
    console.log(`[Google STT] File exists: ${fs.existsSync(audioFilePath)}`);
    
    if (!fs.existsSync(audioFilePath)) {
      throw new Error(`Audio file not found: ${audioFilePath}`);
    }
    
    const fileStats = fs.statSync(audioFilePath);
    console.log(`Audio file size: ${fileStats.size} bytes`);
    
    if (fileStats.size === 0) {
      throw new Error("Audio file is empty");
    }
    
    // Read credentials and get access token
    const auth = new GoogleAuth({
      keyFile: process.env.GOOGLE_APPLICATION_CREDENTIALS,
      scopes: ['https://www.googleapis.com/auth/cloud-platform'],
    });

    console.log("Getting access token...");
    const client = await auth.getClient();
    const accessToken = await client.getAccessToken();
    console.log("Access token obtained");

    // Reads a local audio file and converts it to base64
    const file = fs.readFileSync(audioFilePath);
    const audioBytes = file.toString('base64');

    // Use v1 REST API endpoint (free tier)
    const apiUrl = 'https://speech.googleapis.com/v1/speech:recognize';
    
    // Map language to Google STT language codes
    // Handle all variations: "english", "en", "hindi", "hi", "telugu", "te"
    const lang = language.toLowerCase().trim();
    let languageCode = 'en-US'; // Default to English
    let alternativeLanguageCodes = []; // Alternative codes to try if primary fails
    
    if (lang === 'hindi' || lang === 'hi') {
      languageCode = 'hi-IN';
      alternativeLanguageCodes = ['hi']; // Fallback to generic Hindi
      console.log(`[Google STT] ✅ Hindi selected - using language code: ${languageCode}`);
    } else if (lang === 'telugu' || lang === 'te') {
      languageCode = 'te-IN';
      alternativeLanguageCodes = ['te']; // Fallback to generic Telugu
      console.log(`[Google STT] ✅ Telugu selected - using language code: ${languageCode}`);
    } else if (lang === 'english' || lang === 'en') {
      languageCode = 'en-US';
      alternativeLanguageCodes = ['en-GB', 'en'];
      console.log(`[Google STT] ✅ English selected - using language code: ${languageCode}`);
    } else {
      console.warn(`[Google STT] ⚠️ Unknown language: ${language}, defaulting to en-US`);
    }
    
    console.log(`[Google STT] ===== Language Configuration =====`);
    console.log(`[Google STT] Input language parameter: "${language}"`);
    console.log(`[Google STT] Normalized language: "${lang}"`);
    console.log(`[Google STT] Primary language code: ${languageCode}`);
    console.log(`[Google STT] Alternative codes: ${alternativeLanguageCodes.join(', ') || 'none'}`);
    console.log(`[Google STT] ⚠️ CRITICAL: Transcription will be in ${languageCode}`);
    
    const requestBody = {
      config: {
        encoding: 'LINEAR16', // LINEAR16 is for WAV files
        sampleRateHertz: 16000,
        languageCode: languageCode, // CRITICAL: This determines transcription language
        enableAutomaticPunctuation: true,
        enableWordTimeOffsets: false,
        // Add alternative language hints for better accuracy
        alternativeLanguageCodes: alternativeLanguageCodes.length > 0 ? alternativeLanguageCodes : undefined,
      },
      audio: {
        content: audioBytes,
      },
    };
    
    // Remove undefined fields
    if (!requestBody.config.alternativeLanguageCodes) {
      delete requestBody.config.alternativeLanguageCodes;
    }
    
    console.log(`[Google STT] ===== Sending Request to Google STT API =====`);
    console.log(`[Google STT] Request config:`, JSON.stringify(requestBody.config, null, 2));
    console.log(`[Google STT] ⚠️ CRITICAL: languageCode is set to: ${languageCode}`);
    console.log(`[Google STT] This will transcribe audio in ${languageCode} language`);

    // Make request to v1 REST API
    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken.token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestBody),
    });

    if (!response.ok) {
      const errorText = await response.text();
      let errorData;
      try {
        errorData = JSON.parse(errorText);
      } catch (e) {
        errorData = { message: errorText };
      }
      console.error(`Google STT API error: ${response.status}`);
      console.error(`Error details:`, errorData);
      throw new Error(`Google STT API error: ${response.status} - ${JSON.stringify(errorData)}`);
    }

    const data = await response.json();
    console.log(`[Google STT] ===== API Response Received =====`);
    console.log(`[Google STT] Response:`, JSON.stringify(data, null, 2));
    
    if (!data.results || data.results.length === 0) {
      console.warn(`[Google STT] ⚠️ No transcription results returned`);
      console.warn(`[Google STT] Full API response:`, JSON.stringify(data, null, 2));
      console.warn(`[Google STT] This might indicate:`);
      console.warn(`[Google STT]   1. Audio quality too poor`);
      console.warn(`[Google STT]   2. Language code ${languageCode} not supported`);
      console.warn(`[Google STT]   3. Audio format issues`);
      return '';
    }

    const transcription = data.results
      .map(result => result.alternatives[0].transcript)
      .join('\n');
      
    console.log(`[Google STT] ===== Transcription Result =====`);
    console.log(`[Google STT] Transcribed text: "${transcription}"`);
    console.log(`[Google STT] Transcription length: ${transcription.length} characters`);
    
    // Validate transcription language matches requested language
    if (lang === 'telugu' || lang === 'te') {
      const teluguScriptRegex = /[\u0C00-\u0C7F]/;
      const hasTelugu = teluguScriptRegex.test(transcription);
      console.log(`[Google STT] Transcription contains Telugu script: ${hasTelugu ? '✅ YES' : '❌ NO'}`);
      if (!hasTelugu && transcription.length > 0) {
        console.warn(`[Google STT] ⚠️ WARNING: Requested Telugu but transcription appears to be in English or another language`);
        console.warn(`[Google STT] Transcription: "${transcription}"`);
      }
    } else if (lang === 'hindi' || lang === 'hi') {
      const hindiScriptRegex = /[\u0900-\u097F]/;
      const hasHindi = hindiScriptRegex.test(transcription);
      console.log(`[Google STT] Transcription contains Hindi script: ${hasHindi ? '✅ YES' : '❌ NO'}`);
      if (!hasHindi && transcription.length > 0) {
        console.warn(`[Google STT] ⚠️ WARNING: Requested Hindi but transcription appears to be in English or another language`);
        console.warn(`[Google STT] Transcription: "${transcription}"`);
      }
    }
    
    return transcription;
  } catch (error) {
    console.error('Google STT Error:', error);
    throw error;
  }
}

export { transcribeWithGoogle };