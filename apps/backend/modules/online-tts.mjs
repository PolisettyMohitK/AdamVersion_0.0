import { execSync } from "child_process";
import fs from "fs";
import { join } from "path";
import { tmpdir } from "os";

/**
 * Convert text to speech using online TTS APIs as fallback
 * Uses Google Translate TTS API (free, no API key required)
 */

/**
 * Convert text to speech using Google Translate TTS API
 * @param {Object} params - Parameters object
 * @param {string} params.text - Text to convert to speech
 * @param {string} params.fileName - Output audio file path
 * @param {string} params.language - Language code (hindi, telugu)
 */
async function convertTextToSpeechOnline({ text, fileName, language }) {
  try {
    // Map language names to Google TTS language codes
    const languageMap = {
      hindi: "hi",
      telugu: "te",
      english: "en"
    };

    const langCode = languageMap[language.toLowerCase()];
    if (!langCode) {
      throw new Error(`Unsupported language for online TTS: ${language}`);
    }

    console.log(`Using Google TTS API for ${language} (code: ${langCode})`);

    // Split long text into chunks (Google TTS has character limits)
    const maxLength = 200; // Safe limit for Google TTS
    const textChunks = [];
    let currentChunk = "";
    
    const words = text.split(/\s+/);
    for (const word of words) {
      if ((currentChunk + " " + word).length > maxLength && currentChunk.length > 0) {
        textChunks.push(currentChunk.trim());
        currentChunk = word;
      } else {
        currentChunk += (currentChunk ? " " : "") + word;
      }
    }
    if (currentChunk.trim().length > 0) {
      textChunks.push(currentChunk.trim());
    }

    const tempOutput = join(tmpdir(), `tts_online_${Date.now()}.mp3`);
    const tempFiles = [];

    // Download each chunk
    for (let i = 0; i < textChunks.length; i++) {
      const chunk = textChunks[i];
      const encodedText = encodeURIComponent(chunk);
      
      // Google Translate TTS API endpoint (free, no API key required)
      const ttsUrl = `https://translate.google.com/translate_tts?ie=UTF-8&tl=${langCode}&client=tw-ob&q=${encodedText}`;
      
      const chunkFile = join(tmpdir(), `tts_chunk_${Date.now()}_${i}.mp3`);
      tempFiles.push(chunkFile);

      try {
        // Try using PowerShell Invoke-WebRequest on Windows
        if (process.platform === "win32") {
          const psScript = `
            $url = "${ttsUrl.replace(/"/g, '`"')}"
            $output = "${chunkFile.replace(/\\/g, '/')}"
            try {
              Invoke-WebRequest -Uri $url -OutFile $output -UseBasicParsing -ErrorAction Stop
              Write-Host "Downloaded chunk $i"
            } catch {
              Write-Host "Error: $_"
              exit 1
            }
          `;
          fs.writeFileSync('download_tts.ps1', psScript);
          execSync('powershell -ExecutionPolicy Bypass -File download_tts.ps1', { stdio: 'pipe' });
          fs.unlinkSync('download_tts.ps1');
        } else {
          // Try curl on Linux/Mac
          execSync(`curl -L "${ttsUrl}" -o "${chunkFile}"`, { stdio: 'pipe' });
        }
      } catch (error) {
        console.error(`Error downloading chunk ${i}:`, error.message);
        // Clean up temp files
        tempFiles.forEach(f => { if (fs.existsSync(f)) fs.unlinkSync(f); });
        throw error;
      }
    }

    // Combine chunks using ffmpeg if available, otherwise just use first chunk
    if (tempFiles.length > 1) {
      try {
        const fileList = tempFiles.map(f => `file '${f.replace(/\\/g, '/')}'`).join('\n');
        const listFile = join(tmpdir(), `filelist_${Date.now()}.txt`);
        fs.writeFileSync(listFile, fileList);
        
        execSync(`ffmpeg -f concat -safe 0 -i "${listFile}" -c copy "${tempOutput}" -y`, { stdio: 'pipe' });
        fs.unlinkSync(listFile);
      } catch (ffmpegError) {
        console.warn("FFmpeg not available, using first chunk only");
        fs.copyFileSync(tempFiles[0], tempOutput);
      }
    } else {
      fs.copyFileSync(tempFiles[0], tempOutput);
    }

    // Clean up chunk files
    tempFiles.forEach(f => { if (fs.existsSync(f)) fs.unlinkSync(f); });

    // Check if file was downloaded
    if (fs.existsSync(tempOutput) && fs.statSync(tempOutput).size > 0) {
      // Copy to final location
      fs.copyFileSync(tempOutput, fileName);
      fs.unlinkSync(tempOutput);
      console.log(`Online TTS completed: ${fileName}`);
      return true;
    } else {
      throw new Error("Downloaded file is empty or doesn't exist");
    }

  } catch (error) {
    console.error(`Error in online TTS conversion for ${language}:`, error.message);
    return false;
  }
}

export { convertTextToSpeechOnline };

