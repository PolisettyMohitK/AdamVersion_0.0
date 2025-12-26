import fs from "fs";
import dotenv from "dotenv";
import { GoogleAuth } from "google-auth-library";

dotenv.config();

/**
 * Convert text to speech using Google Cloud Text-to-Speech API with Standard voices
 * 
 * Standard voices provide high-quality, natural-sounding speech synthesis.
 * Benefits: 4 million free characters per month (vs 1M for WaveNet)
 * Supports multiple languages:
 * - English: Uses Standard voices (en-US-Standard-D)
 * - Hindi: Uses Standard voices (hi-IN-Standard-A)
 * - Telugu: Uses Standard voices (te-IN-Standard-A)
 * 
 * To use this, you need:
 * 1. Google Cloud project with Text-to-Speech API enabled
 * 2. Service account credentials JSON file
 * 3. GOOGLE_APPLICATION_CREDENTIALS environment variable set
 */

// Voice mapping for different languages - Using Standard voices for better free tier (4M chars/month)
const VOICE_MAP = {
  english: {
    languageCode: 'en-US',
    voiceName: 'en-US-Standard-D', // Male voice (Standard)
    ssmlGender: 'MALE'
  },
  hindi: {
    languageCode: 'hi-IN',
    voiceName: 'hi-IN-Standard-B', // Male voice (Standard)
    ssmlGender: 'MALE'
  },
  telugu: {
    languageCode: 'te-IN',
    voiceName: 'te-IN-Standard-B', // Male voice (Standard)
    ssmlGender: 'MALE'
  }
};

/**
 * Convert text to speech using Google Cloud TTS with Standard voices
 * @param {Object} params - Parameters object
 * @param {string} params.text - Text to convert to speech
 * @param {string} params.fileName - Output audio file path
 * @param {string} params.language - Language (english, hindi, telugu)
 */
async function convertTextToSpeechWaveNet({ text, fileName, language = "english" }) {
  try {
    console.log(`Converting text to speech using Google Cloud TTS (Standard voices)`);
    console.log(`Language: ${language}`);
    console.log(`Text length: ${text.length} characters`);
    
    // Check if credentials are available
    if (!process.env.GOOGLE_APPLICATION_CREDENTIALS) {
      throw new Error("GOOGLE_APPLICATION_CREDENTIALS not set");
    }
    
    if (!fs.existsSync(process.env.GOOGLE_APPLICATION_CREDENTIALS)) {
      throw new Error(`Credentials file not found: ${process.env.GOOGLE_APPLICATION_CREDENTIALS}`);
    }
    
    // Get voice configuration
    const voiceConfig = VOICE_MAP[language.toLowerCase()];
    if (!voiceConfig) {
      throw new Error(`Unsupported language for Google TTS: ${language}`);
    }
    
    console.log(`Using voice: ${voiceConfig.voiceName} (${voiceConfig.languageCode})`);
    
    // Authenticate with Google Cloud
    const auth = new GoogleAuth({
      keyFile: process.env.GOOGLE_APPLICATION_CREDENTIALS,
      scopes: ['https://www.googleapis.com/auth/cloud-platform'],
    });
    
    console.log("Getting access token...");
    const client = await auth.getClient();
    const accessToken = await client.getAccessToken();
    console.log("Access token obtained");
    
    // Google Cloud TTS API endpoint
    const apiUrl = 'https://texttospeech.googleapis.com/v1/text:synthesize';
    
    // Prepare request body
    const requestBody = {
      input: {
        text: text
      },
      voice: {
        languageCode: voiceConfig.languageCode,
        name: voiceConfig.voiceName,
        ssmlGender: voiceConfig.ssmlGender
      },
      audioConfig: {
        audioEncoding: 'MP3',
        speakingRate: 1.0,
        pitch: 0.0,
        volumeGainDb: 0.0
      }
    };
    
    console.log(`Sending request to Google Cloud TTS API...`);
    
    // Make request to Google Cloud TTS API
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
      console.error(`Google TTS API error: ${response.status}`);
      console.error(`Error details:`, errorData);
      throw new Error(`Google TTS API error: ${response.status} - ${JSON.stringify(errorData)}`);
    }
    
    const data = await response.json();
    
    if (!data.audioContent) {
      throw new Error("No audio content in response");
    }
    
    // Decode base64 audio content
    const audioBuffer = Buffer.from(data.audioContent, 'base64');
    
    // Write audio file
    fs.writeFileSync(fileName, audioBuffer);
    
    console.log(`Google Cloud TTS completed: ${fileName}`);
    console.log(`Audio file size: ${audioBuffer.length} bytes`);
    
    return true;
    
  } catch (error) {
    console.error('Google Cloud TTS Error:', error);
    console.error('Error details:', error.message);
    if (error.stack) {
      console.error('Stack trace:', error.stack);
    }
    throw error;
  }
}

export { convertTextToSpeechWaveNet };

