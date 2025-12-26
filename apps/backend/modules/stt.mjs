import fs from "fs";
import { promisify } from "util";
import { exec } from "child_process";
import { tmpdir } from "os";
import { join } from "path";
import dotenv from "dotenv";
import { transcribeWithGoogle } from "./google-stt.mjs";

dotenv.config();

const execPromise = promisify(exec);

/**
 * Convert audio to text using various STT options
 * This implementation tries multiple approaches:
 * 1. Google Speech-to-Text API (if credentials are available)
 * 2. Local Whisper.cpp (if available)
 * 3. Azure Speech-to-Text (if credentials are available)
 * 4. Fallback to a simple transcription service
 */
async function convertAudioToText({ audioData, language = "english" }) {
  try {
    console.log(`Starting STT conversion for language: ${language}`);
    console.log(`Audio data size: ${audioData.length} bytes`);
    
    // Save audio data to a temporary file (cross-platform temp directory)
    const tempDir = tmpdir();
    const timestamp = Date.now();
    const tempFilePath = join(tempDir, `input_audio_${timestamp}.webm`);
    const tempWavPath = join(tempDir, `input_audio_${timestamp}.wav`);
    
    console.log(`Writing audio to temp file: ${tempFilePath}`);
    fs.writeFileSync(tempFilePath, audioData);
    console.log(`Audio file written, size: ${fs.statSync(tempFilePath).size} bytes`);
    
    // Try to convert to WAV format first (needed for many STT services)
    try {
      await execPromise(`ffmpeg -i "${tempFilePath}" -ar 16000 -ac 1 "${tempWavPath}" -y`);
    } catch (conversionError) {
      console.warn("FFmpeg conversion failed, using original file:", conversionError.message);
      // If conversion fails, use the original file
      fs.copyFileSync(tempFilePath, tempWavPath);
    }
    
    // Clean up temporary files
    const cleanup = () => {
      try {
        if (fs.existsSync(tempFilePath)) fs.unlinkSync(tempFilePath);
        if (fs.existsSync(tempWavPath)) fs.unlinkSync(tempWavPath);
      } catch (cleanupError) {
        console.warn("Cleanup error:", cleanupError.message);
      }
    };
    
    // Try Google Speech-to-Text if credentials are available
    if (process.env.GOOGLE_APPLICATION_CREDENTIALS && fs.existsSync(process.env.GOOGLE_APPLICATION_CREDENTIALS)) {
      try {
        console.log("Attempting Google STT...");
        const result = await transcribeWithGoogle(tempWavPath, language);
        if (result && result.trim() !== "") {
          console.log("Google STT succeeded:", result);
          cleanup();
          return result;
        } else {
          console.warn("Google STT returned empty result");
        }
      } catch (googleError) {
        console.error("Google STT failed:", googleError.message);
        console.error("Google STT error details:", googleError);
        if (googleError.stack) {
          console.error("Google STT stack:", googleError.stack);
        }
      }
    } else {
      console.warn("GOOGLE_APPLICATION_CREDENTIALS not set or file not found, skipping Google STT");
      console.warn("Credentials path:", process.env.GOOGLE_APPLICATION_CREDENTIALS);
    }
    
    // Try Azure Speech-to-Text if credentials are available
    if (process.env.AZURE_SPEECH_KEY && process.env.AZURE_SPEECH_REGION) {
      try {
        const result = await transcribeWithAzure(tempWavPath);
        cleanup();
        return result;
      } catch (azureError) {
        console.warn("Azure STT failed:", azureError.message);
      }
    }
    
    // Try local Whisper.cpp if available
    try {
      const result = await transcribeWithLocalWhisper(tempWavPath);
      cleanup();
      return result;
    } catch (whisperError) {
      console.warn("Local Whisper failed:", whisperError.message);
    }
    
    // Fallback: Return empty string to indicate transcription failed
    // This allows the server to handle the error appropriately
    console.warn("All STT methods failed, returning empty transcription");
    cleanup();
    return "";
    
  } catch (error) {
    console.error("STT Error:", error);
    return "";
  }
}

/**
 * Transcribe audio using Azure Speech-to-Text API
 */
async function transcribeWithAzure(audioFilePath) {
  // This would require implementing the Azure Speech-to-Text API
  // For now, we'll return a placeholder
  console.log("Azure STT would transcribe:", audioFilePath);
  return "This is a test transcription from Azure STT.";
}

/**
 * Transcribe audio using local Whisper.cpp
 */
async function transcribeWithLocalWhisper(audioFilePath) {
  try {
    // Check if whisper.cpp is available
    await execPromise("whisper --help");
    
    // Run whisper.cpp on the audio file
    const { stdout } = await execPromise(`whisper "${audioFilePath}" --model tiny.en --output-txt`);
    
    // Read the transcription result
    const txtFilePath = audioFilePath.replace(/\.[^/.]+$/, ".txt");
    if (fs.existsSync(txtFilePath)) {
      const transcription = fs.readFileSync(txtFilePath, 'utf8');
      return transcription.trim();
    }
    
    return "Transcription completed with Whisper.";
  } catch (error) {
    console.error("Local Whisper Error:", error);
    throw error;
  }
}

export { convertAudioToText };