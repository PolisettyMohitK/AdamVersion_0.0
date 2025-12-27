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
  const [isGeneratingSummary, setIsGeneratingSummary] = useState(false); // Track summary generation status
  const [chatSummary, setChatSummary] = useState(""); // Store chat summary
  const [isRetentionTestOpen, setIsRetentionTestOpen] = useState(false); // Track retention test modal state

  // Debug: Log when currentImages changes
  useEffect(() => {
    console.log("Current images updated:", currentImages);
  }, [currentImages]);

  // Chat history is temporary - cleared on page reload
  // No localStorage persistence

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
        id: Date.now(),
        text: `Uploaded document: ${documentData.filename || file.name}`,
        sender: "user",
        timestamp: new Date()
      };
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
  };

  // Generate chat summary
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
                      alt={`Related image ${index + 1}`}
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