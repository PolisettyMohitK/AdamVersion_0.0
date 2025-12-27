import fs from "fs";
import { execSync } from "child_process";
import { promisify } from "util";
import { join, dirname } from "path";
import dotenv from "dotenv";
import { synthesizeSpeech as googleTTS } from "./google-tts.mjs";

dotenv.config();

const exec = promisify(execSync);

/**
 * Convert text to speech
 * 
 * Language routing:
 * - English: Local system TTS (Windows PowerShell, macOS say, Linux espeak)
 * - Hindi/Telugu: Google Cloud TTS (requires GOOGLE_APPLICATION_CREDENTIALS)
 * 
 * @param {string} text - Text to convert to speech
 * @param {string} fileName - Output file path
 * @param {string} language - Language: "english", "hindi", "telugu" (optional, defaults to "english")
 */
async function convertTextToSpeech({ text, fileName, language = "english" }) {
  // Normalize language
  const lang = language.toLowerCase();
  
  // Route Hindi and Telugu to Google Cloud TTS
  if (lang === "hindi" || lang === "hi" || lang === "telugu" || lang === "te") {
    try {
      console.log(`[TTS] ===== Using Google Cloud TTS for ${language} =====`);
      console.log(`[TTS] Text length: ${text.length} characters`);
      console.log(`[TTS] Text preview: ${text.substring(0, 100)}...`);
      
      // Ensure fileName is MP3 for Google TTS
      const mp3FileName = fileName.endsWith('.mp3') ? fileName : fileName.replace(/\.(wav|aiff)$/, '.mp3');
      console.log(`[TTS] Output file: ${mp3FileName}`);
      console.log(`[TTS] Language code: ${lang}`);
      
      await googleTTS(text, lang, mp3FileName);
      
      // Verify file was created
      if (fs.existsSync(mp3FileName)) {
        const stats = fs.statSync(mp3FileName);
        console.log(`[TTS] ✅ Google Cloud TTS successful: ${mp3FileName} (${stats.size} bytes)`);
        return;
      } else {
        throw new Error(`Google TTS file not created: ${mp3FileName}`);
      }
    } catch (error) {
      console.error(`[TTS] ❌ Google Cloud TTS failed for ${language}:`, error.message);
      console.error(`[TTS] Error stack:`, error.stack);
      // Don't fall back to local TTS for Hindi/Telugu - throw error instead
      throw new Error(`Failed to generate ${language} TTS: ${error.message}`);
    }
  }
  
  // Use local TTS for English or as fallback
  console.log(`[TTS] Using local TTS for ${language}`);
  
  try {
    console.log(`Converting text to speech: ${text.substring(0, 50)}...`);
    
    // Try different TTS solutions based on the platform
    const platform = process.platform;
    
    if (platform === "darwin") {
      // macOS - use 'say' command
      try {
        execSync(`say -o "${fileName.replace('.mp3', '.aiff')}" "${text}"`);
        // Convert AIFF to MP3 if needed
        try {
          execSync(`ffmpeg -i "${fileName.replace('.mp3', '.aiff')}" "${fileName}" -y`);
          // Clean up AIFF file
          if (fs.existsSync(fileName.replace('.mp3', '.aiff'))) {
            fs.unlinkSync(fileName.replace('.mp3', '.aiff'));
          }
        } catch (convertError) {
          console.warn("FFmpeg conversion failed, using AIFF file directly");
          // Rename AIFF to MP3 (not ideal but works for basic playback)
          fs.renameSync(fileName.replace('.mp3', '.aiff'), fileName);
        }
        return;
      } catch (error) {
        console.warn("macOS 'say' command failed:", error.message);
      }
    } else if (platform === "win32") {
      // Windows - use PowerShell with .NET SpeechSynthesizer
      try {
        // Properly escape the text for PowerShell
        const escapedText = text.replace(/"/g, '`"').replace(/\$/g, '`$');
        const psScript = `
          Add-Type -AssemblyName System.Speech
          $synth = New-Object System.Speech.Synthesis.SpeechSynthesizer
          # Set voice properties for better quality
          $synth.Rate = 0
          $synth.Volume = 100
          $stream = New-Object System.IO.FileStream("${fileName}", [System.IO.FileMode]::Create)
          $synth.SetOutputToWaveStream($stream)
          $synth.Speak("${escapedText}")
          $stream.Close()
        `;
        
        fs.writeFileSync('tts.ps1', psScript);
        execSync('powershell -ExecutionPolicy Bypass -File tts.ps1');
        fs.unlinkSync('tts.ps1');
        
        // On Windows, we create WAV files directly, so no conversion needed
        console.log("Windows TTS completed, created WAV file");
        return;
      } catch (error) {
        console.warn("Windows PowerShell TTS failed:", error.message);
      }
    } else {
      // Linux or other platforms - try espeak
      try {
        execSync(`espeak -w "${fileName.replace('.mp3', '.wav')}" "${text}"`);
        // Convert WAV to MP3 if ffmpeg is available
        try {
          execSync(`ffmpeg -i "${fileName.replace('.mp3', '.wav')}" "${fileName}" -y`);
          // Clean up WAV file
          if (fs.existsSync(fileName.replace('.mp3', '.wav'))) {
            fs.unlinkSync(fileName.replace('.mp3', '.wav'));
          }
        } catch (convertError) {
          console.warn("FFmpeg conversion failed, using WAV file directly");
          // Rename WAV to MP3 (not ideal but works for basic playback)
          fs.renameSync(fileName.replace('.mp3', '.wav'), fileName);
        }
        return;
      } catch (error) {
        console.warn("espeak command failed:", error.message);
      }
    }
    
    // Fallback: Create a simple placeholder audio file
    console.warn("All TTS methods failed, creating placeholder audio");
    createPlaceholderAudio(fileName);
    
  } catch (error) {
    console.error("Error in convertTextToSpeech:", error);
    // Create a placeholder audio file as fallback
    createPlaceholderAudio(fileName);
  }
}

function createPlaceholderAudio(fileName) {
  // Create a simple silent WAV file as placeholder (more compatible than MP3)
  // This is a minimal valid WAV file (silent, ~1 second)
  const silentWav = Buffer.from([
    0x52, 0x49, 0x46, 0x46, 0x24, 0x00, 0x00, 0x00, 0x57, 0x41, 0x56, 0x45, 0x66, 0x6d, 0x74, 0x20,
    0x10, 0x00, 0x00, 0x00, 0x01, 0x00, 0x01, 0x00, 0x40, 0x1f, 0x00, 0x00, 0x80, 0x3e, 0x00, 0x00,
    0x02, 0x00, 0x10, 0x00, 0x64, 0x61, 0x74, 0x61, 0x00, 0x00, 0x00, 0x00
  ]);
  
  fs.writeFileSync(fileName, silentWav);
}

export { convertTextToSpeech };

