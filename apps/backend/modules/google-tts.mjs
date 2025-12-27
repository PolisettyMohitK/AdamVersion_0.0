/**
 * Google Cloud Text-to-Speech Service for Hindi and Telugu
 * 
 * This module provides TTS functionality using Google Cloud TTS API.
 * It's fully isolated and only used for Hindi and Telugu languages.
 * 
 * Setup:
 * 1. Install: npm install @google-cloud/text-to-speech
 * 2. Set environment variable:
 *    Windows: setx GOOGLE_APPLICATION_CREDENTIALS "C:\path\to\service_account.json"
 *    Linux/Mac: export GOOGLE_APPLICATION_CREDENTIALS="/path/to/service_account.json"
 * 3. Or add to .env file: GOOGLE_APPLICATION_CREDENTIALS=./path/to/service_account.json
 */

import { TextToSpeechClient } from '@google-cloud/text-to-speech';
import fs from 'fs';
import { join, dirname } from 'path';
import dotenv from 'dotenv';

dotenv.config();

// Initialize Google Cloud TTS client
let client = null;

function getClient() {
  if (!client) {
    try {
      // Check if credentials are set
      if (!process.env.GOOGLE_APPLICATION_CREDENTIALS) {
        throw new Error('GOOGLE_APPLICATION_CREDENTIALS environment variable not set. Please set it to the path of your service account JSON file.');
      }

      const credsPath = process.env.GOOGLE_APPLICATION_CREDENTIALS;
      console.log(`[Google TTS] Credentials path: ${credsPath}`);
      
      // Check if file exists
      if (!fs.existsSync(credsPath)) {
        throw new Error(`Google Cloud credentials file not found: ${credsPath}`);
      }

      console.log(`[Google TTS] Credentials file found, initializing client...`);

      // Initialize client with credentials
      client = new TextToSpeechClient({
        keyFilename: credsPath
      });
      
      console.log('[Google TTS] ✅ Client initialized successfully');
    } catch (error) {
      console.error('[Google TTS] ❌ Failed to initialize client:', error.message);
      console.error('[Google TTS] Error stack:', error.stack);
      throw error;
    }
  }
  return client;
}

/**
 * Language mapping
 */
const LANGUAGE_MAP = {
  'hindi': 'hi-IN',
  'hi': 'hi-IN',
  'telugu': 'te-IN',
  'te': 'te-IN'
};

/**
 * List available voices for a language code
 * This helps identify which voices are actually available
 */
async function listAvailableVoices(languageCode) {
  try {
    const ttsClient = getClient();
    const [result] = await ttsClient.listVoices({
      languageCode: languageCode
    });
    
    console.log(`[Google TTS] ===== Available voices for ${languageCode} =====`);
    const voices = [];
    result.voices.forEach(voice => {
      const voiceInfo = {
        name: voice.name,
        ssmlGender: voice.ssmlGender,
        naturalSampleRateHertz: voice.naturalSampleRateHertz
      };
      voices.push(voiceInfo);
      console.log(`[Google TTS]   - ${voice.name} (${voice.ssmlGender})`);
    });
    console.log(`[Google TTS] Total voices found: ${voices.length}`);
    return voices;
  } catch (error) {
    console.error(`[Google TTS] Error listing voices for ${languageCode}:`, error.message);
    return [];
  }
}

/**
 * Voice configuration for Hindi and Telugu
 * Using Standard voices (explicitly set to avoid fallback to English)
 * Will auto-detect and use available voices if configured ones don't exist
 */
const VOICE_CONFIG = {
  'hi-IN': {
    languageCode: 'hi-IN',
    name: 'hi-IN-Standard-B', // Standard MALE voice for Hindi
    ssmlGender: 'MALE'
  },
  'te-IN': {
    languageCode: 'te-IN',
    name: 'te-IN-Standard-B', // Standard MALE voice for Telugu (Standard-A is FEMALE)
    ssmlGender: 'MALE'
  }
};

/**
 * Synthesize speech using Google Cloud TTS
 * 
 * @param {string} text - Text to convert to speech
 * @param {string} language - Language code: 'hindi', 'hi', 'telugu', or 'te'
 * @param {string} outputPath - Path where the audio file should be saved
 * @returns {Promise<string>} - Path to the generated audio file
 */
async function synthesizeSpeech(text, language, outputPath) {
  try {
    console.log(`[Google TTS] ===== Synthesizing speech for ${language} =====`);
    
    // CRITICAL: Ensure text is properly encoded as UTF-8
    // Convert to Buffer and back to ensure proper encoding
    const textBuffer = Buffer.from(text, 'utf8');
    const verifiedText = textBuffer.toString('utf8');
    
    if (verifiedText !== text) {
      console.warn(`[Google TTS] ⚠️ Text encoding changed during verification - this may indicate encoding issues`);
    }
    
    console.log(`[Google TTS] Text encoding verified as UTF-8`);
    console.log(`[Google TTS] Text length: ${text.length} characters`);
    console.log(`[Google TTS] Full text: ${text}`);
    console.log(`[Google TTS] Text (first 200 chars): ${text.substring(0, 200)}...`);
    
    // CRITICAL VALIDATION: Validate text contains correct script for the language
    const lang = language.toLowerCase();
    let textHasCorrectScript = false;
    
    if (lang === 'telugu' || lang === 'te') {
      const teluguScriptRegex = /[\u0C00-\u0C7F]/;
      const teluguChars = text.match(teluguScriptRegex);
      const teluguCharCount = teluguChars ? teluguChars.length : 0;
      const totalChars = text.replace(/\s/g, '').length; // Count non-whitespace chars
      const teluguPercentage = totalChars > 0 ? (teluguCharCount / totalChars) * 100 : 0;
      
      console.log(`[Google TTS] Telugu script analysis:`);
      console.log(`[Google TTS]   - Telugu characters found: ${teluguCharCount}`);
      console.log(`[Google TTS]   - Total non-whitespace characters: ${totalChars}`);
      console.log(`[Google TTS]   - Telugu percentage: ${teluguPercentage.toFixed(1)}%`);
      
      if (teluguCharCount === 0) {
        console.error(`[Google TTS] ❌ CRITICAL ERROR: Text does NOT contain any Telugu script characters!`);
        console.error(`[Google TTS] Text: "${text.substring(0, 200)}"`);
        console.error(`[Google TTS] This will cause Google TTS to use English voice!`);
        console.error(`[Google TTS] ⚠️ FORCING Telugu voice anyway - text might be transliterated or Gemini returned English`);
        // Don't throw - force Telugu voice even if text is English/transliterated
        textHasCorrectScript = false;
      } else if (teluguPercentage < 50) {
        console.warn(`[Google TTS] ⚠️ WARNING: Only ${teluguPercentage.toFixed(1)}% of text is Telugu script!`);
        console.warn(`[Google TTS] Text might be mixed or transliterated. Forcing Telugu voice anyway.`);
        textHasCorrectScript = false;
      } else {
        textHasCorrectScript = true;
        console.log(`[Google TTS] ✅ Text contains Telugu script characters (${teluguPercentage.toFixed(1)}% Telugu)`);
      }
    } else if (lang === 'hindi' || lang === 'hi') {
      const hindiScriptRegex = /[\u0900-\u097F]/;
      const hindiChars = text.match(hindiScriptRegex);
      const hindiCharCount = hindiChars ? hindiChars.length : 0;
      const totalChars = text.replace(/\s/g, '').length;
      const hindiPercentage = totalChars > 0 ? (hindiCharCount / totalChars) * 100 : 0;
      
      console.log(`[Google TTS] Hindi script analysis:`);
      console.log(`[Google TTS]   - Hindi characters found: ${hindiCharCount}`);
      console.log(`[Google TTS]   - Total non-whitespace characters: ${totalChars}`);
      console.log(`[Google TTS]   - Hindi percentage: ${hindiPercentage.toFixed(1)}%`);
      
      if (hindiCharCount === 0) {
        console.error(`[Google TTS] ❌ CRITICAL ERROR: Text does NOT contain any Hindi script characters!`);
        console.error(`[Google TTS] Text: "${text.substring(0, 200)}"`);
        console.error(`[Google TTS] This will cause Google TTS to use English voice!`);
        console.error(`[Google TTS] ⚠️ FORCING Hindi voice anyway - text might be transliterated or Gemini returned English`);
        // Don't throw - force Hindi voice even if text is English/transliterated
        textHasCorrectScript = false;
      } else if (hindiPercentage < 50) {
        console.warn(`[Google TTS] ⚠️ WARNING: Only ${hindiPercentage.toFixed(1)}% of text is Hindi script!`);
        console.warn(`[Google TTS] Text might be mixed or transliterated. Forcing Hindi voice anyway.`);
        textHasCorrectScript = false;
      } else {
        textHasCorrectScript = true;
        console.log(`[Google TTS] ✅ Text contains Hindi script characters (${hindiPercentage.toFixed(1)}% Hindi)`);
      }
    }
    
    // Normalize language code
    const normalizedLang = LANGUAGE_MAP[language.toLowerCase()];
    if (!normalizedLang) {
      throw new Error(`Unsupported language: ${language}. Supported: hindi, hi, telugu, te`);
    }

    // Get voice configuration
    const voiceConfig = VOICE_CONFIG[normalizedLang];
    if (!voiceConfig) {
      throw new Error(`No voice configuration found for ${normalizedLang}`);
    }

    console.log(`[Google TTS] Language code: ${normalizedLang}`);
    console.log(`[Google TTS] Configured voice: ${voiceConfig.name} (${voiceConfig.ssmlGender})`);

    // Get client
    const ttsClient = getClient();
    
    // List available voices for this language (for debugging and fallback)
    console.log(`[Google TTS] Listing available voices for ${normalizedLang}...`);
    const availableVoices = await listAvailableVoices(normalizedLang);
    
    if (availableVoices.length === 0) {
      throw new Error(`No voices available for language ${normalizedLang}. Please check your Google Cloud TTS API access.`);
    }
    
    // Find the best matching voice - CRITICAL: Must be for the correct language
    let selectedVoice = null;
    
    // CRITICAL VALIDATION: Ensure we only use voices for the correct language
    // Filter out any voices that don't match the language code
    const languageSpecificVoices = availableVoices.filter(v => {
      // Voice name must start with the language code (e.g., "te-IN-" or "hi-IN-")
      return v.name.startsWith(normalizedLang + '-');
    });
    
    if (languageSpecificVoices.length === 0) {
      console.error(`[Google TTS] ❌ CRITICAL: No voices found for language ${normalizedLang}!`);
      console.error(`[Google TTS] All available voices:`, availableVoices.map(v => v.name));
      throw new Error(`No voices available for language ${normalizedLang}. Available voices are: ${availableVoices.map(v => v.name).join(', ')}`);
    }
    
    console.log(`[Google TTS] Language-specific voices for ${normalizedLang}: ${languageSpecificVoices.length}`);
    languageSpecificVoices.forEach(v => {
      console.log(`[Google TTS]   - ${v.name} (${v.ssmlGender})`);
    });
    
    // First, try to find the configured voice
    const configuredVoice = languageSpecificVoices.find(v => v.name === voiceConfig.name);
    if (configuredVoice) {
      selectedVoice = configuredVoice;
      console.log(`[Google TTS] ✅ Found configured voice: ${selectedVoice.name}`);
    } else {
      // Fallback: find a Standard voice with matching gender
      console.log(`[Google TTS] ⚠️ Configured voice '${voiceConfig.name}' not found. Searching for alternative...`);
      
      // Try to find Standard voice with matching gender (must be language-specific)
      const standardVoice = languageSpecificVoices.find(v => 
        v.name.includes('Standard') && 
        v.ssmlGender === voiceConfig.ssmlGender
      );
      
      if (standardVoice) {
        selectedVoice = standardVoice;
        console.log(`[Google TTS] ✅ Found alternative Standard voice: ${selectedVoice.name}`);
      } else {
        // Last resort: use first language-specific voice (NOT first available - might be wrong language!)
        selectedVoice = languageSpecificVoices[0];
        console.log(`[Google TTS] ⚠️ Using first language-specific voice: ${selectedVoice.name}`);
      }
    }
    
    if (!selectedVoice) {
      throw new Error(`Could not find a suitable voice for ${normalizedLang}`);
    }
    
    // FINAL VALIDATION: Ensure selected voice is for the correct language
    if (!selectedVoice.name.startsWith(normalizedLang + '-')) {
      throw new Error(`CRITICAL ERROR: Selected voice '${selectedVoice.name}' does not match language ${normalizedLang}! This would cause English fallback.`);
    }
    
    console.log(`[Google TTS] ✅ Selected voice: ${selectedVoice.name} (${selectedVoice.ssmlGender}) - VERIFIED for ${normalizedLang}`);

    // Ensure output directory exists
    const outputDir = dirname(outputPath);
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
      console.log(`[Google TTS] Created output directory: ${outputDir}`);
    }

    // Use the verified UTF-8 text
    let cleanText = verifiedText.trim();
    
    // DO NOT remove Telugu/Hindi characters - they are essential!
    // Only remove control characters and zero-width spaces that might confuse TTS
    cleanText = cleanText.replace(/[\u200B-\u200D\uFEFF]/g, ''); // Remove zero-width spaces
    cleanText = cleanText.replace(/[\x00-\x1F\x7F]/g, ''); // Remove control characters except newlines
    cleanText = cleanText.replace(/\n+/g, ' '); // Replace newlines with spaces
    cleanText = cleanText.replace(/\s+/g, ' '); // Normalize whitespace
    cleanText = cleanText.trim();
    
    // Log text details for debugging
    console.log(`[Google TTS] Original text length: ${text.length}`);
    console.log(`[Google TTS] Original text: "${text}"`);
    console.log(`[Google TTS] Text character codes (first 10):`, Array.from(text.substring(0, 10)).map(c => c.charCodeAt(0)));
    
    // Ensure text is valid UTF-8 and contains proper script characters
    if (normalizedLang === 'te-IN') {
      const teluguChars = text.match(/[\u0C00-\u0C7F]/g);
      console.log(`[Google TTS] Telugu characters found: ${teluguChars ? teluguChars.length : 0}`);
      if (teluguChars) {
        console.log(`[Google TTS] Sample Telugu chars: ${teluguChars.slice(0, 10).join('')}`);
      }
    } else if (normalizedLang === 'hi-IN') {
      const hindiChars = text.match(/[\u0900-\u097F]/g);
      console.log(`[Google TTS] Hindi characters found: ${hindiChars ? hindiChars.length : 0}`);
      if (hindiChars) {
        console.log(`[Google TTS] Sample Hindi chars: ${hindiChars.slice(0, 10).join('')}`);
      }
    }

    // Prepare the request - CRITICAL: Explicitly set both languageCode AND voice.name
    // This prevents Google Cloud TTS from falling back to English voice
    // Use the selected voice (either configured or auto-detected)
    
    // FINAL SAFETY CHECK: Ensure voice name matches language code
    if (!selectedVoice.name.startsWith(voiceConfig.languageCode + '-')) {
      throw new Error(`CRITICAL: Voice name '${selectedVoice.name}' does not match language code '${voiceConfig.languageCode}'. This would cause English fallback!`);
    }
    
    // CRITICAL: Force language code - even if text validation failed, we MUST use Telugu/Hindi voice
    const request = {
      input: { 
        text: cleanText 
      },
      voice: {
        languageCode: voiceConfig.languageCode, // MUST be te-IN or hi-IN - NEVER en-US or auto
        name: selectedVoice.name, // MUST be te-IN-* or hi-IN-* - explicitly set to prevent fallback
        ssmlGender: selectedVoice.ssmlGender
      },
      audioConfig: {
        audioEncoding: 'MP3',
        speakingRate: 1.0,
        pitch: 0.0,
        volumeGainDb: 0.0
      }
    };
    
    // Log final validation - CRITICAL CHECKS
    console.log(`[Google TTS] ===== FINAL VALIDATION (CRITICAL) =====`);
    console.log(`[Google TTS] Language Code: ${voiceConfig.languageCode} ${voiceConfig.languageCode === 'te-IN' || voiceConfig.languageCode === 'hi-IN' ? '✅' : '❌ WRONG!'}`);
    console.log(`[Google TTS] Voice Name: ${selectedVoice.name}`);
    console.log(`[Google TTS] Voice matches language: ${selectedVoice.name.startsWith(voiceConfig.languageCode + '-') ? '✅ YES' : '❌ NO - WILL FALLBACK TO ENGLISH!'}`);
    console.log(`[Google TTS] Text contains correct script: ${textHasCorrectScript ? '✅ YES' : '⚠️ WARNING - but forcing correct voice anyway'}`);
    console.log(`[Google TTS] ⚠️ IMPORTANT: Even if text is English, voice is FORCED to ${voiceConfig.languageCode}`);

    console.log(`[Google TTS] ===== Request Configuration =====`);
    console.log(`[Google TTS] Language Code: ${voiceConfig.languageCode} (CRITICAL - must match text language)`);
    console.log(`[Google TTS] Voice Name: ${selectedVoice.name} (verified available voice)`);
    console.log(`[Google TTS] SSML Gender: ${selectedVoice.ssmlGender}`);
    console.log(`[Google TTS] Text being sent: "${cleanText}"`);
    console.log(`[Google TTS] Text length: ${cleanText.length} characters`);
    console.log(`[Google TTS] Text Unicode codes (first 20):`, Array.from(cleanText.substring(0, 20)).map(c => `U+${c.charCodeAt(0).toString(16).toUpperCase().padStart(4, '0')}`).join(' '));
    console.log(`[Google TTS] Full request:`, JSON.stringify(request, null, 2));

    // Perform the text-to-speech request
    console.log(`[Google TTS] ===== Sending request to Google Cloud TTS API =====`);
    console.log(`[Google TTS] API Endpoint: texttospeech.googleapis.com`);
    console.log(`[Google TTS] Method: synthesizeSpeech`);
    
    let response;
    try {
      console.log(`[Google TTS] ===== SENDING REQUEST TO GOOGLE CLOUD TTS =====`);
      console.log(`[Google TTS] REQUEST DETAILS:`);
      console.log(`[Google TTS]   - languageCode: "${request.voice.languageCode}" (MUST be ${voiceConfig.languageCode})`);
      console.log(`[Google TTS]   - voice.name: "${request.voice.name}" (MUST start with ${voiceConfig.languageCode}-)`);
      console.log(`[Google TTS]   - ssmlGender: "${request.voice.ssmlGender}"`);
      console.log(`[Google TTS]   - text length: ${request.input.text.length} characters`);
      console.log(`[Google TTS]   - text preview: "${request.input.text.substring(0, 100)}..."`);
      
      [response] = await ttsClient.synthesizeSpeech(request);
      console.log(`[Google TTS] ✅ Received response from Google Cloud TTS API`);
      console.log(`[Google TTS] Response has audioContent: ${!!response.audioContent}`);
      
      if (response.audioContent) {
        console.log(`[Google TTS] Audio content size: ${response.audioContent.length} bytes`);
        console.log(`[Google TTS] ✅ Audio generated successfully with voice: ${selectedVoice.name}`);
        console.log(`[Google TTS] ⚠️ NOTE: If audio sounds like English, Google TTS may have ignored the voice parameter`);
        console.log(`[Google TTS] ⚠️ This can happen if text is in English script - Google may auto-detect and override`);
      }
    } catch (apiError) {
      console.error(`[Google TTS] ❌ API Error:`, apiError.message);
      console.error(`[Google TTS] Error code:`, apiError.code);
      console.error(`[Google TTS] Error details:`, apiError);
      
      // Check if it's a voice-related error
      if (apiError.message && (apiError.message.includes('does not exist') || apiError.message.includes('INVALID_ARGUMENT'))) {
        console.error(`[Google TTS] ❌ Voice error detected. Available voices for ${normalizedLang}:`);
        availableVoices.forEach(v => {
          console.error(`[Google TTS]   - ${v.name} (${v.ssmlGender})`);
        });
        throw new Error(`Voice '${selectedVoice.name}' is not available. Please check the available voices listed above.`);
      }
      
      // Other errors
      console.error(`[Google TTS] ❌ TTS API call failed. This might indicate:`);
      console.error(`[Google TTS]   1. Incorrect language code: ${voiceConfig.languageCode}`);
      console.error(`[Google TTS]   2. Text encoding issues`);
      console.error(`[Google TTS]   3. API credentials/permissions issue`);
      console.error(`[Google TTS]   4. Network/connectivity issue`);
      throw apiError;
    }

    // Verify we have audio content
    if (!response || !response.audioContent) {
      throw new Error('No audio content received from Google Cloud TTS');
    }

    // Write the audio content to file
    fs.writeFileSync(outputPath, response.audioContent, 'binary');
    
    const stats = fs.statSync(outputPath);
    console.log(`[Google TTS] ✅ Audio file created: ${outputPath} (${stats.size} bytes)`);
    
    return outputPath;
  } catch (error) {
    console.error(`[Google TTS] ❌ Error synthesizing speech:`, error.message);
    throw error;
  }
}

export { synthesizeSpeech };

