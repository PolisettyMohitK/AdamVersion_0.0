# TTS Setup Guide for Hindi and Telugu

This guide explains how to set up Telugu and Hindi Text-to-Speech (TTS) models from the [text2speech repository](https://github.com/gokulkarthik/text2speech.git).

## Prerequisites

1. **Python 3.8+** installed
2. **PyTorch** installed (with CUDA if using GPU)
3. **TTS Library** from Coqui AI

## Installation Steps

### 1. Install Python Dependencies

```bash
# Create a Python virtual environment (recommended)
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate

# Install PyTorch (adjust for your CUDA version)
pip install torch torchvision torchaudio --extra-index-url https://download.pytorch.org/whl/cu113

# Install TTS library
pip install TTS

# Install other dependencies
pip install numpy scipy librosa soundfile
```

### 2. Download Model Files

The models need to be downloaded separately. According to the repository, you can download trained model weights from the provided link in the repository.

**Model Structure:**
```
models/
├── hindi/
│   ├── fastpitch/
│   │   ├── best_model.pth
│   │   └── config.json
│   └── hifigan/
│       ├── best_model.pth
│       └── config.json
└── telugu/
    ├── fastpitch/
    │   ├── best_model.pth
    │   └── config.json
    └── hifigan/
        ├── best_model.pth
        └── config.json
```

**Download Instructions:**
1. Visit the [text2speech repository](https://github.com/gokulkarthik/text2speech.git)
2. Check the README for model download links
3. Download the Hindi and Telugu model files
4. Extract and place them in the `apps/backend/models/` directory as shown above

### 3. Verify Installation

Test the Python script:

```bash
cd apps/backend
python scripts/synthesize_tts.py --text "नमस्ते" --model_path models/hindi/fastpitch/best_model.pth --config_path models/hindi/fastpitch/config.json --vocoder_path models/hindi/hifigan/best_model.pth --vocoder_config_path models/hindi/hifigan/config.json --out_path test_output.wav
```

## Usage

Once set up, the TTS system will automatically:
- Use Hindi TTS models when language is set to "hindi"
- Use Telugu TTS models when language is set to "telugu"
- Fall back to default system TTS for English or if models are not available

## Troubleshooting

1. **Models not found**: Ensure model files are in the correct directory structure
2. **Python import errors**: Make sure TTS library is installed: `pip install TTS`
3. **CUDA errors**: If using CPU, ensure PyTorch CPU version is installed
4. **Audio format issues**: The script outputs WAV files which are automatically converted

## Notes

- The models are large (several hundred MB each)
- First-time synthesis may be slower as models load into memory
- For production, consider caching frequently used phrases
- English continues to use the default system TTS (Windows PowerShell, macOS say, or espeak)


