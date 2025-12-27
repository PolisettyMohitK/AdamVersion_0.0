import { Loader } from "@react-three/drei";
import { Canvas } from "@react-three/fiber";
import { Leva } from "leva";
import { Scenario } from "./components/Scenario";
import { ChatInterface } from "./components/ChatInterface";
import "./styles/animations.css"; // Import the animations CSS
import React from "react";
import { BrowserRouter as Router, Routes, Route, Navigate } from "react-router-dom";
import LandingPage from "./components/LandingPage";

function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<LandingPage />} />
        <Route path="/avatar" element={
          <>
            <Loader />
            <Leva collapsed hidden/>
            <ChatInterface />
            <Canvas shadows camera={{ position: [0, 0, 0], fov: 10 }}>
              <Scenario />
            </Canvas>
          </>
        } />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Router>
  );
}

export default App;