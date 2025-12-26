import { useRef, useState, useEffect } from "react";
import { useSpeech } from "../hooks/useSpeech";
import { RetentionTest } from "./RetentionTest"; // Import the RetentionTest component

export const ChatInterface = ({ hidden, ...props }) => {
  const input = useRef();
  const fileInput = useRef();
  const { tts, loading, message, startRecording, stopRecording, recording, currentMessageText, displayedCaptionText, stopAudio, messages, currentImages, lastUserMessage, setLastUserMessage, selectedLanguage, setSelectedLanguage } = useSpeech();
  const [chatHistory, setChatHistory] = useState([]); // Store all messages in order
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [documents, setDocuments] = useState([]); // Store uploaded documents
  const [isUploading, setIsUploading] = useState(false); // Track upload status
<<<<<<< Updated upstream
  const [isGeneratingSummary, setIsGeneratingSummary] = useState(false); // Track summary generation status
  const [chatSummary, setChatSummary] = useState(""); // Store chat summary
  const [isRetentionTestOpen, setIsRetentionTestOpen] = useState(false); // Track retention test modal state

  // Add messages to chat history
  useEffect(() => {
    if (messages && messages.length > 0) {
      // Filter out duplicate messages and add new ones to history
      const newMessages = messages.filter(newMsg => 
        !chatHistory.some(existingMsg => 
          existingMsg.text === newMsg.text && existingMsg.sender === newMsg.sender
        )
      );
      
      if (newMessages.length > 0) {
        setChatHistory(prev => [
          ...prev,
          ...newMessages.map(msg => ({
            id: Date.now() + Math.random(),
            text: msg.text,
            sender: msg.sender || 'ai',
            timestamp: new Date()
          }))
        ]);
      }
    }
  }, [messages]);
=======
  const [chatSummary, setChatSummary] = useState(""); // Store chat summary
  const [isGeneratingSummary, setIsGeneratingSummary] = useState(false); // Track summary generation status
>>>>>>> Stashed changes

  // Debug: Log when currentImages changes
  useEffect(() => {
    console.log("Current images updated:", currentImages);
  }, [currentImages]);

<<<<<<< Updated upstream
  // Handle sending messages
  const sendMessage = async () => {
    const text = input.current.value.trim();
    if (!text) return;

    // Add user message to chat history immediately
    const userMessage = {
      id: Date.now(),
      text: text,
      sender: "user",
      timestamp: new Date()
    };
    
    setChatHistory(prev => [...prev, userMessage]);
    
    // Clear input and send to TTS
    input.current.value = "";
    tts(text);
  };
=======
  // Load chat history from localStorage on component mount
  useEffect(() => {
    const savedChatHistory = localStorage.getItem('avatar-chat-history');
    if (savedChatHistory) {
      try {
        const parsed = JSON.parse(savedChatHistory);
        // Convert timestamp strings back to Date objects
        const historyWithDates = parsed.map(msg => ({
          ...msg,
          timestamp: msg.timestamp ? new Date(msg.timestamp) : new Date()
        }));
        setChatHistory(historyWithDates);
      } catch (e) {
        console.error('Failed to parse saved chat history', e);
        setChatHistory([]);
      }
    }
  }, []);

  // Save chat history to localStorage whenever it changes
  useEffect(() => {
    if (chatHistory.length > 0) {
      localStorage.setItem('avatar-chat-history', JSON.stringify(chatHistory));
    }
  }, [chatHistory]);

  // Handle incoming AI messages from single message object
  useEffect(() => {
    if (message && message.text) {
      const aiMessage = {
        id: Date.now() + Math.random(), // Add random to avoid duplicate IDs
        text: message.text,
        sender: "ai",
        timestamp: new Date()
      };
      setChatHistory(prev => {
        // Check if message already exists to avoid duplicates
        const exists = prev.some(msg => 
          msg.sender === "ai" && 
          msg.text === message.text && 
          Math.abs(new Date(msg.timestamp).getTime() - new Date().getTime()) < 5000
        );
        return exists ? prev : [...prev, aiMessage];
      });
    }
  }, [message]);
>>>>>>> Stashed changes

  // Handle multiple AI messages from messages array
  useEffect(() => {
    if (messages && Array.isArray(messages) && messages.length > 0) {
      const newMessages = messages
        .filter(msg => msg && msg.text)
        .map(msg => ({
          id: Date.now() + Math.random(),
          text: msg.text,
          sender: "ai",
          timestamp: new Date()
        }));
      
      if (newMessages.length > 0) {
        setChatHistory(prev => {
          // Filter out duplicates
          const existingTexts = new Set(prev.filter(m => m.sender === "ai").map(m => m.text));
          const uniqueNewMessages = newMessages.filter(msg => !existingTexts.has(msg.text));
          return uniqueNewMessages.length > 0 ? [...prev, ...uniqueNewMessages] : prev;
        });
      }
    }
  }, [messages]);

  // Handle user messages from voice recordings (when backend includes userMessage in response)
  useEffect(() => {
    if (lastUserMessage && lastUserMessage.trim() !== "") {
      setChatHistory(prev => {
        // Check if this message is already in chat history to avoid duplicates
        const messageExists = prev.some(
          msg => msg.sender === "user" && msg.text === lastUserMessage
        );
        
        if (!messageExists) {
          const userMessage = {
            id: Date.now() + Math.random(),
            text: lastUserMessage,
            sender: "user",
            timestamp: new Date()
          };
          // Clear the lastUserMessage after adding to history
          setLastUserMessage("");
          return [...prev, userMessage];
        }
        return prev;
      });
    }
  }, [lastUserMessage, setLastUserMessage]);

  // Handle document upload
  const handleDocumentUpload = async (event) => {
    const file = event.target.files[0];
    if (!file) return;

    setIsUploading(true);
<<<<<<< Updated upstream
    
    // In a real implementation, you would upload the file to your backend
    // For now, we'll just simulate the process
    setTimeout(() => {
      const documentEntry = {
=======
    try {
      const formData = new FormData();
      formData.append('file', file);

      // Use the same backend URL as the speech hook
      const response = await fetch(`http://localhost:3002/api/documents/upload`, {
        method: 'POST',
        body: formData
      });

      if (!response.ok) {
        // Try to get error message from response
        let errorMessage = `HTTP error! status: ${response.status}`;
        try {
          const errorData = await response.json();
          errorMessage = errorData.errorMessage || errorData.error || errorMessage;
        } catch (e) {
          const errorText = await response.text();
          if (errorText) {
            errorMessage = errorText;
          }
        }
        throw new Error(errorMessage);
      }

      const documentData = await response.json();
      setDocuments(prev => [...prev, documentData]);

      // Add a message to chat history about the uploaded document
      const userMessage = {
>>>>>>> Stashed changes
        id: Date.now(),
        name: file.name,
        type: file.type,
        size: file.size,
        uploadTime: new Date()
      };
<<<<<<< Updated upstream
      
      setDocuments(prev => [...prev, documentEntry]);
      setIsUploading(false);
      
      // Add system message about successful upload
      const systemMessage = {
        id: Date.now() + 1,
        text: `Document "${file.name}" uploaded successfully. I can now discuss its contents with you.`,
        sender: "system",
        timestamp: new Date()
      };
      
      setChatHistory(prev => [...prev, systemMessage]);
    }, 1500);
=======
      setChatHistory(prev => [...prev, userMessage]);

      // Add the document summary to chat history
      if (documentData.summary) {
        const summaryMessage = {
          id: Date.now() + 1,
          text: `Document Summary:\n\n${documentData.summary}`,
          sender: "ai",
          timestamp: new Date()
        };
        setChatHistory(prev => [...prev, summaryMessage]);
      }

      // Ask the AI to explain what's in the document using the summary
      const aiPrompt = documentData.summary 
        ? `I've uploaded a document named "${documentData.filename}". Here's a summary of it:\n\n${documentData.summary}\n\nCan you provide a detailed explanation of what this document is about?`
        : `I've uploaded a document named "${documentData.filename}". Can you explain what this document is about?`;
      tts(aiPrompt);

    } catch (error) {
      console.error('=== Document Upload Error ===');
      console.error('Error:', error);
      console.error('Error message:', error.message);
      console.error('Error stack:', error.stack);
      
      // Add error message to chat history with more details
      const errorMessage = {
        id: Date.now(),
        text: `Failed to upload document: ${error.message}`,
        sender: "system",
        timestamp: new Date()
      };
      setChatHistory(prev => [...prev, errorMessage]);
      
      // Show alert with error details
      alert(`Document upload failed: ${error.message}\n\nPlease check:\n1. File type is supported (.txt, .pdf, .docx)\n2. File size is under 10MB\n3. Backend server is running\n\nCheck browser console and backend logs for more details.`);
    } finally {
      setIsUploading(false);
      // Reset file input
      if (fileInput.current) {
        fileInput.current.value = '';
      }
    }
>>>>>>> Stashed changes
  };

  // Generate chat summary
  const generateSummary = async () => {
    if (chatHistory.length === 0) {
      setChatSummary("No conversation to summarize yet.");
      return;
    }

    setIsGeneratingSummary(true);
    
    try {
      const response = await fetch("http://localhost:3002/summary", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ chatHistory }),
      });

      if (!response.ok) {
        throw new Error(`Failed to generate summary: ${response.statusText}`);
      }

      const data = await response.json();
      setChatSummary(data.summary);
    } catch (error) {
      console.error("Error generating summary:", error);
      setChatSummary("Failed to generate summary. Please try again.");
    } finally {
      setIsGeneratingSummary(false);
    }
  };

  // Function to generate chat summary
  const generateSummary = async () => {
    if (chatHistory.length === 0) {
      setChatSummary("The conversation is empty.");
      return;
    }

    setIsGeneratingSummary(true);
    setChatSummary(""); // Clear previous summary
    
    try {
      const response = await fetch("http://localhost:3002/summary", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ chatHistory }),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      setChatSummary(data.summary);
    } catch (error) {
      console.error("Error generating summary:", error);
      setChatSummary("Sorry, I couldn't generate a summary of the conversation. Please try again.");
    } finally {
      setIsGeneratingSummary(false);
    }
  };

  if (hidden) {
    return null;
  }

  return (
    <div className="fixed top-0 left-0 right-0 bottom-0 z-10 flex pointer-events-none">
      {/* Hidden file input for document upload */}
      <input
        type="file"
        ref={fileInput}
        onChange={handleDocumentUpload}
        accept=".pdf,.docx,.txt"
        className="hidden"
        id="documentUpload"
      />

<<<<<<< Updated upstream
=======
      {/* Language Selection - Centered at Top */}
      <div className="absolute left-1/2 transform -translate-x-1/2 top-4 bg-black bg-opacity-70 backdrop-blur-md text-white px-3 py-2 rounded-lg pointer-events-auto z-20 shadow-lg border border-white/20">
        <label className="text-xs font-semibold mb-1 block text-center">🌐 Language</label>
        <select
          value={selectedLanguage}
          onChange={(e) => {
            setSelectedLanguage(e.target.value);
            console.log("Language changed to:", e.target.value);
          }}
          className="bg-white bg-opacity-30 text-white text-sm font-medium px-2 py-1 rounded border border-white/40 focus:outline-none focus:ring-1 focus:ring-blue-400 focus:border-blue-400 cursor-pointer hover:bg-opacity-40 transition-all min-w-[100px]"
        >
          <option value="english" className="bg-gray-800 text-white">English</option>
          <option value="hindi" className="bg-gray-800 text-white">Hindi</option>
          <option value="telugu" className="bg-gray-800 text-white">Telugu</option>
        </select>
      </div>

      {/* Chat Toggle Button - Always visible */}
      <button
        onClick={() => setIsChatOpen(!isChatOpen)}
        className="absolute left-4 top-32 bg-black bg-opacity-50 backdrop-blur-md text-white p-3 rounded-lg pointer-events-auto z-20 hover:bg-opacity-70 transition-all"
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          fill="none"
          viewBox="0 0 24 24"
          strokeWidth={1.5}
          stroke="currentColor"
          className="w-6 h-6"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M2.25 12.76c0 1.6 1.123 2.994 2.707 3.227 1.087.16 2.185.283 3.293.369V21l4.076-4.076a1.526 1.526 0 011.037-.443 48.282 48.282 0 005.68-.494c1.584-.233 2.707-1.626 2.707-3.228V6.741c0-1.602-1.123-2.995-2.707-3.228A48.394 48.394 0 0012 3c-2.392 0-4.744.175-7.043.513C3.373 3.746 2.25 5.14 2.25 6.741v6.018z"
          />
        </svg>
      </button>

      {/* Document Upload Button - Always visible */}
      <button
        onClick={() => document.getElementById('documentUpload').click()}
        disabled={isUploading}
        className="absolute left-4 top-48 bg-black bg-opacity-50 backdrop-blur-md text-white p-3 rounded-lg pointer-events-auto z-20 hover:bg-opacity-70 transition-all disabled:opacity-50"
      >
        {isUploading ? (
          <svg className="animate-spin h-6 w-6 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
          </svg>
        ) : (
          <svg
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
            strokeWidth={1.5}
            stroke="currentColor"
            className="w-6 h-6"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m2.25 0H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9zM15 9h.75a.75.75 0 01.75.75v.75a.75.75 0 01-.75.75H15a.75.75 0 01-.75-.75v-.75A.75.75 0 0115 9zm-3 3.75a.75.75 0 01.75-.75h.75a.75.75 0 01.75.75v.75a.75.75 0 01-.75.75h-.75a.75.75 0 01-.75-.75v-.75z"
            />
          </svg>
        )}
      </button>

      {/* Chat History Panel - Collapsible with pop-up animation */}
      {isChatOpen && (
        <div className="absolute left-0 top-0 h-full bg-gray-900 pointer-events-auto z-40 w-1/4 min-w-[320px] max-w-[400px] flex flex-col shadow-2xl border-r border-gray-700">
          {/* Header Section - Fixed */}
          <div className="flex-shrink-0 p-4 border-b border-gray-600 bg-gray-800">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-bold text-white">Conversation</h2>
              <button
                onClick={() => setIsChatOpen(false)}
                className="text-white hover:text-gray-300 transition-colors"
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  fill="none"
                  viewBox="0 0 24 24"
                  strokeWidth={1.5}
                  stroke="currentColor"
                  className="w-6 h-6"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M6 18L18 6M6 6l12 12"
                  />
                </svg>
              </button>
            </div>
            
            {/* Summarize Chat Button */}
            {chatHistory.length > 0 && (
              <div className="mb-4">
                <button
                  onClick={generateSummary}
                  disabled={isGeneratingSummary}
                  className="w-full bg-purple-600 hover:bg-purple-700 disabled:bg-gray-600 text-white p-2 rounded-lg pointer-events-auto transition-all disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {isGeneratingSummary ? (
                    <>
                      <svg className="animate-spin h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                      <span>Generating Summary...</span>
                    </>
                  ) : (
                    <>
                      <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h3.75M9 15h3.75M9 18h3.75m3 .75H18a2.25 2.25 0 002.25-2.25V6.108c0-1.135-.845-2.098-1.976-2.192a48.424 48.424 0 00-1.123-.08m-5.801 0c-.065.21-.1.433-.1.664 0 .414.336.75.75.75h4.5a.75.75 0 00.75-.75 2.25 2.25 0 00-.1-.664m-5.8 0A2.251 2.251 0 0113.5 2.25H15c1.012 0 1.867.668 2.15 1.586m-5.8 0c-.376.023-.75.05-1.124.08C9.095 4.01 8.25 4.973 8.25 6.108V8.25m0 0H4.875c-.621 0-1.125.504-1.125 1.125v11.25c0 .621.504 1.125 1.125 1.125h9.75c.621 0 1.125-.504 1.125-1.125V9.375c0-.621-.504-1.125-1.125-1.125H8.25zM6.75 12h.008v.008H6.75V12zm0 3h.008v.008H6.75V15zm0 3h.008v.008H6.75V18z" />
                      </svg>
                      <span>Summarize Chat</span>
                    </>
                  )}
                </button>
              </div>
            )}
            
            {/* Chat Summary Display - Scrollable */}
            {chatSummary && (
              <div className="mb-4 bg-purple-900 bg-opacity-50 rounded-lg border border-purple-500 flex flex-col max-h-[200px]">
                <div className="flex justify-between items-center p-3 border-b border-purple-600 flex-shrink-0">
                  <h3 className="font-bold text-purple-200">Chat Summary</h3>
                  <button 
                    onClick={() => setChatSummary("")}
                    className="text-gray-300 hover:text-white transition-colors"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
                <div className="overflow-y-auto p-3 scrollbar-thin scrollbar-thumb-purple-600 scrollbar-track-transparent">
                  <p className="text-white text-sm whitespace-pre-wrap">{chatSummary}</p>
                </div>
              </div>
            )}
          </div>
          
          {/* Scrollable Chat History Section */}
          <div className="flex-1 overflow-y-auto p-4 bg-gray-900 scrollbar-thin scrollbar-thumb-gray-600 scrollbar-track-transparent">
            <div className="space-y-4">
              {chatHistory.length > 0 ? (
                [...chatHistory]
                  .sort((a, b) => {
                    const timeA = a.timestamp instanceof Date ? a.timestamp.getTime() : new Date(a.timestamp).getTime();
                    const timeB = b.timestamp instanceof Date ? b.timestamp.getTime() : new Date(b.timestamp).getTime();
                    return timeA - timeB;
                  })
                  .map((msg) => (
                    <div 
                      key={msg.id} 
                      className={`p-3 rounded-lg max-w-full ${
                        msg.sender === "user" 
                          ? "bg-blue-600 ml-auto" 
                          : msg.sender === "system"
                          ? "bg-yellow-600"
                          : "bg-gray-700"
                      }`}
                    >
                      <div className="font-semibold text-sm mb-1 text-white">
                        {msg.sender === "user" ? "You" : msg.sender === "system" ? "System" : "Assistant"}
                      </div>
                      <div className="text-white break-words whitespace-pre-wrap">{msg.text}</div>
                      <div className="text-xs text-gray-300 mt-1">
                        {msg.timestamp instanceof Date 
                          ? msg.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                          : msg.timestamp 
                            ? new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                            : new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </div>
                    </div>
                  ))
              ) : (
                <div className="text-gray-300 text-center py-8 px-4">
                  <p className="text-lg mb-2">No conversation yet.</p>
                  <p className="text-sm">Start by typing a message or uploading a document!</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Live Captions Display - Movie/YouTube Style Subtitles */}
      {(currentMessageText || displayedCaptionText) && (
        <div className="fixed bottom-8 left-1/2 transform -translate-x-1/2 z-30 pointer-events-none px-4 w-full max-w-3xl">
          <div className="relative animate-cinematicFadeIn">
            {/* Movie/YouTube style subtitle background */}
            <div 
              className="inline-block px-4 py-2 rounded-sm"
              style={{
                backgroundColor: 'rgba(0, 0, 0, 0.75)',
                backdropFilter: 'blur(4px)',
                boxShadow: '0 2px 8px rgba(0, 0, 0, 0.5)'
              }}
            >
              {/* Caption text - Movie/YouTube style */}
              <p 
                className="text-lg md:text-xl font-normal leading-relaxed text-center break-words text-white"
                style={{
                  textShadow: '0 1px 2px rgba(0, 0, 0, 0.8), 0 0 4px rgba(0, 0, 0, 0.5)',
                  letterSpacing: '0.01em',
                  lineHeight: '1.4',
                  fontFamily: 'system-ui, -apple-system, sans-serif'
                }}
              >
                {displayedCaptionText || currentMessageText}
                {displayedCaptionText && displayedCaptionText.length < currentMessageText.length && (
                  <span className="inline-block w-0.5 h-5 bg-white ml-1 animate-pulse align-middle"></span>
                )}
              </p>
            </div>
          </div>
        </div>
      )}

>>>>>>> Stashed changes
      {/* Main Interface - Right side */}
      <div className="flex-1 flex flex-col justify-between p-4">
        <div className="self-start backdrop-blur-md bg-white bg-opacity-50 p-4 rounded-lg">
          <h1 className="font-black text-xl text-gray-700">Adam</h1>
          <p className="text-gray-600">
            {loading ? "Loading..." : "Type a message and press enter to chat with the AI."}
          </p>
          {isUploading && (
            <p className="text-gray-600 mt-2">Uploading document...</p>
          )}
        </div>
        
        {/* Conversation Box - Positioned directly below the Digital Human box */}
        {isChatOpen && (
          <div className="mt-4 w-full max-w-md bg-black bg-opacity-30 backdrop-blur-md p-4 rounded-lg pointer-events-auto z-10">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-bold text-white">Conversation</h2>
              <button
                onClick={() => setIsChatOpen(false)}
                className="text-white hover:text-gray-300"
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  fill="none"
                  viewBox="0 0 24 24"
                  strokeWidth={1.5}
                  stroke="currentColor"
                  className="w-6 h-6"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M6 18L18 6M6 6l12 12"
                  />
                </svg>
              </button>
            </div>
            
            {/* Chat Summary Display */}
            {chatSummary && (
              <div className="mb-4 p-3 bg-purple-900 bg-opacity-50 rounded-lg">
                <div className="flex justify-between items-center mb-2">
                  <h3 className="font-bold text-purple-200">Chat Summary</h3>
                  <button 
                    onClick={() => setChatSummary("")}
                    className="text-gray-300 hover:text-white"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
                <p className="text-white text-sm">{chatSummary}</p>
              </div>
            )}
            
            {/* Chat History - Continuous flow like ChatGPT */}
            <div className="space-y-4 mb-4" style={{ maxHeight: '200px', overflowY: 'auto' }}>
              {chatHistory.map((msg) => (
                <div 
                  key={msg.id} 
                  className={`p-3 rounded-lg max-w-full ${
                    msg.sender === "user" 
                      ? "bg-blue-500 bg-opacity-70 ml-auto" 
                      : msg.sender === "system"
                      ? "bg-yellow-500 bg-opacity-70"
                      : "bg-gray-700 bg-opacity-50"
                  }`}
                >
                  <div className="font-semibold text-sm mb-1 text-white">
                    {msg.sender === "user" ? "You" : msg.sender === "system" ? "System" : "Assistant"}
                  </div>
                  <div className="text-white">{msg.text}</div>
                  <div className="text-xs text-gray-300 mt-1">
                    {msg.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </div>
                </div>
              ))}
              
              {chatHistory.length === 0 && (
                <div className="text-gray-300 text-center py-8">
                  No conversation yet. Start by typing a message or uploading a document!
                </div>
              )}
            </div>
            
            {/* Document Upload and Summarize Chat Buttons - Moved to bottom of conversation box */}
            <div className="flex flex-col gap-2 pt-4 border-t border-gray-700">
              {/* Document Upload Button */}
              <button
                onClick={() => document.getElementById('documentUpload').click()}
                disabled={isUploading}
                className="flex items-center justify-center bg-blue-600 hover:bg-blue-700 disabled:bg-gray-500 text-white p-2 rounded-lg pointer-events-auto transition-all disabled:opacity-50"
              >
                {isUploading ? (
                  <div className="flex items-center">
                    <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    Uploading...
                  </div>
                ) : (
                  <div className="flex items-center">
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5 mr-1">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m2.25 0H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9zM15 9h.75a.75.75 0 01.75.75v.75a.75.75 0 01-.75.75H15a.75.75 0 01-.75-.75v-.75A.75.75 0 0115 9zm-3 3.75a.75.75 0 01.75-.75h.75a.75.75 0 01.75.75v.75a.75.75 0 01-.75.75h-.75a.75.75 0 01-.75-.75v-.75z" />
                    </svg>
                    Upload Document
                  </div>
                )}
              </button>
              
              {/* Retention Test Button */}
              <button
                onClick={() => setIsRetentionTestOpen(true)}
                disabled={chatHistory.length === 0}
                className="flex items-center justify-center bg-amber-600 hover:bg-amber-700 disabled:bg-gray-500 text-white p-2 rounded-lg pointer-events-auto transition-all disabled:opacity-50"
              >
                <div className="flex items-center">
                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5 mr-1">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9.879 7.519c1.171-1.025 3.071-1.025 4.242 0 1.172 1.025 1.172 2.687 0 3.712-.229.18-.468.345-.714.493l-.151.082c-.253.134-.518.25-.793.346-.275.096-.558.171-.845.225-.287.054-.58.081-.876.081-.296 0-.589-.027-.876-.081-.287-.054-.57-.129-.845-.225-.275-.096-.54-.212-.793-.346l-.151-.082c-.246-.148-.485-.313-.714-.493-1.172-1.025-1.172-2.687 0-3.712zM9.879 7.519c1.171-1.025 3.071-1.025 4.242 0 1.172 1.025 1.172 2.687 0 3.712M9.879 7.519c-.107.06-.214.122-.32.185-.107.063-.213.127-.319.192-.106.065-.212.131-.318.198-.106.067-.21.135-.314.21-.104.071-.208.143-.311.216-.103.073-.206.147-.289.222-.098.08-.195.161-.292.243-.097.082-.193.165-.289.249-.096.084-.191.169-.286.255-.095.086-.189.173-.283.261-.094.088-.187.176-.267.281-.09.093-.179.187-.267.281-.092.091-.181.183-.271.272-.091.092-.181.185-.271.278-.09.093-.179.197-.267.293-.088.098-.163.197-.243.297-.08.1-.159.2-.237.301-.078.101-.155.203-.231.305-.076.102-.151.205-.225.309-.074.104-.147.209-.219.315-.072.106-.143.213-.213.32-.07.107-.139.215-.207.324-.068.109-.135.218-.2.328-.065.11-.129.22-.192.331-.063.111-.125.223-.186.335-.061.112-.121.224-.18.337-.059.113-.117.226-.174.34-.057.114-.113.228-.168.343-.055.115-.109.23-.162.346-.053.116-.105.232-.156.349-.051.117-.101.234-.15.352-.049.118-.097.236-.144.355-.047.119-.093.238-.138.358-.045.12-.089.24-.132.361-.043.121-.085.242-.126.364-.041.122-.081.244-.12.366-.039.122-.077.245-.114.368-.037.123-.073.246-.108.37-.035.124-.069.248-.102.372-.033.124-.065.249-.096.374-.031.125-.061.25-.09.376-.029.126-.057.252-.084.378-.027.126-.053.253-.078.38-.025.127-.049.254-.072.382-.021.128-.041.256-.06.385-.019.129-.037.258-.054.387-.017.129-.033.259-.048.389-.015.13-.029.26-.042.39-.013.13-.025.26-.036.391-.011.131-.021.262-.03.393-.009.131-.017.262-.024.393-.007.131-.013.263-.018.395-.005.132-.009.264-.012.396-.003.132-.005.264-.006.396-.001.132-.001.264 0 .396.001.132.003.264.006.396.003.132.007.264.012.395.005.131.011.263.018.393.007.131.015.262.024.393.009.131.019.262.03.393.011.13.023.26.036.39.013.13.027.26.042.389.015.13.031.259.048.387.017.129.035.258.054.387.019.129.039.257.06.385.021.128.043.256.066.384.023.128.047.255.072.382.025.127.051.254.078.38.027.126.055.252.084.378.029.126.059.251.09.376.031.125.063.25.096.374.033.124.067.248.102.372.035.124.071.247.108.37.037.123.075.246.114.368.039.122.079.244.12.366.041.122.083.243.126.364.043.121.087.241.132.361.045.12.091.239.138.358.047.119.095.237.144.355.049.118.099.235.15.352.051.117.103.233.156.349.053.116.107.231.162.346.055.115.111.229.168.343.057.114.113.228.174.34.061.112.123.224.186.335.063.111.127.221.192.331.065.11.131.22.2.328.069.109.138.217.207.324.07.107.141.214.213.32.072.106.145.211.219.315.074.104.149.207.225.309.076.102.153.204.231.305.078.1.157.2.237.301.08.101.161.201.243.297.082.096.165.192.249.29.084.097.169.194.255.29.086.096.173.191.261.285.088.094.177.188.267.281.09.093.181.186.271.278.091.092.182.184.274.275.092.091.184.182.277.272.093.09.186.179.28.266.094.087.188.174.283.261.095.086.19.171.286.255.096.084.192.167.289.249.097.082.194.163.292.243.098.08.196.159.295.237.099.078.197.156.295.233.098.077.197.153.296.228.099.075.199.149.299.222.1.073.201.145.303.216.102.071.205.141.309.21.104.069.209.137.316.204.107.067.213.133.319.198.106.065.212.129.319.192.107.063.214.125.32.185z" />
                  </svg>
                  Retention Test
                </div>
              </button>
              
              {/* Summary Button */}
              <button
                onClick={generateSummary}
                disabled={isGeneratingSummary || chatHistory.length === 0}
                className="flex items-center justify-center bg-purple-600 hover:bg-purple-700 disabled:bg-gray-500 text-white p-2 rounded-lg pointer-events-auto transition-all disabled:opacity-50"
              >
                {isGeneratingSummary ? (
                  <div className="flex items-center">
                    <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    Generating...
                  </div>
                ) : (
                  <div className="flex items-center">
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5 mr-1">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h3.75M9 15h3.75M9 18h3.75m3 .75H18a2.25 2.25 0 002.25-2.25V6.108c0-1.135-.845-2.098-1.976-2.192a48.424 48.424 0 00-1.123-.08m-5.801 0c-.065.21-.1.433-.1.664 0 .414.336.75.75.75h4.5a.75.75 0 00.75-.75 2.25 2.25 0 00-.1-.664m-5.8 0A2.251 2.251 0 0113.5 2.25H15c1.012 0 1.867.668 2.15 1.586m-5.8 0c-.376.023-.75.05-1.124.08C9.095 4.01 8.25 4.973 8.25 6.108V8.25m0 0H4.875c-.621 0-1.125.504-1.125 1.125v11.25c0 .621.504 1.125 1.125 1.125h9.75c.621 0 1.125-.504 1.125-1.125V9.375c0-.621-.504-1.125-1.125-1.125H8.25zM6.75 12h.008v.008H6.75V12zm0 3h.008v.008H6.75V15zm0 3h.008v.008H6.75V18z" />
                    </svg>
                    Summarize Chat
                  </div>
                )}
              </button>
            </div>
          </div>
        )}
        
        {/* Chat Toggle Button - Positioned below Digital Human box when conversation is closed */}
        {!isChatOpen && (
          <button
            onClick={() => setIsChatOpen(true)}
            className="mt-4 self-start bg-black bg-opacity-50 backdrop-blur-md text-white p-3 rounded-lg pointer-events-auto z-20 hover:bg-opacity-70 transition-all"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
              strokeWidth={1.5}
              stroke="currentColor"
              className="w-6 h-6"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M2.25 12.76c0 1.6 1.123 2.994 2.707 3.227 1.087.16 2.185.283 3.293.369V21l4.076-4.076a1.526 1.526 0 011.037-.443 48.282 48.282 0 005.68-.494c1.584-.233 2.707-1.626 2.707-3.228V6.741c0-1.602-1.123-2.995-2.707-3.228A48.394 48.394 0 0012 3c-2.392 0-4.744.175-7.043.513C3.373 3.746 2.25 5.14 2.25 6.741v6.018z"
              />
            </svg>
          </button>
        )}
        
        {/* Retention Test Modal */}
        {isRetentionTestOpen && (
          <RetentionTest 
            chatHistory={chatHistory} 
            onClose={() => setIsRetentionTestOpen(false)} 
          />
        )}
        
        {/* Images Display Section - Middle Right, won't overlap controls */}
        {currentImages && currentImages.length > 0 && (
          <div className="absolute right-4 top-32 bg-black bg-opacity-50 backdrop-blur-md p-4 rounded-lg pointer-events-auto z-10" style={{ maxWidth: '350px', maxHeight: 'calc(100vh - 250px)', overflowY: 'auto' }}>
            <div className="flex flex-col gap-3">
              {currentImages.map((imageData, index) => {
                // Handle both old format (just URL string) and new format (object with url and label)
                const imageUrl = typeof imageData === 'string' ? imageData : imageData.url;
                
                return (
                  <div key={`img-${index}-${imageUrl}`} className="relative overflow-hidden rounded-lg shadow-lg" style={{ backgroundColor: '#1a1a1a' }}>
                    <img
                      src={imageUrl}
<<<<<<< Updated upstream
                      alt={`Related topic image ${index + 1}`}
=======
                      alt={`Related image ${index + 1}`}
>>>>>>> Stashed changes
                      className="w-full object-cover transition-transform hover:scale-105"
                      style={{ height: '200px', display: 'block' }}
                      onLoad={(e) => {
                        console.log(`Image ${index + 1} loaded successfully:`, imageUrl);
                      }}
                      onError={(e) => {
                        console.error(`Image ${index + 1} failed to load:`, imageUrl);
                        // Fallback to a different random image if one fails
                        e.target.src = `https://picsum.photos/350/200?random=${Date.now()}_${index}`;
                      }}
                    />
                  </div>
                );
              })}
            </div>
          </div>
        )}
        
        <div className="w-full flex flex-col items-end justify-center gap-4"></div>
        <div className="flex items-center gap-2 pointer-events-auto max-w-screen-sm w-full mx-auto">
          <button
            onClick={recording ? stopRecording : startRecording}
            className={`bg-gray-500 hover:bg-gray-600 text-white p-4 px-4 font-semibold uppercase rounded-md ${
              recording ? "bg-red-500 hover:bg-red-600" : ""
            } ${loading || message ? "cursor-not-allowed opacity-30" : ""}`}
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
              strokeWidth={1.5}
              stroke="currentColor"
              className="w-6 h-6"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M12 18.75a6 6 0 0 0 6-6v-1.5m-6 7.5a6 6 0 0 1-6-6v-1.5m6 7.5v3.75m-3.75 0h7.5M12 15.75a3 3 0 0 1-3-3V4.5a3 3 0 1 1 6 0v8.25a3 3 0 0 1-3 3Z"
              />
            </svg>
          </button>

          <input
            className="w-full placeholder:text-gray-800 placeholder:italic p-4 rounded-md bg-opacity-50 bg-white backdrop-blur-md"
            placeholder="Type a message..."
            ref={input}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                sendMessage();
              }
            }}
          />
          <button
            disabled={loading || message}
            onClick={sendMessage}
            className={`bg-gray-500 hover:bg-gray-600 text-white p-4 px-10 font-semibold uppercase rounded-md ${
              loading || message ? "cursor-not-allowed opacity-30" : ""
            }`}
          >
            Send
          </button>
          
          {/* Stop Audio Button - Only shown when there's an active message */}
          {message && (
            <button
              onClick={stopAudio}
              className="bg-red-500 hover:bg-red-600 text-white p-4 px-4 font-semibold uppercase rounded-md"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                viewBox="0 0 24 24"
                strokeWidth={1.5}
                stroke="currentColor"
                className="w-6 h-6"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M5.25 7.5A2.25 2.25 0 017.5 5.25h9a2.25 2.25 0 012.25 2.25v9a2.25 2.25 0 01-2.25 2.25h-9a2.25 2.25 0 01-2.25-2.25v-9z"
                />
              </svg>
            </button>
          )}
        </div>
      </div>
    </div>
  );
};