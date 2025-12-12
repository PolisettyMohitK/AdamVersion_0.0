import { Loader } from "@react-three/drei";
import { Canvas } from "@react-three/fiber";
import { Leva } from "leva";
import { Scenario } from "./components/Scenario";
import { ChatInterface } from "./components/ChatInterface";
import "./styles/animations.css"; // Import the animations CSS
import { useSpeech } from "./hooks/useSpeech"; // Import the useSpeech hook
import React from "react";

function App() {
  const { currentMessageText, message } = useSpeech(); // Get the current message text and message status for captions
  
  // Only show captions when there's an active message
  const showCaptions = message && currentMessageText;
  
  return (
    <>
      <Loader />
      <Leva collapsed hidden/>
      <ChatInterface />
      <Canvas shadows camera={{ position: [0, 0, 0], fov: 10 }}>
        <Scenario />
      </Canvas>
      
      {/* Live Captions - positioned below the avatar and above the text box */}
      {/* Only show when there's an active message */}
      {showCaptions && (
        <div className="fixed bottom-32 left-0 right-0 flex justify-center z-20 pointer-events-none animate-fadeIn">
          <div className="bg-black bg-opacity-50 backdrop-blur-md text-white px-6 py-3 rounded-lg max-w-2xl text-center animate-pulse">
            <p className="text-lg font-medium">{currentMessageText}</p>
          </div>
        </div>
      )}
    </>
  );
}

export default App;