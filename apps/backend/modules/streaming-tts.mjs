/**
 * Streaming TTS for real-time audio playback
 * Generates audio chunks and streams them to the client
 */

import { synthesizeSpeech } from './google-tts.mjs';
import fs from 'fs';
import { Readable } from 'stream';

/**
 * Generate streaming TTS audio for Telugu text
 * Returns a readable stream of audio data
 * 
 * @param {string} text - Text to convert to speech (Telugu)
 * @param {string} language - Language code ('telugu' or 'te')
 * @returns {Promise<Readable>} - Stream of audio data
 */
async function generateStreamingTTS(text, language = 'telugu') {
  try {
    console.log(`[Streaming TTS] Generating audio for: ${text.substring(0, 50)}...`);
    console.log(`[Streaming TTS] Language: ${language}`);
    
    // Create a temporary file path
    const tempFile = `audios/stream_${Date.now()}.mp3`;
    
    // Ensure directory exists
    const dir = 'audios';
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    
    // Generate audio using Google Cloud TTS
    await synthesizeSpeech(text, language, tempFile);
    
    // Check if file was created
    if (!fs.existsSync(tempFile)) {
      throw new Error('Audio file was not created');
    }
    
    // Create a readable stream from the file
    const fileStream = fs.createReadStream(tempFile);
    
    // Clean up file after stream ends
    fileStream.on('end', () => {
      setTimeout(() => {
        if (fs.existsSync(tempFile)) {
          fs.unlinkSync(tempFile);
          console.log(`[Streaming TTS] Cleaned up temp file: ${tempFile}`);
        }
      }, 1000);
    });
    
    return fileStream;
  } catch (error) {
    console.error(`[Streaming TTS] Error generating streaming TTS:`, error);
    throw error;
  }
}

/**
 * Generate TTS and return as base64 for immediate playback
 * This is faster than streaming for small chunks
 * 
 * @param {string} text - Text to convert to speech
 * @param {string} language - Language code
 * @returns {Promise<string>} - Base64 encoded audio data
 */
async function generateTTSBase64(text, language = 'telugu') {
  try {
    console.log(`[Streaming TTS] ===== GENERATING BASE64 AUDIO =====`);
    console.log(`[Streaming TTS] Language parameter: ${language}`);
    console.log(`[Streaming TTS] Text: "${text.substring(0, 100)}..."`);
    console.log(`[Streaming TTS] Text length: ${text.length} characters`);
    
    // Normalize language code
    const lang = language.toLowerCase();
    const normalizedLang = lang === 'telugu' || lang === 'te' ? 'telugu' : 
                          lang === 'hindi' || lang === 'hi' ? 'hindi' : language;
    
    console.log(`[Streaming TTS] Normalized language: ${normalizedLang}`);
    
    // Create a temporary file path
    const tempFile = `audios/stream_${Date.now()}.mp3`;
    
    // Ensure directory exists
    const dir = 'audios';
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
      console.log(`[Streaming TTS] Created audios directory`);
    }
    
    console.log(`[Streaming TTS] Calling synthesizeSpeech with:`);
    console.log(`[Streaming TTS]   - text: "${text.substring(0, 50)}..."`);
    console.log(`[Streaming TTS]   - language: ${normalizedLang}`);
    console.log(`[Streaming TTS]   - outputPath: ${tempFile}`);
    
    // Generate audio using Google Cloud TTS
    await synthesizeSpeech(text, normalizedLang, tempFile);
    
    // Verify file was created
    if (!fs.existsSync(tempFile)) {
      throw new Error(`Audio file was not created: ${tempFile}`);
    }
    
    const stats = fs.statSync(tempFile);
    console.log(`[Streaming TTS] ✅ Audio file created: ${tempFile} (${stats.size} bytes)`);
    
    // Read file and convert to base64
    const audioBuffer = fs.readFileSync(tempFile);
    const base64Audio = audioBuffer.toString('base64');
    
    if (!base64Audio || base64Audio.length === 0) {
      throw new Error('Base64 audio is empty after conversion');
    }
    
    console.log(`[Streaming TTS] ✅ Base64 audio generated: ${base64Audio.length} characters`);
    
    // Clean up temp file
    if (fs.existsSync(tempFile)) {
      fs.unlinkSync(tempFile);
      console.log(`[Streaming TTS] Cleaned up temp file: ${tempFile}`);
    }
    
    return base64Audio;
  } catch (error) {
    console.error(`[Streaming TTS] ❌ Error generating base64 TTS:`, error.message);
    console.error(`[Streaming TTS] Error stack:`, error.stack);
    throw error;
  }
}

export { generateStreamingTTS, generateTTSBase64 };

