import { convertTextToSpeech } from "./local-tts.mjs";
import { getPhonemes } from "./rhubarbLipSync.mjs";
import { readJsonTranscript, audioFileToBase64 } from "../utils/files.mjs";
import { generateTTSBase64 } from "./streaming-tts.mjs";
import fs from "fs";

const MAX_RETRIES = 10;
const RETRY_DELAY = 0;

const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const lipSync = async (response, language = "english") => {
  // Extract messages from response, preserving other properties
  const { messages, ...otherProps } = response;
  
  console.log(`[LipSync] Starting lip sync for ${messages.length} messages in ${language}`);
  
  await Promise.all(
    messages.map(async (message, index) => {
      const fileName = `audios/message_${index}.mp3`;
      const wavFileName = `audios/message_${index}.wav`;

      console.log(`[LipSync] Processing message ${index} in ${language}`);
      console.log(`[LipSync] Message text (first 100 chars): ${message.text.substring(0, 100)}...`);
      console.log(`[LipSync] Message text (FULL): "${message.text}"`);
      console.log(`[LipSync] Message text length: ${message.text.length} characters`);
      
      // Validate text script for Telugu/Hindi
      const lang = language.toLowerCase();
      if (lang === 'telugu' || lang === 'te') {
        const teluguScriptRegex = /[\u0C00-\u0C7F]/;
        if (!teluguScriptRegex.test(message.text)) {
          console.error(`[LipSync] ❌ ERROR: Message text does NOT contain Telugu script!`);
          console.error(`[LipSync] Text appears to be: ${message.text.substring(0, 200)}`);
        } else {
          console.log(`[LipSync] ✅ Text contains Telugu script characters`);
        }
      } else if (lang === 'hindi' || lang === 'hi') {
        const hindiScriptRegex = /[\u0900-\u097F]/;
        if (!hindiScriptRegex.test(message.text)) {
          console.error(`[LipSync] ❌ ERROR: Message text does NOT contain Hindi script!`);
          console.error(`[LipSync] Text appears to be: ${message.text.substring(0, 200)}`);
        } else {
          console.log(`[LipSync] ✅ Text contains Hindi script characters`);
        }
      }
      
      // Generate TTS with language parameter
      // For Telugu/Hindi, use streaming TTS for faster response
      try {
        console.log(`[LipSync] ===== Generating TTS for message ${index} =====`);
        console.log(`[LipSync] Language: ${language}`);
        console.log(`[LipSync] Text being sent to TTS: "${message.text}"`);
        console.log(`[LipSync] Text length: ${message.text.length} characters`);
        
        const lang = language.toLowerCase();
        
        // For Telugu/Hindi, use streaming TTS (faster, no file creation delay)
        if (lang === "telugu" || lang === "te" || lang === "hindi" || lang === "hi") {
          console.log(`[LipSync] ===== USING STREAMING TTS FOR ${language.toUpperCase()} =====`);
          console.log(`[LipSync] Language code: ${lang}`);
          console.log(`[LipSync] Text: "${message.text}"`);
          console.log(`[LipSync] Text length: ${message.text.length} characters`);
          
          try {
            // Generate base64 audio directly (no file creation)
            console.log(`[LipSync] Calling generateTTSBase64 with language: ${lang}`);
            const base64Audio = await generateTTSBase64(message.text, lang);
            
            if (!base64Audio || base64Audio.length === 0) {
              throw new Error('Generated base64 audio is empty');
            }
            
            console.log(`[LipSync] ✅ Base64 audio generated: ${base64Audio.length} characters`);
            
            // Store base64 in message for immediate playback
            message.audio = base64Audio;
            message.audioFormat = "mp3";
            
            // Create a temp file for lip sync processing (rhubarb needs a file)
            const tempFile = `audios/message_${index}_temp.mp3`;
            const audioBuffer = Buffer.from(base64Audio, 'base64');
            fs.writeFileSync(tempFile, audioBuffer);
            
            console.log(`[LipSync] ✅ Temp file created: ${tempFile} (${audioBuffer.length} bytes)`);
            
            // Store temp file path in message for later lip sync processing
            message._tempAudioFile = tempFile;
            
            console.log(`[LipSync] ✅ Streaming TTS completed for message ${index}`);
            console.log(`[LipSync] Message now has audio: ${!!message.audio}`);
            console.log(`[LipSync] Message audio format: ${message.audioFormat}`);
          } catch (ttsError) {
            console.error(`[LipSync] ❌ Streaming TTS failed for message ${index}:`, ttsError.message);
            console.error(`[LipSync] Error stack:`, ttsError.stack);
            throw ttsError; // Re-throw to be caught by outer catch
          }
        } else {
          // For English, use regular file-based TTS
          await convertTextToSpeech({ text: message.text, fileName: wavFileName, language });
          console.log(`[LipSync] ✅ TTS completed for message ${index}`);
        }
      } catch (error) {
        console.error(`[LipSync] ❌ TTS failed for message ${index}:`, error.message);
        console.error(`[LipSync] Error details:`, error);
        
        // For Hindi/Telugu, don't create placeholder - re-throw error
        const lang = language.toLowerCase();
        if (lang === "hindi" || lang === "hi" || lang === "telugu" || lang === "te") {
          console.error(`[LipSync] ❌ Cannot fallback to local TTS for ${language} - Google TTS is required`);
          throw new Error(`Failed to generate ${language} TTS: ${error.message}`);
        }
        
        // For English, create placeholder on failure
        const placeholder = Buffer.from([0x52, 0x49, 0x46, 0x46, 0x24, 0x00, 0x00, 0x00, 0x57, 0x41, 0x56, 0x45, 0x66, 0x6d, 0x74, 0x20, 0x10, 0x00, 0x00, 0x00, 0x01, 0x00, 0x01, 0x00, 0x40, 0x1f, 0x00, 0x00, 0x80, 0x3e, 0x00, 0x00, 0x02, 0x00, 0x10, 0x00, 0x64, 0x61, 0x74, 0x61, 0x00, 0x00, 0x00, 0x00]);
        fs.writeFileSync(wavFileName, placeholder);
        console.log(`[LipSync] Placeholder audio created for message ${index}`);
      }
    })
  );

  await Promise.all(
    messages.map(async (message, index) => {
      const fileName = `audios/message_${index}.mp3`;
      const wavFileName = `audios/message_${index}.wav`;
      const jsonFileName = `audios/message_${index}.json`;

      try {
        // Check if audio is already in base64 (from streaming TTS for Telugu/Hindi)
        if (message.audio && message.audioFormat && message._tempAudioFile) {
          console.log(`[LipSync] Message ${index} already has base64 audio (streaming TTS)`);
          
          // Generate lip sync using temp file
          const tempFile = message._tempAudioFile;
          if (fs.existsSync(tempFile)) {
            await getPhonemes({ message: index, language, audioFile: tempFile });
            
            // Read lip sync data
            const lipsyncData = await readJsonTranscript({ fileName: jsonFileName });
            console.log(`Lip sync data for message ${index}:`, JSON.stringify(lipsyncData).substring(0, 200));
            
            // Audio and format already set, just add lip sync
            message.lipsync = lipsyncData;
            
            // Clean up temp file after lip sync
            setTimeout(() => {
              if (fs.existsSync(tempFile)) {
                fs.unlinkSync(tempFile);
                console.log(`[LipSync] Cleaned up temp file: ${tempFile}`);
              }
            }, 5000);
          } else {
            console.warn(`[LipSync] Temp file not found: ${tempFile}, skipping lip sync`);
            message.lipsync = { mouthCues: [] };
          }
        } else {
          // Traditional file-based approach (for English)
          // Check which audio file exists (Windows TTS creates WAV, Google TTS creates MP3)
          let audioFile = null;
          let audioFormat = null;
          
          if (fs.existsSync(wavFileName)) {
            audioFile = wavFileName;
            audioFormat = "wav";
            console.log(`Using WAV file for message ${index} (${language})`);
          } else if (fs.existsSync(fileName)) {
            audioFile = fileName;
            audioFormat = "mp3";
            console.log(`Using MP3 file for message ${index} (${language})`);
          } else {
            console.warn(`Neither ${fileName} nor ${wavFileName} found for message ${index}`);
            // Create a placeholder if neither file exists
            const placeholder = Buffer.from([0x52, 0x49, 0x46, 0x46, 0x24, 0x00, 0x00, 0x00, 0x57, 0x41, 0x56, 0x45, 0x66, 0x6d, 0x74, 0x20, 0x10, 0x00, 0x00, 0x00, 0x01, 0x00, 0x01, 0x00, 0x40, 0x1f, 0x00, 0x00, 0x80, 0x3e, 0x00, 0x00, 0x02, 0x00, 0x10, 0x00, 0x64, 0x61, 0x74, 0x61, 0x00, 0x00, 0x00, 0x00]);
            audioFile = wavFileName;
            audioFormat = "wav";
            fs.writeFileSync(audioFile, placeholder);
          }
          
          // Generate lip sync for all languages (language-agnostic audio processing)
          await getPhonemes({ message: index, language });
          
          // Read lip sync data
          const lipsyncData = await readJsonTranscript({ fileName: jsonFileName });
          console.log(`Lip sync data for message ${index}:`, JSON.stringify(lipsyncData).substring(0, 200));
          
          // Convert audio to base64 and add format info
          message.audio = await audioFileToBase64({ fileName: audioFile });
          message.audioFormat = audioFormat; // Add format info for frontend
          message.lipsync = lipsyncData;
        }
      } catch (error) {
        console.error(`Error while getting phonemes for message ${index}:`, error);
        // Create placeholder lip sync data if there's an error, but DON'T overwrite audio!
        try {
          // Only set empty audio if it doesn't already exist
          if (!message.audio) {
            console.warn(`[LipSync] Message ${index} has no audio, setting empty`);
            message.audio = ""; // Empty audio data
          } else {
            console.log(`[LipSync] Message ${index} already has audio, preserving it`);
          }
          
          // Set placeholder lip sync data
          if (!message.lipsync) {
            message.lipsync = {
              mouthCues: [
                { start: 0.0, end: 0.5, value: "A" },
                { start: 0.5, end: 1.0, value: "B" },
                { start: 1.0, end: 1.5, value: "C" }
              ]
            };
          }
        } catch (innerError) {
          console.error(`Error creating placeholder data for message ${index}:`, innerError);
        }
      }
    })
  );

  // Final validation: Check if all messages have audio (especially for Telugu/Hindi)
  const lang = language.toLowerCase();
  if (lang === "telugu" || lang === "te" || lang === "hindi" || lang === "hi") {
    console.log(`[LipSync] ===== FINAL VALIDATION FOR ${language.toUpperCase()} =====`);
    messages.forEach((message, index) => {
      if (message.audio && message.audioFormat) {
        console.log(`[LipSync] ✅ Message ${index} has audio (${message.audio.length} chars, format: ${message.audioFormat})`);
      } else {
        console.error(`[LipSync] ❌ Message ${index} is MISSING audio!`);
        console.error(`[LipSync] Message text: "${message.text.substring(0, 100)}..."`);
        console.error(`[LipSync] This will cause TTS to not work!`);
      }
    });
  }

  // Return the complete response with processed messages and preserved other properties
  return {
    ...otherProps,
    messages: messages
  };
};

export { lipSync };