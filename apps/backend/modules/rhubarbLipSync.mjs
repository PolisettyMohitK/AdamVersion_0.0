import { execCommand } from "../utils/files.mjs";
import fs from "fs";

const getPhonemes = async ({ message, language = "english" }) => {
  try {
    const time = new Date().getTime();
    console.log(`Starting lip sync conversion for message ${message} (language: ${language})`);
    
    // Determine input audio file (MP3 or WAV)
    const mp3File = `audios/message_${message}.mp3`;
    const wavFile = `audios/message_${message}.wav`;
    const jsonFile = `audios/message_${message}.json`;
    
    // Check which audio file exists
    let inputAudioFile = null;
    if (fs.existsSync(wavFile)) {
      inputAudioFile = wavFile;
      console.log(`Using existing WAV file: ${wavFile}`);
    } else if (fs.existsSync(mp3File)) {
      inputAudioFile = mp3File;
      console.log(`Using MP3 file, will convert to WAV: ${mp3File}`);
    } else {
      console.warn(`No audio file found for message ${message} (checked ${mp3File} and ${wavFile})`);
      // Create placeholder lip sync data
      const placeholderData = {
        mouthCues: [
          { start: 0.0, end: 0.5, value: "A" },
          { start: 0.5, end: 1.0, value: "B" },
          { start: 1.0, end: 1.5, value: "C" }
        ]
      };
      fs.writeFileSync(jsonFile, JSON.stringify(placeholderData));
      return;
    }
    
    // Check if ffmpeg is available
    try {
      await execCommand({ command: "ffmpeg -version" });
    } catch (ffmpegError) {
      console.warn("FFmpeg not found, skipping lip sync");
      // Create a simple placeholder JSON file with correct format
      const placeholderData = {
        mouthCues: [
          { start: 0.0, end: 0.5, value: "A" },
          { start: 0.5, end: 1.0, value: "B" },
          { start: 1.0, end: 1.5, value: "C" }
        ]
      };
      fs.writeFileSync(jsonFile, JSON.stringify(placeholderData));
      return;
    }
    
    // Convert MP3 to WAV if needed (Rhubarb requires WAV format)
    // Use standard sample rate (16000 Hz) for compatibility
    // Ensure mono channel for optimal lip sync detection
    if (inputAudioFile === mp3File) {
      try {
        // Convert MP3 to WAV with standard settings
        await execCommand({
          command: `ffmpeg -y -i "${mp3File}" -ar 16000 -ac 1 "${wavFile}"`
        });
        console.log(`MP3 to WAV conversion done in ${new Date().getTime() - time}ms`);
        
        // Verify WAV file was created
        if (!fs.existsSync(wavFile)) {
          throw new Error(`WAV file was not created: ${wavFile}`);
        }
      } catch (conversionError) {
        console.error(`FFmpeg conversion failed:`, conversionError.message);
        // Create placeholder if conversion fails
        const placeholderData = {
          mouthCues: [
            { start: 0.0, end: 0.5, value: "A" },
            { start: 0.5, end: 1.0, value: "B" },
            { start: 1.0, end: 1.5, value: "C" }
          ]
        };
        fs.writeFileSync(jsonFile, JSON.stringify(placeholderData));
        return;
      }
    }
    
<<<<<<< Updated upstream
    // Check if rhubarb is available
    let rhubarbAvailable = false;
    try {
      // Try different ways to check if rhubarb is available
      try {
        await execCommand({ command: "./bin/rhubarb --help" });
        rhubarbAvailable = true;
      } catch (helpError) {
        // Try just running rhubarb without arguments
        try {
          await execCommand({ command: "./bin/rhubarb" });
          rhubarbAvailable = true;
        } catch (runError) {
          console.log("Rhubarb not found or not executable");
        }
      }
    } catch (checkError) {
      console.log("Could not check Rhubarb availability");
    }
    
    if (!rhubarbAvailable) {
      console.warn("Rhubarb not found, creating enhanced placeholder lip sync data");
      // Create a more dynamic placeholder JSON file with correct format
      const audioStats = fs.statSync(`audios/message_${message}.wav`);
      const audioDuration = audioStats.size / 44100; // Rough estimation
      
      // Create more varied and realistic mouth cues
      const vowels = ["A", "B", "C", "D", "E", "F"];
      const mouthCues = [];
      let currentTime = 0;
      const segmentDuration = Math.min(0.2, audioDuration / 10);
      
      while (currentTime < audioDuration && mouthCues.length < 20) {
        const vowel = vowels[Math.floor(Math.random() * vowels.length)];
        mouthCues.push({
          start: currentTime,
          end: Math.min(currentTime + segmentDuration, audioDuration),
          value: vowel
        });
        currentTime += segmentDuration;
      }
      
=======
    // Ensure WAV file exists and is readable
    if (!fs.existsSync(wavFile)) {
      console.error(`WAV file does not exist: ${wavFile}`);
      const placeholderData = {
        mouthCues: [
          { start: 0.0, end: 0.5, value: "A" },
          { start: 0.5, end: 1.0, value: "B" },
          { start: 1.0, end: 1.5, value: "C" }
        ]
      };
      fs.writeFileSync(jsonFile, JSON.stringify(placeholderData));
      return;
    }
    
    const wavStats = fs.statSync(wavFile);
    if (wavStats.size === 0) {
      console.error(`WAV file is empty: ${wavFile}`);
      const placeholderData = {
        mouthCues: [
          { start: 0.0, end: 0.5, value: "A" },
          { start: 0.5, end: 1.0, value: "B" },
          { start: 1.0, end: 1.5, value: "C" }
        ]
      };
      fs.writeFileSync(jsonFile, JSON.stringify(placeholderData));
      return;
    }
    
    console.log(`WAV file ready: ${wavFile} (${wavStats.size} bytes)`);
    
    // Check if rhubarb is available (Windows uses .exe, Unix uses no extension)
    // Based on reference: https://github.com/asanchezyali/talking-avatar-with-ai
    const rhubarbPath = process.platform === "win32" ? "bin\\rhubarb.exe" : "./bin/rhubarb";
    try {
      await execCommand({ command: `${rhubarbPath} --help` });
    } catch (rhubarbError) {
      console.warn("Rhubarb not found, creating placeholder lip sync data");
      // Create a simple placeholder JSON file with correct format
>>>>>>> Stashed changes
      const placeholderData = {
        mouthCues: mouthCues
      };
      fs.writeFileSync(jsonFile, JSON.stringify(placeholderData));
      return;
    }
    
<<<<<<< Updated upstream
    if (rhubarbAvailable) {
      try {
        await execCommand({
          command: `./bin/rhubarb -f json -o audios/message_${message}.json audios/message_${message}.wav -r phonetic`,
        });
        // -r phonetic is faster but less accurate
        console.log(`Lip sync done in ${new Date().getTime() - time}ms`);
      } catch (rhubarbExecError) {
        console.error(`Error running Rhubarb for message ${message}:`, rhubarbExecError);
        // Fall back to enhanced placeholder
        console.warn("Falling back to enhanced placeholder lip sync data");
        // Create a more dynamic placeholder JSON file with correct format
        const audioStats = fs.statSync(`audios/message_${message}.wav`);
        const audioDuration = audioStats.size / 44100; // Rough estimation
        
        // Create more varied and realistic mouth cues
        const vowels = ["A", "B", "C", "D", "E", "F"];
        const mouthCues = [];
        let currentTime = 0;
        const segmentDuration = Math.min(0.2, audioDuration / 10);
        
        while (currentTime < audioDuration && mouthCues.length < 20) {
          const vowel = vowels[Math.floor(Math.random() * vowels.length)];
          mouthCues.push({
            start: currentTime,
            end: Math.min(currentTime + segmentDuration, audioDuration),
            value: vowel
          });
          currentTime += segmentDuration;
        }
        
        const placeholderData = {
          mouthCues: mouthCues
        };
        fs.writeFileSync(`audios/message_${message}.json`, JSON.stringify(placeholderData));
      }
    }
=======
    // Ensure WAV file exists before running Rhubarb
    if (!fs.existsSync(wavFile)) {
      throw new Error(`WAV file does not exist: ${wavFile}`);
    }
    
    // Generate lip sync data using Rhubarb
    // Based on reference implementation: https://github.com/asanchezyali/talking-avatar-with-ai
    // Rhubarb works with audio waveforms, so it's language-agnostic
    // Works for English, Hindi, Telugu, and any other language
    // Try presets mode first (more accurate), fallback to phonetic if it fails
    let rhubarbSuccess = false;
    let rhubarbError = null;
    
    // Try presets mode first
    try {
      const rhubarbCommandPresets = process.platform === "win32"
        ? `"${rhubarbPath}" -f json -o "${jsonFile}" "${wavFile}" -r presets`
        : `${rhubarbPath} -f json -o "${jsonFile}" "${wavFile}" -r presets`;
      
      await execCommand({
        command: rhubarbCommandPresets,
      });
      rhubarbSuccess = true;
      console.log(`Lip sync done with presets mode for ${language} in ${new Date().getTime() - time}ms`);
    } catch (presetsError) {
      console.warn(`Presets mode failed, trying phonetic mode:`, presetsError.message);
      rhubarbError = presetsError;
      
      // Fallback to phonetic mode
      try {
        const rhubarbCommandPhonetic = process.platform === "win32"
          ? `"${rhubarbPath}" -f json -o "${jsonFile}" "${wavFile}" -r phonetic`
          : `${rhubarbPath} -f json -o "${jsonFile}" "${wavFile}" -r phonetic`;
        
        await execCommand({
          command: rhubarbCommandPhonetic,
        });
        rhubarbSuccess = true;
        console.log(`Lip sync done with phonetic mode for ${language} in ${new Date().getTime() - time}ms`);
      } catch (phoneticError) {
        console.error(`Both presets and phonetic modes failed:`, phoneticError.message);
        throw phoneticError;
      }
    }
    
    // Verify the JSON file was created and has valid content
    if (!fs.existsSync(jsonFile)) {
      throw new Error(`Rhubarb did not create output file: ${jsonFile}`);
    }
    
    const fileStats = fs.statSync(jsonFile);
    if (fileStats.size === 0) {
      throw new Error(`Rhubarb created empty output file: ${jsonFile}`);
    }
    
    try {
      const lipSyncData = JSON.parse(fs.readFileSync(jsonFile, 'utf8'));
      if (lipSyncData.mouthCues && Array.isArray(lipSyncData.mouthCues) && lipSyncData.mouthCues.length > 0) {
        console.log(`✓ Generated ${lipSyncData.mouthCues.length} mouth cues for ${language}`);
        // Log first and last cue times for debugging
        const firstCue = lipSyncData.mouthCues[0];
        const lastCue = lipSyncData.mouthCues[lipSyncData.mouthCues.length - 1];
        console.log(`  First cue: ${firstCue.start}s - ${firstCue.end}s (${firstCue.value})`);
        console.log(`  Last cue: ${lastCue.start}s - ${lastCue.end}s (${lastCue.value})`);
      } else {
        console.warn(`⚠ Lip sync JSON created but has no mouthCues, creating placeholder`);
        // Create placeholder if no cues found
        const placeholderData = {
          mouthCues: [
            { start: 0.0, end: 0.5, value: "A" },
            { start: 0.5, end: 1.0, value: "B" },
            { start: 1.0, end: 1.5, value: "C" }
          ]
        };
        fs.writeFileSync(jsonFile, JSON.stringify(placeholderData));
      }
    } catch (parseError) {
      console.error(`Error parsing lip sync JSON:`, parseError.message);
      throw parseError;
    }
>>>>>>> Stashed changes
  } catch (error) {
    console.error(`Error while getting phonemes for message ${message} (${language}):`, error);
    console.error(`Error stack:`, error.stack);
    // Create a simple placeholder JSON file as fallback with correct format
    try {
      const jsonFile = `audios/message_${message}.json`;
      const placeholderData = {
        mouthCues: [
          { start: 0.0, end: 0.5, value: "A" },
          { start: 0.5, end: 1.0, value: "B" },
          { start: 1.0, end: 1.5, value: "C" }
        ]
      };
      fs.writeFileSync(jsonFile, JSON.stringify(placeholderData));
      console.log(`Created placeholder lip sync data for message ${message}`);
    } catch (writeError) {
      console.error(`Error creating placeholder lip sync data:`, writeError);
    }
    // Don't rethrow - we've created placeholder data as fallback
  }
};

export { getPhonemes };