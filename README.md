# Adam Project - Talking Avatar with AI

This project is a talking avatar powered by Google's Gemini AI that can engage in conversations with users. The avatar can speak, listen, and express emotions through facial expressions and animations. It uses Gemini for natural language processing, local TTS for voice generation, and Rhubarb Lip Sync for lip synchronization.

## Key Features

- Natural conversation with AI-powered responses
- Realistic facial expressions and body animations
- Text-to-speech and speech-to-text capabilities
- Lip synchronization for realistic mouth movements
- Interactive 3D avatar built with Three.js and React

## How it Works

The system operates through two primary workflows, depending on whether the user input is in text or audio form:

### Workflow with Text Input:
1. **User Input:** The user enters text through the chat interface.
2. **AI Processing:** The text is sent to Google's Gemini API for processing.
3. **Response Generation:** Gemini generates a contextual response with appropriate facial expressions and animations.
4. **Audio Generation:** The response text is converted to speech using the system's local TTS.
5. **Lip Sync Generation:** The audio is processed by Rhubarb Lip Sync to generate viseme metadata.
6. **Avatar Animation:** The avatar displays the response with synchronized lip movements and appropriate facial expressions.

### Workflow with Audio Input:
1. **User Input:** The user speaks into the microphone.
2. **Speech-to-Text Conversion:** The audio is converted to text using the system's local STT.
3. **AI Processing:** The converted text is sent to Google's Gemini API for processing.
4. **Response Generation:** Gemini generates a contextual response with appropriate facial expressions and animations.
5. **Audio Generation:** The response text is converted to speech using the system's local TTS.
6. **Lip Sync Generation:** The audio is processed by Rhubarb Lip Sync to generate viseme metadata.
7. **Avatar Animation:** The avatar displays the response with synchronized lip movements and appropriate facial expressions.



## Getting Started

### Requirements
Before using this system, ensure you have the following prerequisites:

1. **Google Cloud Account:** You need a Google Cloud account with access to the Gemini API. Get your API key from the [Google AI Studio](https://aistudio.google.com/).
2. **Rhubarb Lip-Sync:** Download the latest version of Rhubarb Lip-Sync compatible with your operating system from the official [Rhubarb Lip-Sync repository](https://github.com/DanielSWolf/rhubarb-lip-sync/releases). Once downloaded, create a `/bin` directory in the backend and move all the contents of the unzipped `rhubarb-lip-sync.zip` into it.
3. Install `ffmpeg` for [Mac OS](https://formulae.brew.sh/formula/ffmpeg), [Linux](https://ffmpeg.org/download.html) or [Windows](https://ffmpeg.org/download.html).

### Installation

1. Clone this repository:
  
```bash
git clone https://github.com/AbhiramValmeekam/adam-project.git
```

2. Navigate to the project directory:

```bash
cd adam-project
```

3. Install dependencies for monorepo:
```bash
yarn
```

4. Create a .env file in the root `/apps/backend/` of the project and add your Google API key:

```bash
# Google Gemini
GEMINI_API_KEY=<YOUR_GOOGLE_GEMINI_API_KEY>
```

5. Run the development system:

```bash
yarn dev
```

6. If you need install another dependence in the monorepo, you can do this:

```bash
yarn add --dev -W <PACKAGE_NAME>
yarn
```

Open [http://localhost:5173/](http://localhost:5173/) with your browser to see the result.

## Project Structure

- `/apps/backend` - Contains the Node.js server with Gemini integration, TTS/STS processing, and lip-sync generation
- `/apps/frontend` - Contains the React frontend with Three.js avatar implementation
- `/resources` - Contains architectural diagrams and other documentation assets

## Customization

You can customize the avatar's personality, responses, and behavior by modifying the prompt template in `apps/backend/modules/gemini.mjs`. The avatar's characteristics, response format, and interaction style are all defined in this file.

## References
* Google Gemini: https://ai.google.dev/
* Rhubarb Lip-Sync: https://github.com/DanielSWolf/rhubarb-lip-sync
* Three.js: https://threejs.org/
* React: https://reactjs.org/
* Ready Player Me: https://readyplayer.me/
* Mixamo: https://www.mixamo.com/
