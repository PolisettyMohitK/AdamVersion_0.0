import { GoogleGenerativeAI } from "@google/generative-ai";
import { z } from "zod";
import dotenv from "dotenv";

dotenv.config();

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || "");

const template = `
You are an intelligent and expressive AI assistant with extensive knowledge across all subjects.
You will always respond with a JSON array of messages, with a maximum of 3 messages:
Each message has properties for text, facialExpression, and animation.
The different facial expressions are: smile, sad, angry, surprised, funnyFace, and default.
The different animations are: Idle, TalkingOne, TalkingThree, SadIdle, Defeated, Angry, Surprised, DismissingGesture and ThoughtfulHeadShake.

Adapt your expressions and tone based on the content of your response:
- Use "smile" for positive, friendly, or encouraging content
- Use "sad" for sympathetic, disappointed, or negative content
- Use "angry" for frustrated, upset, or critical content
- Use "surprised" for unexpected, shocking, or amazing content
- Use "funnyFace" for humorous, playful, or light-hearted content
- Use "default" for neutral, factual, or balanced content

Choose animations that match the emotional tone and content:
- "TalkingOne" for normal conversation
- "TalkingThree" for enthusiastic or energetic discussion
- "ThoughtfulHeadShake" for contemplative or analytical content
- "Surprised" for unexpected revelations
- "Angry" for strong disagreement or criticism
- "SadIdle" for empathetic or somber topics
- "DismissingGesture" for dismissive or skeptical responses

Respond in valid JSON format with the following structure:
{
  "messages": [
    {
      "text": "Text to be spoken by the AI",
      "facialExpression": "Facial expression to be used by the AI. Select from: smile, sad, angry, surprised, funnyFace, and default",
      "animation": "Animation to be used by the AI. Select from: Idle, TalkingOne, TalkingThree, SadIdle, 
          Defeated, Angry, Surprised, DismissingGesture, and ThoughtfulHeadShake."
    }
  ]
}

Return only valid JSON with plain text values, no markdown formatting or extra text.
`;

// Schema for parsing the response
const responseSchema = z.object({
  messages: z.array(
    z.object({
      text: z.string().describe("Text to be spoken by the AI"),
      facialExpression: z
        .string()
        .describe(
          "Facial expression to be used by the AI. Select from: smile, sad, angry, surprised, funnyFace, and default"
        ),
      animation: z
        .string()
        .describe(
          `Animation to be used by the AI. Select from: Idle, TalkingOne, TalkingThree, SadIdle, 
          Defeated, Angry, Surprised, DismissingGesture, and ThoughtfulHeadShake.`
        ),
    })
  )
});

// Function to generate images using Pollinations.AI (Free AI image generation)
function generateAIImage(prompt, seed = null) {
  // Pollinations.AI provides free AI-generated images based on prompts
  // Format: https://image.pollinations.ai/prompt/{prompt}?width=400&height=300&seed={seed}
  const encodedPrompt = encodeURIComponent(prompt);
  const seedParam = seed ? `&seed=${seed}` : '';
  const imageUrl = `https://image.pollinations.ai/prompt/${encodedPrompt}?width=400&height=300&nologo=true${seedParam}`;
  
  return {
    url: imageUrl,
    label: prompt,
    photographer: 'AI Generated',
    source: 'pollinations.ai',
    alt: prompt
  };
}

// Function to fetch images from Wikimedia Commons API (backup)
async function fetchWikimediaImages(searchQuery, count = 2) {
  try {
    const response = await fetch(
      `https://commons.wikimedia.org/w/api.php?action=query&format=json&generator=search&gsrnamespace=6&gsrsearch=${encodeURIComponent(searchQuery)}&gsrlimit=${count}&prop=imageinfo&iiprop=url|extmetadata&iiurlwidth=400`,
      {
        headers: {
          'User-Agent': 'DigitalHumanApp/1.0'
        }
      }
    );
    
    if (!response.ok) {
      throw new Error(`Wikimedia API error: ${response.status}`);
    }
    
    const data = await response.json();
    
    if (data.query && data.query.pages) {
      const pages = Object.values(data.query.pages);
      const images = [];
      
      for (const page of pages) {
        if (page.imageinfo && page.imageinfo[0]) {
          const imageInfo = page.imageinfo[0];
          images.push({
            url: imageInfo.thumburl || imageInfo.url,
            label: searchQuery,
            photographer: imageInfo.extmetadata?.Artist?.value || 'Wikimedia Commons',
            source: 'wikimedia',
            alt: page.title || searchQuery
          });
        }
      }
      
      if (images.length > 0) {
        console.log(`Found ${images.length} Wikimedia images for: ${searchQuery}`);
        return images;
      }
    }
    
    // No images found, return placeholder
    console.log(`No Wikimedia images found for: ${searchQuery}`);
    const timestamp = Date.now();
    return [{
      url: `https://picsum.photos/400/300?random=${timestamp}`,
      label: searchQuery,
      photographer: 'Placeholder',
      source: 'picsum'
    }];
  } catch (error) {
    console.error('Error fetching from Wikimedia:', error.message);
    // Fallback to placeholder
    const timestamp = Date.now();
    return [{
      url: `https://picsum.photos/400/300?random=${timestamp}`,
      label: searchQuery,
      photographer: 'Placeholder',
      source: 'picsum'
    }];
  }
}

// Function to fetch images from Pexels API (fallback)
async function fetchPexelsImages(searchQuery, count = 2) {
  const apiKey = process.env.PEXELS_API_KEY;
  
  // If no API key, return placeholder images with labels
  if (!apiKey || apiKey === 'YOUR_PEXELS_API_KEY_HERE') {
    console.log('Pexels API key not configured, using placeholder images');
    const timestamp = Date.now();
    return Array.from({ length: count }, (_, i) => ({
      url: `https://picsum.photos/400/300?random=${timestamp + i}`,
      label: searchQuery,
      photographer: 'Placeholder',
      source: 'picsum'
    }));
  }
  
  try {
    const response = await fetch(
      `https://api.pexels.com/v1/search?query=${encodeURIComponent(searchQuery)}&per_page=${count}&orientation=landscape`,
      {
        headers: {
          'Authorization': apiKey
        }
      }
    );
    
    if (!response.ok) {
      throw new Error(`Pexels API error: ${response.status}`);
    }
    
    const data = await response.json();
    
    if (data.photos && data.photos.length > 0) {
      return data.photos.map(photo => ({
        url: photo.src.medium, // 350x350 size
        label: searchQuery,
        photographer: photo.photographer,
        source: 'pexels',
        alt: photo.alt || searchQuery
      }));
    } else {
      // No images found, return placeholder
      console.log(`No Pexels images found for: ${searchQuery}`);
      const timestamp = Date.now();
      return [{
        url: `https://picsum.photos/400/300?random=${timestamp}`,
        label: searchQuery,
        photographer: 'Placeholder',
        source: 'picsum'
      }];
    }
  } catch (error) {
    console.error('Error fetching from Pexels:', error.message);
    // Fallback to placeholder
    const timestamp = Date.now();
    return [{
      url: `https://picsum.photos/400/300?random=${timestamp}`,
      label: searchQuery,
      photographer: 'Placeholder',
      source: 'picsum'
    }];
  }
}

// Function to extract keywords and generate image data with labels
async function generateImageUrls(question, responseText) {
  const text = (question + ' ' + responseText).toLowerCase();
  const images = [];
  
  // Common topic categories with keywords - improved matching
  const topicCategories = [
    { keywords: ['code', 'coding', 'programming', 'software', 'developer', 'computer', 'algorithm', 'function', 'variable', 'debug', 'javascript', 'python', 'java'], label: 'Programming & Code', imageUrl: 'https://picsum.photos/400/300?random=' },
    { keywords: ['nature', 'tree', 'forest', 'mountain', 'ocean', 'landscape', 'environment', 'wildlife', 'plants', 'natural'], label: 'Nature & Landscape', imageUrl: 'https://picsum.photos/400/300?random=' },
    { keywords: ['science', 'research', 'experiment', 'laboratory', 'chemistry', 'physics', 'biology', 'scientific'], label: 'Science & Research', imageUrl: 'https://picsum.photos/400/300?random=' },
    { keywords: ['business', 'finance', 'money', 'economy', 'marketing', 'startup', 'entrepreneur', 'corporate'], label: 'Business & Finance', imageUrl: 'https://picsum.photos/400/300?random=' },
    { keywords: ['art', 'painting', 'design', 'creative', 'artist', 'museum', 'drawing', 'artistic'], label: 'Art & Design', imageUrl: 'https://picsum.photos/400/300?random=' },
    { keywords: ['travel', 'vacation', 'tourism', 'destination', 'journey', 'adventure', 'trip', 'explore'], label: 'Travel & Adventure', imageUrl: 'https://picsum.photos/400/300?random=' },
    { keywords: ['food', 'cooking', 'recipe', 'restaurant', 'cuisine', 'meal', 'dish', 'dosa', 'idli', 'indian', 'breakfast', 'dinner'], label: 'Food & Cuisine', imageUrl: 'https://picsum.photos/400/300?random=' },
    { keywords: ['health', 'fitness', 'exercise', 'wellness', 'medical', 'yoga', 'workout', 'healthy'], label: 'Health & Fitness', imageUrl: 'https://picsum.photos/400/300?random=' },
    { keywords: ['technology', 'tech', 'innovation', 'digital', 'ai', 'robot', 'artificial intelligence', 'machine learning'], label: 'Technology & Innovation', imageUrl: 'https://picsum.photos/400/300?random=' },
    { keywords: ['education', 'learning', 'study', 'school', 'university', 'student', 'teaching', 'academic'], label: 'Education & Learning', imageUrl: 'https://picsum.photos/400/300?random=' },
    { keywords: ['music', 'song', 'instrument', 'concert', 'melody', 'audio', 'band', 'guitar', 'piano'], label: 'Music & Performance', imageUrl: 'https://picsum.photos/400/300?random=' },
    { keywords: ['space', 'astronomy', 'planet', 'star', 'galaxy', 'universe', 'cosmos', 'nasa', 'rocket'], label: 'Space & Astronomy', imageUrl: 'https://picsum.photos/400/300?random=' },
    { keywords: ['sports', 'game', 'football', 'basketball', 'cricket', 'athlete', 'competition', 'soccer'], label: 'Sports & Athletics', imageUrl: 'https://picsum.photos/400/300?random=' },
    { keywords: ['architecture', 'building', 'construction', 'design', 'structure', 'skyscraper'], label: 'Architecture & Buildings', imageUrl: 'https://picsum.photos/400/300?random=' },
    { keywords: ['animal', 'pet', 'dog', 'cat', 'bird', 'wildlife', 'zoo'], label: 'Animals & Wildlife', imageUrl: 'https://picsum.photos/400/300?random=' },
    { keywords: ['car', 'vehicle', 'automobile', 'transportation', 'driving'], label: 'Vehicles & Transportation', imageUrl: 'https://picsum.photos/400/300?random=' },
    { keywords: ['beach', 'sea', 'ocean', 'sand', 'wave', 'coast'], label: 'Beach & Ocean', imageUrl: 'https://picsum.photos/400/300?random=' },
    { keywords: ['city', 'urban', 'metropolitan', 'downtown', 'skyline'], label: 'City & Urban Life', imageUrl: 'https://picsum.photos/400/300?random=' },
  ];
  
  // Find matching topics
  const matchedCategories = [];
  for (const category of topicCategories) {
    const matchCount = category.keywords.filter(keyword => text.includes(keyword)).length;
    if (matchCount > 0) {
      matchedCategories.push({ category, matchCount });
    }
  }
  
  // Sort by match count (most relevant first)
  matchedCategories.sort((a, b) => b.matchCount - a.matchCount);
  
  // Generate image data from top matches using AI image generation
  if (matchedCategories.length > 0) {
    const images = [];
    
    // Get top 2 matches
    const topMatches = matchedCategories.slice(0, 2);
    
    for (let i = 0; i < topMatches.length; i++) {
      const match = topMatches[i];
      
      // Create a highly specific prompt based on the actual user question
      // This ensures images are directly relevant to what the user asked
      let imagePrompt = '';
      const label = match.category.label.toLowerCase();
      
      // Generate prompt based on the actual question for maximum relevance
      if (label.includes('programming') || label.includes('code') || label.includes('technology')) {
        // For tech/programming: use the question directly with tech context
        imagePrompt = `${question}, technical diagram, professional illustration, detailed visualization, high quality, educational`;
      } else if (label.includes('food')) {
        // For food: extract the food item from question
        imagePrompt = `${question}, professional food photography, detailed close-up, high quality, appetizing presentation`;
      } else if (label.includes('science')) {
        // For science: create detailed scientific visualization
        imagePrompt = `${question}, scientific diagram, detailed illustration, educational visualization, technical drawing, high quality`;
      } else if (label.includes('nature')) {
        imagePrompt = `${question}, nature photography, detailed view, high quality, professional`;
      } else if (label.includes('health') || label.includes('fitness')) {
        imagePrompt = `${question}, professional health illustration, clear diagram, educational, high quality`;
      } else if (label.includes('business')) {
        imagePrompt = `${question}, professional business illustration, clean design, high quality`;
      } else if (label.includes('education')) {
        imagePrompt = `${question}, educational diagram, clear illustration, teaching visual, high quality`;
      } else if (label.includes('art')) {
        imagePrompt = `${question}, artistic visualization, creative illustration, high quality`;
      } else if (label.includes('music')) {
        imagePrompt = `${question}, musical illustration, professional diagram, high quality`;
      } else if (label.includes('space')) {
        imagePrompt = `${question}, space visualization, scientific illustration, detailed diagram, high quality`;
      } else {
        // Generic: use the question directly for maximum relevance
        imagePrompt = `${question}, detailed illustration, professional diagram, educational visualization, high quality`;
      }
      
      // Generate AI image with unique seed for each
      const seed = Date.now() + i;
      const generatedImage = generateAIImage(imagePrompt, seed);
      
      images.push({
        url: generatedImage.url,
        label: match.category.label,
        relevance: match.matchCount,
        photographer: generatedImage.photographer,
        source: generatedImage.source,
        prompt: imagePrompt // Store the prompt for debugging
      });
    }
    
    console.log(`Generated ${images.length} AI images for "${question}"`); 
    console.log(`Prompts used: ${images.map(img => img.prompt).join(' | ')}`);
    return images;
  }
  
  // Fallback: If no specific topics found, generate generic AI image
  console.log(`No matched topics for "${question}", using generic AI image`);
  const genericPrompt = `${question}, educational illustration, professional quality, realistic`;
  const genericImage = generateAIImage(genericPrompt, Date.now());
  
  return [{
    url: genericImage.url,
    label: 'General Topic',
    relevance: 0,
    photographer: 'AI Generated',
    source: 'pollinations.ai',
    prompt: genericPrompt
  }];
}

async function generateAvatarResponse(question) {
  try {
    console.log("Processing question:", question);
    
    // Use the gemini 2.5 flash model as requested
    const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });
    
    const prompt = `${template}\n\nHuman: ${question}\nAI:`;
    console.log("Sending prompt to Gemini:", prompt.substring(0, 100) + "...");
    
    const result = await model.generateContent(prompt);
    const response = await result.response;
    const text = response.text();
    
    console.log("Raw Gemini response:", text.substring(0, 100) + "...");
    
    // Try to parse the JSON response
    try {
      const parsedResponse = JSON.parse(text);
      const validatedResponse = responseSchema.parse(parsedResponse);
      console.log("Successfully parsed and validated response");
      
      // Add image URLs to the response
      const responseText = validatedResponse.messages.map(m => m.text).join(' ');
      validatedResponse.images = await generateImageUrls(question, responseText);
      console.log("Generated images:", validatedResponse.images);
      
      return validatedResponse;
    } catch (parseError) {
      // If parsing fails, create a default response
      console.error("Error parsing Gemini response:", parseError);
      console.error("Raw response that failed to parse:", text);
      const defaultResponse = {
        messages: [
          {
            text: text || "Hello! I'm your AI assistant, ready to help with any topic you'd like to discuss.",
            facialExpression: "default",
            animation: "TalkingOne"
          }
        ]
      };
      defaultResponse.images = await generateImageUrls(question, text);
      return defaultResponse;
    }
  } catch (error) {
    console.error("Error generating response with Gemini:", error);
    
    // Handle quota exceeded error specifically
    if (error.status === 429) {
      // Return a quota exceeded message
      return {
        messages: [
          {
            text: "I'm experiencing high demand right now. Please try again in a few minutes as my quota has been temporarily reached.",
            facialExpression: "sad",
            animation: "SadIdle"
          },
          {
            text: "My AI resources are temporarily limited. Please check back soon for a full conversation!",
            facialExpression: "default",
            animation: "Idle"
          }
        ]
      };
    }
    
    // Return a default response in case of other errors
    return {
      messages: [
        {
          text: "Hello! I'm your AI assistant, ready to help with any topic you'd like to discuss.",
          facialExpression: "default",
          animation: "TalkingOne"
        }
      ]
    };
  }
}

// New function for generating chat summaries
async function generateChatSummary(chatHistory) {
  try {
    console.log("Generating summary for chat history...");
    
    // Use the gemini 2.5 flash model as requested
    const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });
    
    // Format the chat history for the prompt
    const formattedHistory = chatHistory.map(msg => {
      const sender = msg.sender === 'user' ? 'User' : msg.sender === 'ai' ? 'AI Assistant' : 'System';
      return `${sender}: ${msg.text}`;
    }).join('\n');
    
    const summaryTemplate = `
    You are an intelligent and expressive AI assistant. Your task is to create a concise, informative summary of the conversation between a user and an AI assistant.
    
    Please follow these guidelines:
    1. Provide a clear overview of the main topics discussed
    2. Highlight any important decisions, agreements, or conclusions reached
    3. Mention any questions asked and answers provided
    4. Keep the summary concise but comprehensive
    5. Use natural language and avoid technical jargon when possible
    
    Conversation History:
    ${formattedHistory}
    
    Please provide a summary of this conversation in a natural, readable format.
    `;
    
    console.log("Sending summary prompt to Gemini...");
    const result = await model.generateContent(summaryTemplate);
    const response = await result.response;
    const summaryText = response.text();
    
    console.log("Successfully generated chat summary");
    return summaryText;
  } catch (error) {
    console.error("Error generating chat summary:", error);
    throw error;
  }
}

// New function for generating retention tests
async function generateRetentionTest(chatHistory) {
  try {
    console.log("Generating retention test based on chat history...");
    
    // Use gemini-1.5-flash for higher quota (1500 requests/day vs 20 for 2.5-flash)
    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
    
    // Format the chat history for the prompt
    const formattedHistory = chatHistory.map(msg => {
      const sender = msg.sender === 'user' ? 'User' : msg.sender === 'ai' ? 'AI Assistant' : 'System';
      return `${sender}: ${msg.text}`;
    }).join('\n');
    
    const retentionTestTemplate = `
    You are an intelligent and knowledgeable educator who creates comprehensive retention tests. 
    Based on the conversation history provided below, create a test that assesses the user's understanding of the material discussed.
    
    Conversation History:
    ${formattedHistory}
    
    Please follow these guidelines:
    1. Create exactly 5 multiple-choice questions
    2. Each question should have 4 options (A, B, C, D)
    3. Clearly indicate the correct answer for each question
    4. Make the questions challenging but fair, covering different aspects of the topics discussed
    5. Include a mix of question types:
       - Factual recall questions
       - Conceptual understanding questions
       - Application-based questions
    6. Provide detailed explanations for each answer
    7. Format the response as valid JSON with the following structure:
    
    {
      "testTitle": "A descriptive title for the test based on the conversation topics",
      "questions": [
        {
          "id": 1,
          "question": "Question text here",
          "options": [
            {"id": "A", "text": "Option A text"},
            {"id": "B", "text": "Option B text"},
            {"id": "C", "text": "Option C text"},
            {"id": "D", "text": "Option D text"}
          ],
          "correctAnswer": "A",
          "explanation": "Detailed explanation of why the answer is correct and why other options are incorrect",
          "topic": "The main topic this question addresses"
        }
      ]
    }
    
    Generate a comprehensive retention test based on the conversation history following this format exactly.
    `;
    
    console.log("Sending retention test prompt to Gemini...");
    const result = await model.generateContent(retentionTestTemplate);
    const response = await result.response;
    const testText = response.text();
    
    console.log("Raw Gemini retention test response:", testText.substring(0, 100) + "...");
    
    // Try to parse the JSON response
    try {
      // Extract JSON from potential markdown code blocks
      let cleanTestText = testText.trim();
      if (cleanTestText.startsWith("```json")) {
        cleanTestText = cleanTestText.substring(7);
      }
      if (cleanTestText.endsWith("```")) {
        cleanTestText = cleanTestText.substring(0, cleanTestText.length - 3);
      }
      
      const parsedTest = JSON.parse(cleanTestText);
      console.log("Successfully parsed and validated retention test");
      return parsedTest;
    } catch (parseError) {
      console.error("Error parsing retention test response:", parseError);
      console.error("Raw response that failed to parse:", testText);
      // Return a default test structure
      return {
        testTitle: "General Knowledge Test",
        questions: []
      };
    }
  } catch (error) {
    console.error("Error generating retention test:", error);
    throw error;
  }
}

// New function for generating personalized feedback
async function generatePersonalizedFeedback(testResults, chatHistory) {
  try {
    console.log("Generating personalized feedback based on test results...");
    
    // Use gemini-1.5-flash for higher quota
    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
    
    // Format the chat history for the prompt
    const formattedHistory = chatHistory.map(msg => {
      const sender = msg.sender === 'user' ? 'User' : msg.sender === 'ai' ? 'AI Assistant' : 'System';
      return `${sender}: ${msg.text}`;
    }).join('\n');
    
    const feedbackTemplate = `
    You are an intelligent and supportive educator who provides personalized feedback on test performance. 
    Based on the test results and conversation history provided below, give constructive feedback and specific improvement suggestions.
    
    Conversation History:
    ${formattedHistory}
    
    Test Results:
    ${JSON.stringify(testResults, null, 2)}
    
    Please provide:
    1. Overall performance assessment with a score percentage
    2. Specific areas of strength demonstrated by correct answers
    3. Detailed analysis of mistakes and misconceptions revealed by incorrect answers
    4. Personalized suggestions on how to improve in weak areas
    5. Study techniques and strategies tailored to the user's learning patterns
    6. Additional resources or topics to explore for deeper understanding
    7. Encouraging closing remarks that motivate continued learning
    
    Format your response in a natural, conversational way that would be suitable for speech by an AI avatar.
    Be specific and actionable in your suggestions, referencing the actual topics discussed in the conversation.
    `;
    
    console.log("Sending feedback prompt to Gemini...");
    const result = await model.generateContent(feedbackTemplate);
    const response = await result.response;
    const feedbackText = response.text();
    
    console.log("Successfully generated personalized feedback");
    return feedbackText;
  } catch (error) {
    console.error("Error generating personalized feedback:", error);
    throw error;
  }
}

export { generateAvatarResponse, generateChatSummary, generateRetentionTest, generatePersonalizedFeedback };