import express from "express";
import cors from "cors";
import multer from "multer";
import fs from "fs";
import { tmpdir } from "os";
import { join, extname } from "path";
import { generateAvatarResponse, generateChatSummary, generateRetentionTest, generatePersonalizedFeedback } from "./modules/gemini.mjs";
// TTS removed
import { lipSync } from "./modules/lip-sync.mjs";
import { convertAudioToText } from "./modules/stt.mjs";
import dotenv from "dotenv";

// Lazy import pdf-parse to avoid initialization issues with test files
let pdfParseFunction = null;
const getPdfParse = async () => {
  if (pdfParseFunction) return pdfParseFunction;
  
  // Ensure test directory and file exist before import
  const testDir = join(process.cwd(), 'test', 'data');
  const testFile = join(testDir, '05-versions-space.pdf');
  
  if (!fs.existsSync(testDir)) {
    fs.mkdirSync(testDir, { recursive: true });
  }
  
  // Create a minimal valid PDF file if it doesn't exist
  if (!fs.existsSync(testFile)) {
    // Minimal PDF header (PDF-1.4)
    const minimalPdf = Buffer.from([
      0x25, 0x50, 0x44, 0x46, 0x2D, 0x31, 0x2E, 0x34, 0x0A, // %PDF-1.4
      0x25, 0xE2, 0xE3, 0xCF, 0xD3, 0x0A, // Binary comment
      0x78, 0x72, 0x65, 0x66, 0x0A, // xref
      0x30, 0x20, 0x30, 0x0A, // 0 0
      0x74, 0x72, 0x61, 0x69, 0x6C, 0x65, 0x72, 0x0A, // trailer
      0x3C, 0x3C, 0x2F, 0x53, 0x69, 0x7A, 0x65, 0x20, 0x30, 0x3E, 0x3E, 0x0A, // << /Size 0 >>
      0x73, 0x74, 0x61, 0x72, 0x74, 0x78, 0x72, 0x65, 0x66, 0x0A, // startxref
      0x30, 0x0A, // 0
      0x25, 0x25, 0x45, 0x4F, 0x46 // %%EOF
    ]);
    fs.writeFileSync(testFile, minimalPdf);
    console.log(`Created minimal PDF test file: ${testFile}`);
  }
  
  try {
    const pdfParseModule = await import('pdf-parse');
    pdfParseFunction = pdfParseModule.default || pdfParseModule;
    return pdfParseFunction;
  } catch (error) {
    // If import still fails, try to get the function from the module cache
    if (error.message && error.message.includes('ENOENT')) {
      console.warn("pdf-parse import had ENOENT error, but trying to use module anyway:", error.message);
      try {
        // Try to require it as a fallback (if available)
        const pdfParseModule = await import('pdf-parse');
        pdfParseFunction = pdfParseModule.default || pdfParseModule;
        return pdfParseFunction;
      } catch (e) {
        throw new Error(`Failed to load pdf-parse: ${e.message}`);
      }
    } else {
      throw new Error(`Failed to load pdf-parse: ${error.message}`);
    }
  }
};

dotenv.config();

const responseCache = new Map();
const CACHE_TTL = 0; // Cache disabled - always generate fresh responses

const app = express();
// Increase payload size limit for JSON (needed for large audio base64 data)
app.use(express.json({ limit: '50mb' }));
app.use(cors());
// Increase payload size limit for file uploads
app.use(express.urlencoded({ extended: true, limit: '50mb' }));
const port = 3002; // Changed from 3001 to 3002

// Configure multer for file uploads
const upload = multer({
  dest: tmpdir(),
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB limit
  },
  fileFilter: (req, file, cb) => {
    const allowedTypes = ['.pdf', '.docx', '.txt', '.doc'];
    const ext = extname(file.originalname).toLowerCase();
    if (allowedTypes.includes(ext)) {
      cb(null, true);
    } else {
      cb(new Error(`File type ${ext} not allowed. Allowed types: ${allowedTypes.join(', ')}`));
    }
  },
});

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
  const language = req.body.language || "english"; // Default to english
  
  console.log("Received TTS request:", question);
  console.log("Language:", language);
  
  try {
    // Cache disabled - always generate fresh responses
    // Check cache first (include language in cache key)
    const cacheKey = `${language}:${question.toLowerCase().trim()}`;
    const cachedResponse = responseCache.get(cacheKey);
    
    if (CACHE_TTL > 0 && cachedResponse && Date.now() - cachedResponse.timestamp < CACHE_TTL) {
      console.log("Returning cached response for TTS:", cacheKey);
      res.send(cachedResponse.data);
      return;
    }
    
    // Generate response with language parameter
    console.log("=== TTS Request ===");
    console.log("Question:", question);
    console.log("Language:", language);
    console.log("Cache disabled - generating fresh response");
    const geminiResponse = await generateAvatarResponse(question, language);
    console.log("Gemini response received:", JSON.stringify(geminiResponse, null, 2));
    
    // Apply lip sync to all messages with language parameter
    const syncedResponse = await lipSync(geminiResponse, language);
    
    // Cache the response
    responseCache.set(cacheKey, {
      data: syncedResponse,
      timestamp: Date.now()
    });
    
    res.send(syncedResponse);
  } catch (error) {
    console.error("Error generating avatar response:", error);
    console.error("Error message:", error.message);
    console.error("Error stack:", error.stack);
    
    // If it's a quota error, try to return a more helpful message
    if (error.status === 429 || error.message?.includes('quota') || error.message?.includes('429')) {
      const quotaMessages = [
        {
          text: "I'm experiencing high demand right now. Please try again in a few minutes.",
          facialExpression: "sad",
          animation: "SadIdle"
        }
      ];
      res.send({ messages: quotaMessages });
    } else {
      // Return error in a format the frontend can handle
      const errorMessage = error.message || "Failed to generate avatar response";
      console.error("Sending error response to frontend:", errorMessage);
      res.status(500).send({ 
        error: errorMessage,
        errorMessage: errorMessage,
        messages: [{
          text: `Sorry, I encountered an error: ${errorMessage}. Please try again.`,
          facialExpression: "sad",
          animation: "SadIdle"
        }]
      });
    }
  }
});

app.post("/sts", async (req, res) => {
  const base64Audio = req.body.audio;
  const language = req.body.language || "english"; // Get language from request
  const audioData = Buffer.from(base64Audio, "base64");
  
  try {
    console.log("=== STS Request Received ===");
    console.log("Audio data size:", audioData.length, "bytes");
    console.log("Language from request:", language);
    console.log("⚠️ IMPORTANT: This language will be used for:");
    console.log("   1. Speech-to-Text transcription (STT)");
    console.log("   2. Gemini response generation");
    console.log("   3. Text-to-Speech synthesis (TTS)");
    
    if (!base64Audio || audioData.length === 0) {
      console.error("No audio data received");
      return res.status(400).send({ 
        error: "No audio data provided",
        messages: [{
          text: "No audio was received. Please try recording again.",
          facialExpression: "sad",
          animation: "SadIdle"
        }],
        userMessage: ""
      });
    }
    
    // Convert audio to text using STT module with language parameter
    console.log("=== Converting audio to text ===");
    console.log("Language parameter for STT:", language);
    console.log("Language type:", typeof language);
    let userMessage;
    try {
      userMessage = await convertAudioToText({ audioData, language });
    } catch (sttError) {
      console.error("STT conversion error:", sttError);
      console.error("STT error stack:", sttError.stack);
      userMessage = "";
    }
    
    console.log("=== STT Transcription Result ===");
    console.log("Transcribed user message:", userMessage);
    console.log("Message length:", userMessage ? userMessage.length : 0);
    console.log("Message preview:", userMessage ? userMessage.substring(0, 100) : "empty");
    
    // Validate transcription language matches selected language
    const lang = language.toLowerCase();
    if (userMessage && userMessage.trim() !== "") {
      if (lang === "telugu" || lang === "te") {
        const teluguScriptRegex = /[\u0C00-\u0C7F]/;
        const hasTelugu = teluguScriptRegex.test(userMessage);
        console.log(`[STS] Transcription contains Telugu script: ${hasTelugu ? '✅ YES' : '❌ NO'}`);
        if (!hasTelugu) {
          console.warn(`[STS] ⚠️ WARNING: User selected Telugu but transcription appears to be in English or another language`);
          console.warn(`[STS] Transcription: "${userMessage}"`);
          console.warn(`[STS] Will still force Gemini to respond in Telugu`);
        }
      } else if (lang === "hindi" || lang === "hi") {
        const hindiScriptRegex = /[\u0900-\u097F]/;
        const hasHindi = hindiScriptRegex.test(userMessage);
        console.log(`[STS] Transcription contains Hindi script: ${hasHindi ? '✅ YES' : '❌ NO'}`);
        if (!hasHindi) {
          console.warn(`[STS] ⚠️ WARNING: User selected Hindi but transcription appears to be in English or another language`);
          console.warn(`[STS] Transcription: "${userMessage}"`);
          console.warn(`[STS] Will still force Gemini to respond in Hindi`);
        }
      }
    }
    
    // If transcription failed or returned empty, use a fallback
    if (!userMessage || userMessage.trim() === "" || userMessage.includes("Sorry, I couldn't understand") || userMessage.includes("Hello, this is a test")) {
      console.warn("STT failed or returned empty/invalid, using fallback");
      const fallbackMessages = [
        {
          text: "I'm sorry, I couldn't understand your message. Could you please try speaking again or type your question?",
          facialExpression: "sad",
          animation: "SadIdle"
        }
      ];
      console.log("Sending fallback response");
      res.send({ messages: fallbackMessages, userMessage: userMessage || "" });
      return;
    }
    
    // Cache disabled - always generate fresh responses
    // Check cache first (include language in cache key)
    const cacheKey = `${language}:${userMessage.toLowerCase().trim()}`;
    const cachedResponse = responseCache.get(cacheKey);
    
    if (CACHE_TTL > 0 && cachedResponse && Date.now() - cachedResponse.timestamp < CACHE_TTL) {
      console.log("Returning cached response for STS:", cacheKey);
      res.send({ ...cachedResponse.data, userMessage: userMessage });
      return;
    }
    
    // Generate new response if not cached
    console.log("=== Calling Gemini API ===");
    console.log("Question (transcribed):", userMessage);
    console.log("Language parameter:", language);
    console.log("Language type:", typeof language);
    console.log("⚠️ CRITICAL: Gemini MUST respond in", language.toUpperCase());
    
    const geminiResponse = await generateAvatarResponse(userMessage, language);
    
    console.log("=== Gemini Response Received ===");
    console.log("Response messages count:", geminiResponse.messages ? geminiResponse.messages.length : 0);
    if (geminiResponse.messages && geminiResponse.messages.length > 0) {
      console.log("First message text:", geminiResponse.messages[0].text.substring(0, 200));
      console.log("Full first message:", JSON.stringify(geminiResponse.messages[0], null, 2));
    }
    
    if (!geminiResponse || !geminiResponse.messages || geminiResponse.messages.length === 0) {
      console.error("Gemini returned empty or invalid response");
      res.status(500).send({ 
        error: "Failed to generate response",
        messages: [{
          text: "I'm sorry, I couldn't generate a response. Please try again.",
          facialExpression: "sad",
          animation: "SadIdle"
        }]
      });
      return;
    }
    
    // Apply lip sync with language parameter
    console.log("Applying lip sync with language:", language);
    const syncedResponse = await lipSync(geminiResponse, language);
    console.log("Lip sync completed");
    
    // Cache the response
    responseCache.set(cacheKey, {
      data: syncedResponse,
      timestamp: Date.now()
    });
    
    // Include the transcribed user message in the response for chat history
    syncedResponse.userMessage = userMessage;
    
    console.log("=== Sending Response ===");
    console.log("Response messages count:", syncedResponse.messages ? syncedResponse.messages.length : 0);
    res.send(syncedResponse);
  } catch (error) {
    console.error("=== ERROR in STS endpoint ===");
    console.error("Error type:", error.constructor.name);
    console.error("Error message:", error.message);
    console.error("Error stack:", error.stack);
    
    // If it's a quota error, try to return a more helpful message
    if (error.status === 429 || error.message?.includes("429") || error.message?.includes("quota")) {
      console.log("Quota error detected");
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
      console.error("Sending error response to client");
      res.status(500).send({ 
        error: "Failed to generate avatar response",
        errorMessage: error.message,
        messages: [{
          text: "I'm sorry, there was an error processing your request. Please try again.",
          facialExpression: "sad",
          animation: "SadIdle"
        }]
      });
    }
  }
});

// Document upload and processing endpoint
app.post("/api/documents/upload", upload.single('file'), async (req, res) => {
  let filePath = null;
  
  try {
    if (!req.file) {
      console.error("No file in request");
      return res.status(400).send({ error: "No file uploaded. Please select a file." });
    }

    filePath = req.file.path;
    console.log("=== Document Upload Received ===");
    console.log("File:", req.file.originalname);
    console.log("Size:", req.file.size, "bytes");
    console.log("Type:", req.file.mimetype);
    console.log("Temp path from multer:", filePath);
    console.log("File exists check:", fs.existsSync(filePath));

    // Verify file exists before processing
    if (!fs.existsSync(filePath)) {
      console.error("File does not exist at path:", filePath);
      throw new Error(`Uploaded file not found at path: ${filePath}`);
    }

    const fileName = req.file.originalname;
    const fileExt = extname(fileName).toLowerCase();
    console.log("File extension:", fileExt);

    // Read file content based on type
    let documentText = "";
    
    if (fileExt === '.txt') {
      console.log("Processing TXT file...");
      documentText = fs.readFileSync(filePath, 'utf8');
      console.log(`Extracted ${documentText.length} characters from TXT`);
    } else if (fileExt === '.pdf') {
      console.log("Processing PDF file...");
      try {
        // Read file as buffer first - ensure we have the file content
        console.log("Reading PDF file buffer from:", filePath);
        const pdfBuffer = fs.readFileSync(filePath);
        console.log(`PDF buffer size: ${pdfBuffer.length} bytes`);
        
        if (pdfBuffer.length === 0) {
          throw new Error("PDF file is empty or could not be read");
        }
        
        // Get pdf-parse function (lazy import)
        console.log("Getting pdf-parse function...");
        const pdfParse = await getPdfParse();
        
        console.log("Parsing PDF buffer...");
        const pdfData = await pdfParse(pdfBuffer);
        documentText = pdfData.text || "";
        console.log(`Extracted ${documentText.length} characters from PDF`);
      } catch (pdfError) {
        console.error("PDF parsing error:", pdfError.message);
        console.error("PDF error stack:", pdfError.stack);
        console.error("File path used:", filePath);
        throw new Error(`Failed to parse PDF: ${pdfError.message}`);
      }
    } else if (fileExt === '.docx') {
      console.log("Processing DOCX file...");
      try {
        // Verify file exists before passing to mammoth
        if (!fs.existsSync(filePath)) {
          throw new Error(`File not found: ${filePath}`);
        }
        
        const mammoth = await import('mammoth');
        console.log("Extracting text from DOCX using path:", filePath);
        const result = await mammoth.extractRawText({ path: filePath });
        documentText = result.value || "";
        console.log(`Extracted ${documentText.length} characters from DOCX`);
      } catch (docxError) {
        console.error("DOCX parsing error:", docxError.message);
        console.error("DOCX error stack:", docxError.stack);
        console.error("File path used:", filePath);
        throw new Error(`Failed to parse DOCX: ${docxError.message}`);
      }
    } else if (fileExt === '.doc') {
      throw new Error('DOC files are not supported. Please convert to DOCX or PDF format.');
    } else {
      throw new Error(`Unsupported file type: ${fileExt}`);
    }
    
    if (!documentText || documentText.trim() === '') {
      throw new Error('Could not extract text from the document. The file may be empty or corrupted.');
    }

    // Use Gemini to process and summarize the document
    console.log("Initializing Gemini API...");
    const { GoogleGenerativeAI } = await import("@google/generative-ai");
    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || "");
    const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });

    // Limit document text to avoid token limits (keep first 50000 characters)
    const truncatedText = documentText.length > 50000 
      ? documentText.substring(0, 50000) + "\n\n[Document truncated due to length...]"
      : documentText;

    const prompt = `Please analyze and summarize the following document. Provide a comprehensive summary that includes:
1. Main topic and purpose
2. Key points and important information
3. Any notable details or insights
4. Important conclusions or recommendations (if any)

Document name: ${fileName}
Document content:
${truncatedText}

Please provide a clear, well-structured summary in 2-4 paragraphs.`;

    console.log("Sending document to Gemini for processing...");
    console.log(`Document text length: ${truncatedText.length} characters`);
    const result = await model.generateContent(prompt);
    const response = await result.response;
    const summary = response.text();
    console.log("Document summary generated successfully");

    // Clean up uploaded file
    try {
      if (filePath && fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
        console.log("Temporary file cleaned up");
      }
    } catch (cleanupError) {
      console.warn("Error cleaning up file:", cleanupError.message);
    }

    console.log("Document processed successfully");

    res.send({
      filename: fileName,
      size: req.file.size,
      summary: summary,
      text: documentText.substring(0, 500) + (documentText.length > 500 ? '...' : '') // Preview
    });

  } catch (error) {
    console.error("=== ERROR in Document Upload ===");
    console.error("Error type:", error.constructor.name);
    console.error("Error message:", error.message);
    console.error("Error stack:", error.stack);
    console.error("Request file:", req.file ? {
      originalname: req.file.originalname,
      size: req.file.size,
      mimetype: req.file.mimetype
    } : "No file in request");

    // Handle multer errors specifically
    if (error instanceof multer.MulterError) {
      if (error.code === 'LIMIT_FILE_SIZE') {
        return res.status(400).send({ 
          error: "File too large",
          errorMessage: "Maximum file size is 10MB. Please upload a smaller file."
        });
      }
      return res.status(400).send({ 
        error: "Upload error",
        errorMessage: error.message 
      });
    }

    // Clean up file on error
    try {
      if (filePath && fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
        console.log("Temporary file cleaned up after error");
      }
    } catch (cleanupError) {
      console.warn("Error cleaning up file:", cleanupError.message);
    }

    // Send detailed error response
    const errorResponse = {
      error: "Failed to process document",
      errorMessage: error.message,
      errorType: error.constructor.name
    };

    // Include stack trace in development
    if (process.env.NODE_ENV !== 'production') {
      errorResponse.stack = error.stack;
    }

    res.status(500).send(errorResponse);
  }
});

// Error handler middleware for multer errors (must be after routes)
app.use((error, req, res, next) => {
  if (error instanceof multer.MulterError) {
    if (error.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).send({ 
        error: "File too large",
        errorMessage: "Maximum file size is 10MB. Please upload a smaller file."
      });
    }
    return res.status(400).send({ 
      error: "Upload error",
      errorMessage: error.message 
    });
  }
  if (error) {
    return res.status(400).send({ 
      error: "Upload error",
      errorMessage: error.message 
    });
  }
  next();
});

// Endpoint for generating chat summary
app.post("/summary", async (req, res) => {
  try {
    const { chatHistory } = req.body;
    
    console.log("=== Summary Request Received ===");
    console.log("Chat history length:", chatHistory ? chatHistory.length : 0);
    
    if (!chatHistory || !Array.isArray(chatHistory)) {
      return res.status(400).send({ error: "Invalid chat history provided" });
    }
    
    if (chatHistory.length === 0) {
      return res.send({ summary: "The conversation is empty." });
    }
    
    console.log("Received summary request with", chatHistory.length, "messages");
    
    // Generate summary using Gemini
    console.log("Generating summary...");
    const summary = await generateChatSummary(chatHistory);
    
    console.log("Summary generated successfully");
    res.send({ summary });
  } catch (error) {
    console.error("=== ERROR in Summary endpoint ===");
    console.error("Error:", error.message);
    res.status(500).send({ 
      error: "Failed to generate summary",
      errorMessage: error.message 
    });
  }
});

// New endpoint for generating retention tests
app.post("/retention-test/generate", async (req, res) => {
  try {
    const { chatHistory } = req.body;
    
    if (!chatHistory || !Array.isArray(chatHistory)) {
      return res.status(400).send({ error: "Invalid chat history provided" });
    }
    
    if (chatHistory.length === 0) {
      return res.status(400).send({ error: "Chat history is empty. Please have a conversation first." });
    }
    
    console.log("Received retention test request with", chatHistory.length, "messages");
    
    // Generate retention test using Gemini
    const test = await generateRetentionTest(chatHistory);
    
    res.send(test);
  } catch (error) {
    console.error("Error generating retention test:", error);
    res.status(500).send({ error: "Failed to generate retention test" });
  }
});

// New endpoint for generating personalized feedback
app.post("/retention-test/feedback", async (req, res) => {
  try {
    const { testResults, chatHistory } = req.body;
    
    if (!testResults || !chatHistory) {
      return res.status(400).send({ error: "Test results and chat history are required" });
    }
    
    console.log("Received feedback request for test results");
    
    // Generate personalized feedback using Gemini
    const feedback = await generatePersonalizedFeedback(testResults, chatHistory);
    
    res.send({ feedback });
  } catch (error) {
    console.error("Error generating personalized feedback:", error);
    res.status(500).send({ error: "Failed to generate personalized feedback" });
  }
});

app.listen(port, () => {
  console.log(`Jack are listening on port ${port}`);
  console.log("Yo...");
});