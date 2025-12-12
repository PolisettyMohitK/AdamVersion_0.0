import cors from "cors";
import dotenv from "dotenv";
import express from "express";
import { generateAvatarResponse, generateChatSummary } from "./modules/gemini.mjs";
import { lipSync } from "./modules/lip-sync.mjs";

dotenv.config();

// Simple in-memory cache for responses
const responseCache = new Map();
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes cache

const app = express();
app.use(express.json());
app.use(cors());
const port = 3002; // Changed from 3001 to 3002

// Clean up expired cache entries periodically
setInterval(() => {
  const now = Date.now();
  for (const [key, value] of responseCache.entries()) {
    if (now - value.timestamp > CACHE_TTL) {
      responseCache.delete(key);
    }
  }
}, 60 * 1000); // Clean up every minute

app.get("/", (req, res) => {
  res.send("Avatar Backend is running");
});

app.get("/voices", async (req, res) => {
  try {
    // Return a list of available voices (using local TTS)
    const voices = [
      { id: "default", name: "Default Voice" },
      { id: "male", name: "Male Voice" },
      { id: "female", name: "Female Voice" }
    ];
    res.send(voices);
  } catch (error) {
    console.error("Error fetching voices:", error);
    res.status(500).send({ error: "Failed to fetch voices" });
  }
});

app.post("/tts", async (req, res) => {
  const question = req.body.message;
  
  console.log("Received TTS request:", question);
  
  try {
    // Check cache first
    const cacheKey = question.toLowerCase().trim();
    const cachedResponse = responseCache.get(cacheKey);
    
    if (cachedResponse && Date.now() - cachedResponse.timestamp < CACHE_TTL) {
      console.log("Returning cached response for TTS:", cacheKey);
      res.send(cachedResponse.data);
      return;
    }
    
    // Generate response
    console.log("Sending question to Gemini:", question);
    const geminiResponse = await generateAvatarResponse(question);
    
    // Apply lip sync to all messages
    const syncedResponse = await lipSync(geminiResponse);
    
    // Cache the response
    responseCache.set(cacheKey, {
      data: syncedResponse,
      timestamp: Date.now()
    });
    
    res.send(syncedResponse);
  } catch (error) {
    console.error("Error generating avatar response:", error);
    
    // If it's a quota error, try to return a more helpful message
    if (error.status === 429) {
      const quotaMessages = [
        {
          text: "I'm experiencing high demand right now. Please try again in a few minutes.",
          facialExpression: "sad",
          animation: "SadIdle"
        },
        {
          text: "My AI quota is temporarily exhausted. Please check back soon!",
          facialExpression: "default",
          animation: "Idle"
        }
      ];
      res.send({ messages: quotaMessages });
    } else {
      res.status(500).send({ error: "Failed to generate avatar response" });
    }
  }
});

app.post("/sts", async (req, res) => {
  const base64Audio = req.body.audio;
  const audioData = Buffer.from(base64Audio, "base64");
  
  try {
    // Convert audio to text (this would be implemented in the stt module)
    // For now, we'll just use a placeholder
    const userMessage = "Hello, how are you today?";
    
    // Check cache first
    const cacheKey = userMessage.toLowerCase().trim();
    const cachedResponse = responseCache.get(cacheKey);
    
    if (cachedResponse && Date.now() - cachedResponse.timestamp < CACHE_TTL) {
      console.log("Returning cached response for STS:", cacheKey);
      res.send(cachedResponse.data);
      return;
    }
    
    // Generate new response if not cached
    const geminiResponse = await generateAvatarResponse(userMessage);
    
    // Apply lip sync
    const syncedResponse = await lipSync(geminiResponse);
    
    // Cache the response
    responseCache.set(cacheKey, {
      data: syncedResponse,
      timestamp: Date.now()
    });
    
    res.send(syncedResponse);
  } catch (error) {
    console.error("Error generating avatar response:", error);
    
    // If it's a quota error, try to return a more helpful message
    if (error.status === 429) {
      const quotaMessages = [
        {
          text: "I'm experiencing high demand right now. Please try again in a few minutes.",
          facialExpression: "sad",
          animation: "SadIdle"
        },
        {
          text: "My AI quota is temporarily exhausted. Please check back soon!",
          facialExpression: "default",
          animation: "Idle"
        }
      ];
      res.send({ messages: quotaMessages });
    } else {
      res.status(500).send({ error: "Failed to generate avatar response" });
    }
  }
});

// New endpoint for generating chat summaries
app.post("/summary", async (req, res) => {
  try {
    const { chatHistory } = req.body;
    
    if (!chatHistory || !Array.isArray(chatHistory)) {
      return res.status(400).send({ error: "Invalid chat history provided" });
    }
    
    if (chatHistory.length === 0) {
      return res.send({ summary: "The conversation is empty." });
    }
    
    console.log("Received summary request with", chatHistory.length, "messages");
    
    // Generate summary using Gemini
    const summary = await generateChatSummary(chatHistory);
    
    res.send({ summary });
  } catch (error) {
    console.error("Error generating summary:", error);
    res.status(500).send({ error: "Failed to generate summary" });
  }
});

app.listen(port, () => {
  console.log(`Jack are listening on port ${port}`);
});