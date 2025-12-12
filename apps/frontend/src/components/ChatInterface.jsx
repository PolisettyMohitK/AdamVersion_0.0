import { useRef, useState, useEffect } from "react";
import { useSpeech } from "../hooks/useSpeech";

export const ChatInterface = ({ hidden, ...props }) => {
  const input = useRef();
  const fileInput = useRef();
  const { tts, loading, message, startRecording, stopRecording, recording, currentMessageText, stopAudio, messages, currentImages } = useSpeech();
  const [chatHistory, setChatHistory] = useState([]); // Store all messages in order
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [documents, setDocuments] = useState([]); // Store uploaded documents
  const [isUploading, setIsUploading] = useState(false); // Track upload status
  const [isGeneratingSummary, setIsGeneratingSummary] = useState(false); // Track summary generation status
  const [chatSummary, setChatSummary] = useState(""); // Store chat summary

  // Debug: Log when currentImages changes
  useEffect(() => {
    console.log("ChatInterface - currentImages updated:", currentImages);
  }, [currentImages]);

  // Load chat history from localStorage on component mount
  useEffect(() => {
    const savedChatHistory = localStorage.getItem('avatar-chat-history');
    if (savedChatHistory) {
      try {
        setChatHistory(JSON.parse(savedChatHistory));
      } catch (e) {
        console.error('Failed to parse saved chat history', e);
      }
    }
  }, []);

  // Save chat history to localStorage whenever it changes
  useEffect(() => {
    localStorage.setItem('avatar-chat-history', JSON.stringify(chatHistory));
  }, [chatHistory]);

  // Handle incoming AI messages
  useEffect(() => {
    if (message && message.text) {
      const aiMessage = {
        id: Date.now(),
        text: message.text,
        sender: "ai",
        timestamp: new Date()
      };
      setChatHistory(prev => [...prev, aiMessage]);
    }
  }, [message]);

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
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const documentData = await response.json();
      setDocuments(prev => [...prev, documentData]);

      // Add a message to chat history about the uploaded document
      const userMessage = {
        id: Date.now(),
        text: `Uploaded document: ${documentData.filename}`,
        sender: "user",
        timestamp: new Date()
      };
      setChatHistory(prev => [...prev, userMessage]);

      // Ask the AI to explain what's in the document
      const aiPrompt = `I've uploaded a document named "${documentData.filename}". Can you explain what this document is about based on its content?`;
      tts(aiPrompt);

    } catch (error) {
      console.error('Document Upload Error:', error);
      // Add error message to chat history
      const errorMessage = {
        id: Date.now(),
        text: `Failed to upload document: ${error.message}`,
        sender: "system",
        timestamp: new Date()
      };
      setChatHistory(prev => [...prev, errorMessage]);
    } finally {
      setIsUploading(false);
      // Reset file input
      if (fileInput.current) {
        fileInput.current.value = '';
      }
    }
  };

  const sendMessage = () => {
    const text = input.current.value;
    if (!loading && !message && text.trim()) {
      // Add user message to chat history
      const userMessage = {
        id: Date.now(),
        text: text,
        sender: "user",
        timestamp: new Date()
      };
      setChatHistory(prev => [...prev, userMessage]);
      
      tts(text);
      input.current.value = "";
    }
  };

  // New function to generate chat summary
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

      {/* Main Interface - Right side */}
      <div className="flex-1 flex flex-col justify-between p-4">
        <div className="self-start backdrop-blur-md bg-white bg-opacity-50 p-4 rounded-lg">
          <h1 className="font-black text-xl text-gray-700">Digital Human</h1>
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
        
        {/* Images Display Section - Middle Right, won't overlap controls */}
        {currentImages && currentImages.length > 0 && (
          <div className="absolute right-4 top-32 bg-black bg-opacity-50 backdrop-blur-md p-4 rounded-lg pointer-events-auto z-10" style={{ maxWidth: '350px', maxHeight: 'calc(100vh - 250px)', overflowY: 'auto' }}>
            <h3 className="text-white font-semibold mb-3 text-sm">Related Topics</h3>
            <div className="flex flex-col gap-3">
              {currentImages.map((imageData, index) => {
                // Handle both old format (just URL string) and new format (object with url and label)
                const imageUrl = typeof imageData === 'string' ? imageData : imageData.url;
                
                return (
                  <div key={`img-${index}-${imageUrl}`} className="relative overflow-hidden rounded-lg shadow-lg" style={{ backgroundColor: '#1a1a1a' }}>
                    <img
                      src={imageUrl}
                      alt={`Related topic image ${index + 1}`}
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