import { execSync } from "child_process";
import fs from "fs";
import { join } from "path";
import { tmpdir } from "os";

/**
 * Convert text to speech using FastPitch + HiFi-GAN models for Indian languages
 * Based on: https://github.com/gokulkarthik/text2speech
 * 
 * This module requires:
 * 1. Python environment with TTS library installed
 * 2. Model files downloaded from the repository
 * 3. Models placed in: models/{language}/fastpitch/ and models/{language}/hifigan/
 */

const MODELS_BASE_PATH = join(process.cwd(), "models");
const SCRIPTS_DIR = join(process.cwd(), "scripts");
const PYTHON_SCRIPT_PATH = join(SCRIPTS_DIR, "synthesize_tts.py");

/**
 * Convert text to speech using Indian language TTS models
 * @param {Object} params - Parameters object
 * @param {string} params.text - Text to convert to speech
 * @param {string} params.fileName - Output audio file path
 * @param {string} params.language - Language code (hindi, telugu)
 */
async function convertTextToSpeechWithModel({ text, fileName, language }) {
  try {
    // Map language names to model directory names
    const languageMap = {
      hindi: "hindi",
      telugu: "telugu"
    };

    const modelLang = languageMap[language.toLowerCase()];
    if (!modelLang) {
      throw new Error(`Unsupported language: ${language}`);
    }

    const modelPath = join(MODELS_BASE_PATH, modelLang);
    const fastpitchPath = join(modelPath, "fastpitch", "best_model.pth");
    const fastpitchConfigPath = join(modelPath, "fastpitch", "config.json");
    const hifiganPath = join(modelPath, "hifigan", "best_model.pth");
    const hifiganConfigPath = join(modelPath, "hifigan", "config.json");

    // Check if model files exist
    if (!fs.existsSync(fastpitchPath) || !fs.existsSync(hifiganPath)) {
      console.warn(`Model files not found for ${language}. Please download models from: https://github.com/gokulkarthik/text2speech`);
      return false;
    }

    // Create Python script if it doesn't exist
    if (!fs.existsSync(PYTHON_SCRIPT_PATH)) {
      console.log("Creating Python TTS synthesis script...");
      createPythonScript();
      console.log("Python script created successfully");
    }

    // Escape text for command line
    const escapedText = text.replace(/"/g, '\\"').replace(/\$/g, '\\$');
    
    // Create output directory if it doesn't exist
    const outputDir = join(process.cwd(), "audios");
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }

    // Generate temporary output file
    const tempOutput = join(tmpdir(), `tts_output_${Date.now()}.wav`);
    
    // Run Python synthesis script
    // Try python3 first, then python
    let pythonCmd = 'python3';
    try {
      execSync('python3 --version', { stdio: 'pipe' });
    } catch (e) {
      pythonCmd = 'python';
      try {
        execSync('python --version', { stdio: 'pipe' });
      } catch (e2) {
        throw new Error('Python is not installed or not in PATH');
      }
    }
    
    const command = `${pythonCmd} "${PYTHON_SCRIPT_PATH}" --text "${escapedText}" --model_path "${fastpitchPath}" --config_path "${fastpitchConfigPath}" --vocoder_path "${hifiganPath}" --vocoder_config_path "${hifiganConfigPath}" --out_path "${tempOutput}"`;
    
    console.log(`Running TTS synthesis for ${language}...`);
    console.log(`Command: ${command}`);
    execSync(command, { stdio: 'inherit', timeout: 30000 }); // 30 second timeout

    // Check if output file was created
    if (fs.existsSync(tempOutput)) {
      // Copy to final location
      fs.copyFileSync(tempOutput, fileName);
      fs.unlinkSync(tempOutput);
      console.log(`TTS synthesis completed: ${fileName}`);
      return true;
    } else {
      throw new Error("TTS synthesis failed - output file not created");
    }

  } catch (error) {
    console.error(`Error in Indian TTS conversion for ${language}:`, error.message);
    return false;
  }
}

/**
 * Create Python script for TTS synthesis
 */
function createPythonScript() {
  if (!fs.existsSync(SCRIPTS_DIR)) {
    fs.mkdirSync(SCRIPTS_DIR, { recursive: true });
  }

  const pythonScript = `#!/usr/bin/env python3
"""
TTS Synthesis Script for Indian Languages
Uses FastPitch + HiFi-GAN models from text2speech repository
"""

import argparse
import sys
import os

# Add TTS to path if needed
try:
    from TTS.bin.synthesize import synthesize
except ImportError:
    print("Error: TTS library not found. Please install: pip install TTS")
    sys.exit(1)

def main():
    parser = argparse.ArgumentParser(description='Synthesize speech using FastPitch + HiFi-GAN')
    parser.add_argument('--text', type=str, required=True, help='Text to synthesize')
    parser.add_argument('--model_path', type=str, required=True, help='Path to FastPitch model')
    parser.add_argument('--config_path', type=str, required=True, help='Path to FastPitch config')
    parser.add_argument('--vocoder_path', type=str, required=True, help='Path to HiFi-GAN vocoder')
    parser.add_argument('--vocoder_config_path', type=str, required=True, help='Path to HiFi-GAN config')
    parser.add_argument('--out_path', type=str, required=True, help='Output audio file path')
    
    args = parser.parse_args()
    
    # Check if model files exist
    if not os.path.exists(args.model_path):
        print(f"Error: Model file not found: {args.model_path}")
        sys.exit(1)
    
    if not os.path.exists(args.vocoder_path):
        print(f"Error: Vocoder file not found: {args.vocoder_path}")
        sys.exit(1)
    
    try:
        # Use TTS synthesize function
        synthesize(
            model_path=args.model_path,
            config_path=args.config_path,
            vocoder_path=args.vocoder_path,
            vocoder_config_path=args.vocoder_config_path,
            text=args.text,
            out_path=args.out_path
        )
        print(f"Successfully synthesized: {args.out_path}")
    except Exception as e:
        print(f"Error during synthesis: {str(e)}")
        sys.exit(1)

if __name__ == "__main__":
    main()
`;

  fs.writeFileSync(PYTHON_SCRIPT_PATH, pythonScript);
  console.log(`Created Python script: ${PYTHON_SCRIPT_PATH}`);
}

export { convertTextToSpeechWithModel };

