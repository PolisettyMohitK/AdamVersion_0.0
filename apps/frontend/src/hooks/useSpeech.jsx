import { createContext, useContext, useEffect, useState } from "react";

const backendUrl = "http://localhost:3002"; // Changed from 3001 to 3002

const SpeechContext = createContext();

export const SpeechProvider = ({ children }) => {
  const [recording, setRecording] = useState(false);
  const [mediaRecorder, setMediaRecorder] = useState(null);
  const [messages, setMessages] = useState([]);
  const [message, setMessage] = useState();
  const [loading, setLoading] = useState(false);
  const [currentMessageText, setCurrentMessageText] = useState(""); // Track current message text for captions
  const [displayedCaptionText, setDisplayedCaptionText] = useState(""); // Track displayed portion of caption (word-by-word)
  const [currentAudio, setCurrentAudio] = useState(null); // Track current audio for stopping
  const [currentImages, setCurrentImages] = useState([]); // Track current images
  const [lastUserMessage, setLastUserMessage] = useState(""); // Track last user message from voice recording
  const [selectedLanguage, setSelectedLanguage] = useState("english"); // Language selection: english, hindi, telugu

  let chunks = [];

  const initiateRecording = () => {
    chunks = [];
  };

  const onDataAvailable = (e) => {
    chunks.push(e.data);
  };

  const sendAudioData = async (audioBlob) => {
    const reader = new FileReader();
    reader.readAsDataURL(audioBlob);
    reader.onloadend = async function () {
      const base64Audio = reader.result.split(",")[1];
      setLoading(true);
      console.log("=== Frontend: Sending audio to STS endpoint ===");
      try {
        const data = await fetch(`${backendUrl}/sts`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ audio: base64Audio, language: selectedLanguage }),
        });
        
        console.log("Response status:", data.status);
        
        if (!data.ok) {
          const errorText = await data.text();
          console.error("Error response from server:", errorText);
          throw new Error(`Server error: ${data.status} - ${errorText}`);
        }
        
        const response = await data.json();
        console.log("=== Frontend: Received response ===");
        console.log("Full response:", response);
        
        // Store the transcribed user message if available
        if (response.userMessage) {
          console.log("Transcribed user message:", response.userMessage);
          setLastUserMessage(response.userMessage);
        }
        
        // Handle messages - simplified to handle both array and object formats
        let responseMessages = [];
        if (Array.isArray(response)) {
          responseMessages = response;
        } else if (response.messages && Array.isArray(response.messages)) {
          responseMessages = response.messages;
        } else if (response.error) {
          console.error("Error in response:", response.error);
          // Show error message to user
          responseMessages = [{
            text: response.errorMessage || "Sorry, there was an error processing your request.",
            facialExpression: "sad",
            animation: "SadIdle"
          }];
        }
        
        console.log("Extracted messages:", responseMessages);
        console.log("Messages count:", responseMessages.length);
        
        // Handle images
        if (response.images && Array.isArray(response.images)) {
          console.log("Setting current images (STS):", response.images);
          setCurrentImages(response.images);
        } else {
          console.log("No images in STS response");
        }
        
        // Note: User message from voice recording should be added to chat history
        // This is handled by the ChatInterface component when it receives the transcribed text
        // For now, we'll just add the AI response messages
        
        if (responseMessages.length > 0) {
          console.log("Adding messages to queue:", responseMessages);
          setMessages((messages) => [...messages, ...responseMessages]);
        } else {
          console.warn("No messages found in response!");
          // Add a fallback message
          setMessages((messages) => [...messages, {
            text: "I'm sorry, I didn't receive a proper response. Please try again.",
            facialExpression: "sad",
            animation: "SadIdle"
          }]);
        }
      } catch (error) {
        console.error("=== Frontend: Error in sendAudioData ===");
        console.error("Error:", error);
        console.error("Error message:", error.message);
        // Add error message to queue so user knows something went wrong
        setMessages((messages) => [...messages, {
          text: "Sorry, there was an error processing your voice message. Please try again.",
          facialExpression: "sad",
          animation: "SadIdle"
        }]);
      } finally {
        setLoading(false);
        console.log("=== Frontend: Request completed ===");
      }
    };
  };

  useEffect(() => {
    if (typeof window !== "undefined") {
      navigator.mediaDevices
        .getUserMedia({ audio: true })
        .then((stream) => {
          const newMediaRecorder = new MediaRecorder(stream);
          newMediaRecorder.onstart = initiateRecording;
          newMediaRecorder.ondataavailable = onDataAvailable;
          newMediaRecorder.onstop = async () => {
            const audioBlob = new Blob(chunks, { type: "audio/webm" });
            try {
              await sendAudioData(audioBlob);
            } catch (error) {
              console.error(error);
              alert(error.message);
            }
          };
          setMediaRecorder(newMediaRecorder);
        })
        .catch((err) => console.error("Error accessing microphone:", err));
    }
  }, []);

  const startRecording = () => {
    if (mediaRecorder) {
      mediaRecorder.start();
      setRecording(true);
    }
  };

  const stopRecording = () => {
    if (mediaRecorder) {
      mediaRecorder.stop();
      setRecording(false);
    }
  };

  const tts = async (messageText, language = selectedLanguage) => {
    setLoading(true);
    try {
      const data = await fetch(`${backendUrl}/tts`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ message: messageText, language: language || selectedLanguage }),
      });
      const response = await data.json();
      
      // Handle messages - simplified to handle both array and object formats
      let responseMessages = [];
      if (Array.isArray(response)) {
        responseMessages = response;
      } else if (response.messages && Array.isArray(response.messages)) {
        responseMessages = response.messages;
      }
      
      // Handle images
      if (response.images && Array.isArray(response.images)) {
        console.log("Setting current images (TTS):", response.images);
        setCurrentImages(response.images);
      } else {
        console.log("No images in TTS response:", response);
      }
      
      if (responseMessages.length > 0) {
        console.log("Received messages from TTS:", responseMessages);
        setMessages((messages) => [...messages, ...responseMessages]);
      }
    } catch (error) {
      console.error("Error in tts:", error);
    } finally {
      setLoading(false);
    }
  };

  const onMessagePlayed = () => {
    console.log("Message played, moving to next message");
    setMessages((messages) => {
      const newMessages = messages.slice(1);
      console.log("Remaining messages:", newMessages.length);
      return newMessages;
    });
  };

  // Modified function to stop audio playback but keep captions
  const stopAudio = () => {
    if (currentAudio) {
      currentAudio.pause();
      setCurrentAudio(null);
    }
    setMessages([]); // Clear all pending messages
    setMessage(null); // Clear current message
    // Note: We don't clear currentMessageText here to keep the captions visible
  };

  // Effect to handle smooth word-by-word caption reveal synced with audio
  useEffect(() => {
    if (!currentAudio || !currentMessageText) {
      setDisplayedCaptionText("");
      return;
    }

    const words = currentMessageText.split(/\s+/);
    let lastWordIndex = -1;
    let rafId = null;

    const updateCaption = () => {
      if (!currentAudio || !currentMessageText) {
        if (rafId) {
          cancelAnimationFrame(rafId);
          rafId = null;
        }
        return;
      }
      
      const currentTime = currentAudio.currentTime || 0;
      const audioDuration = currentAudio.duration;
      
      // Wait for valid duration
      if (!audioDuration || audioDuration === 0 || isNaN(audioDuration)) {
        rafId = requestAnimationFrame(updateCaption);
        return;
      }
      
      // Calculate progress linearly (no easing to match speech exactly)
      const progress = Math.min(Math.max(currentTime / audioDuration, 0), 1);
      
      // Calculate word index directly from progress (linear mapping)
      const wordIndex = Math.floor(progress * words.length);
      
      // Update only when word index changes
      if (wordIndex !== lastWordIndex) {
        lastWordIndex = wordIndex;
        
        if (wordIndex >= words.length) {
          // Show full text when complete
          setDisplayedCaptionText(currentMessageText);
        } else if (wordIndex > 0) {
          // Show words up to current index
          const displayedWords = words.slice(0, wordIndex).join(" ");
          setDisplayedCaptionText(displayedWords);
        } else {
          // Start with empty
          setDisplayedCaptionText("");
        }
      }
      
      // Continue updating while playing
      if (!currentAudio.ended && !currentAudio.paused) {
        rafId = requestAnimationFrame(updateCaption);
      } else if (currentAudio.ended) {
        // Ensure full text is shown when ended
        setDisplayedCaptionText(currentMessageText);
      }
    };

    // Handle play event - reset and start
    const handlePlay = () => {
      setDisplayedCaptionText("");
      lastWordIndex = -1;
      rafId = requestAnimationFrame(updateCaption);
    };

    // Handle timeupdate - more frequent updates for smooth sync
    const handleTimeUpdate = () => {
      if (!rafId && !currentAudio.paused) {
        rafId = requestAnimationFrame(updateCaption);
      }
    };

    // Handle ended - show full text
    const handleEnded = () => {
      setDisplayedCaptionText(currentMessageText);
      if (rafId) {
        cancelAnimationFrame(rafId);
        rafId = null;
      }
    };

    // Set up event listeners
    currentAudio.addEventListener('play', handlePlay);
    currentAudio.addEventListener('timeupdate', handleTimeUpdate);
    currentAudio.addEventListener('ended', handleEnded);
    
    // Start immediately if audio is already playing or loaded
    if (currentAudio.readyState >= 2) { // HAVE_CURRENT_DATA or higher
      if (currentAudio.paused) {
        // Wait for play event
        setDisplayedCaptionText("");
      } else {
        // Already playing, start immediately
        rafId = requestAnimationFrame(updateCaption);
      }
    } else {
      // Wait for data to load
      const handleLoadedData = () => {
        if (!currentAudio.paused) {
          rafId = requestAnimationFrame(updateCaption);
        }
      };
      currentAudio.addEventListener('loadeddata', handleLoadedData, { once: true });
    }

    // Cleanup
    return () => {
      currentAudio.removeEventListener('play', handlePlay);
      currentAudio.removeEventListener('timeupdate', handleTimeUpdate);
      currentAudio.removeEventListener('ended', handleEnded);
      if (rafId) {
        cancelAnimationFrame(rafId);
      }
    };
  }, [currentAudio, currentMessageText]);

  useEffect(() => {
    if (messages.length > 0) {
      console.log("Setting current message:", messages[0]);
      setMessage(messages[0]);
      setCurrentMessageText(messages[0].text || ""); // Set current message text for captions
      setDisplayedCaptionText(""); // Reset displayed text when new message starts
    } else {
      console.log("No more messages");
      setMessage(null);
      // Clear captions after a short delay when message ends
      setTimeout(() => {
        setCurrentMessageText("");
        setDisplayedCaptionText("");
      }, 1000);
    }
  }, [messages]);

  return (
    <SpeechContext.Provider
      value={{
        startRecording,
        stopRecording,
        recording,
        tts,
        message,
        onMessagePlayed,
        loading,
        currentMessageText, // Expose current message text for captions
        displayedCaptionText, // Expose displayed caption text (word-by-word)
        stopAudio, // Expose stop audio function
        setCurrentAudio, // Expose setCurrentAudio for the Avatar component
        messages, // Expose messages array for chat history
        setLoading, // Expose setLoading function
        setMessages, // Expose setMessages function
        currentImages, // Expose current images
        lastUserMessage, // Expose last user message from voice recording
        setLastUserMessage, // Expose setter for last user message
        selectedLanguage, // Expose selected language
        setSelectedLanguage, // Expose setter for selected language
      }}
    >
      {children}
    </SpeechContext.Provider>
  );
};

export const useSpeech = () => {
  const context = useContext(SpeechContext);
  if (!context) {
    throw new Error("useSpeech must be used within a SpeechProvider");
  }
  return context;
};