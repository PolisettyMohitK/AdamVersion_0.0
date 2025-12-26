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
    console.log(`Transcribing with Google STT, language: ${language}`);
    console.log(`Audio file: ${audioFilePath}`);
    console.log(`File exists: ${fs.existsSync(audioFilePath)}`);
    
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
    const languageMap = {
      english: 'en-US',
      hindi: 'hi-IN',
      telugu: 'te-IN'
    };
    
    const languageCode = languageMap[language.toLowerCase()] || 'en-US';
    console.log(`Using language code: ${languageCode}`);
    
    const requestBody = {
      config: {
        encoding: 'LINEAR16', // LINEAR16 is for WAV files
        sampleRateHertz: 16000,
        languageCode: languageCode,
        enableAutomaticPunctuation: true,
        enableWordTimeOffsets: false,
      },
      audio: {
        content: audioBytes,
      },
    };
    
    console.log(`Sending request to Google STT API...`);

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
    console.log("Google STT API response:", JSON.stringify(data, null, 2));
    
    if (!data.results || data.results.length === 0) {
      console.warn('No transcription results returned');
      console.warn('Full API response:', JSON.stringify(data, null, 2));
      return '';
    }

    const transcription = data.results
      .map(result => result.alternatives[0].transcript)
      .join('\n');
      
    console.log(`Transcription: ${transcription}`);
    return transcription;
  } catch (error) {
    console.error('Google STT Error:', error);
    throw error;
  }
}

export { transcribeWithGoogle };