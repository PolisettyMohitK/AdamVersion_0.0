import { GoogleGenerativeAI } from "@google/generative-ai";
import { z } from "zod";
import dotenv from "dotenv";

dotenv.config();

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || "");

const template = `
You are a friendly, conversational AI assistant who talks like a real person. You have extensive knowledge but you explain things in a natural, easy-going way - like you're chatting with a friend.

IMPORTANT STYLE GUIDELINES:
- Write like you're speaking out loud - use natural, conversational language
- Use contractions (I'm, you're, it's, that's) to sound more human
- Keep sentences shorter and more digestible when spoken
- Avoid overly formal or academic language - be friendly and approachable
- Use everyday words instead of complex vocabulary when possible
- Make it flow naturally - like you're having a real conversation
- Don't sound like you're reading from a textbook or giving a formal presentation
- Be warm, engaging, and personable

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
      "text": "Text to be spoken by the AI - written in natural, conversational language",
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

// Function to fetch images from Wikimedia Commons API (enhanced version for maximum relevance)
async function fetchWikimediaImages(searchQuery, count = 3) {
  try {
    // Enhanced search with better query parameters for more relevant results
    // Use more specific search parameters to get exactly relevant images
    const encodedQuery = encodeURIComponent(searchQuery);
    // Added more specific search parameters for better relevance
    const apiUrl = `https://commons.wikimedia.org/w/api.php?action=query&format=json&generator=search&gsrnamespace=6&gsrsearch=${encodedQuery}&gsrlimit=${count * 2}&prop=imageinfo&iiprop=url|extmetadata|canonicaltitle&iiurlwidth=400&gsrinfo=totalhits`;
    
    console.log(`Fetching images from Wikimedia for query: "${searchQuery}"`);
    
    const response = await fetch(apiUrl, {
      headers: {
        'User-Agent': 'DigitalHumanApp/1.0 (Educational AI Avatar - Highly Relevant Image Search)'
      }
    });
    
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
          
          // Extract cleaner title without File: prefix
          let cleanTitle = page.title.replace(/^File:/, '');
          if (imageInfo.extmetadata && imageInfo.extmetadata.ObjectName) {
            cleanTitle = imageInfo.extmetadata.ObjectName.value;
          }
          
          // Only include images that seem relevant to our search query
          const lowerCleanTitle = cleanTitle.toLowerCase();
          const lowerSearchQuery = searchQuery.toLowerCase();
          
          // Enhanced relevance checking:
          // 1. Exact match or containment
          const hasExactMatch = lowerCleanTitle.includes(lowerSearchQuery) || lowerSearchQuery.includes(lowerCleanTitle);
          
          // 2. Significant word overlap (at least 50% of search query words found in title)
          const searchWords = searchQuery.split(/\s+/).filter(word => word.length > 2);
          const matchingWords = searchWords.filter(word => 
            lowerCleanTitle.includes(word.toLowerCase())
          );
          const hasSignificantOverlap = matchingWords.length >= Math.ceil(searchWords.length * 0.5);
          
          // 3. Check for common educational terms that indicate relevance
          const educationalTerms = ['diagram', 'chart', 'graph', 'illustration', 'schema', 'map', 'photo', 'drawing', 'artwork'];
          const hasEducationalTerm = educationalTerms.some(term => lowerCleanTitle.includes(term));
          
          // Include image if it meets any of our relevance criteria
          if (hasExactMatch || hasSignificantOverlap || hasEducationalTerm) {
            images.push({
              url: imageInfo.thumburl || imageInfo.url,
              label: `Direct match for: ${searchQuery}`,
              photographer: imageInfo.extmetadata?.Artist?.value || 'Wikimedia Commons',
              source: 'wikimedia',
              alt: cleanTitle || searchQuery
            });
          }
        }
      }
      
      // Sort images by relevance (exact matches first)
      images.sort((a, b) => {
        const aTitle = a.alt.toLowerCase();
        const bTitle = b.alt.toLowerCase();
        const searchQueryLower = searchQuery.toLowerCase();
        
        // Exact matches first
        const aExact = aTitle === searchQueryLower ? 0 : 1;
        const bExact = bTitle === searchQueryLower ? 0 : 1;
        if (aExact !== bExact) return aExact - bExact;
        
        // Then partial matches with more words matching
        const aWords = searchQuery.split(/\s+/).filter(word => word.length > 2);
        const bWords = searchQuery.split(/\s+/).filter(word => word.length > 2);
        
        const aMatches = aWords.filter(word => aTitle.includes(word.toLowerCase())).length;
        const bMatches = bWords.filter(word => bTitle.includes(word.toLowerCase())).length;
        
        return bMatches - aMatches; // Descending order
      });
      
      // Limit to requested count
      const limitedImages = images.slice(0, count);
      
      if (limitedImages.length > 0) {
        console.log(`Found ${limitedImages.length} exactly relevant Wikimedia images for: "${searchQuery}"`);
        return limitedImages;
      }
    }
    
    // No images found, return placeholder
    console.log(`No relevant Wikimedia images found for: "${searchQuery}"`);
    const timestamp = Date.now();
    return [{
      url: `https://picsum.photos/400/300?random=${timestamp}`,
      label: `Topic illustration: ${searchQuery}`,
      photographer: 'Placeholder',
      source: 'picsum'
    }];
  } catch (error) {
    console.error('Error fetching from Wikimedia:', error.message);
    // Fallback to placeholder
    const timestamp = Date.now();
    return [{
      url: `https://picsum.photos/400/300?random=${timestamp}`,
      label: `Subject: ${searchQuery}`,
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

// Enhanced function to extract keywords and generate exactly relevant image data with labels
async function generateImageUrls(question, responseText) {
  // Extract the core subject from the question with maximum precision
  const coreSubject = extractCoreSubject(question);
  
  console.log(`🔍 Searching for exactly relevant images for core subject: "${coreSubject}"`);
  
  // Enhanced approach: Focus primarily on the core subject for maximum relevance
  let searchTerms = coreSubject;
  
  // Only use response text analysis if it provides more specific terms
  if (responseText && responseText.length > 0) {
    // Extract key concepts from both question and response
    const combinedText = `${question} ${responseText}`;
    
    // Try to identify specific technical terms, names, or concepts
    const technicalTerms = extractTechnicalTerms(combinedText);
    if (technicalTerms.length > 0) {
      // Check if any technical term is more specific than the core subject
      const moreSpecificTerm = technicalTerms.find(term => 
        term.length > coreSubject.length && 
        term.toLowerCase().includes(coreSubject.toLowerCase())
      );
      
      if (moreSpecificTerm) {
        searchTerms = moreSpecificTerm;
      }
    } else {
      // Fallback to entity extraction
      const entities = extractNamedEntities(combinedText);
      if (entities.length > 0) {
        // Check if any entity is more specific than the core subject
        const moreSpecificEntity = entities.find(entity => 
          entity.length > coreSubject.length && 
          entity.toLowerCase().includes(coreSubject.toLowerCase())
        );
        
        if (moreSpecificEntity) {
          searchTerms = moreSpecificEntity;
        }
      }
    }
  }
  
  // Ensure search terms are meaningful and relevant
  if (searchTerms.length < 3 || searchTerms.split(/\s+/).length < 1) {
    searchTerms = coreSubject;
  }
  
  console.log(`🎯 Using maximally relevant search terms: "${searchTerms}"`);
  
  // Try multiple image sources in order of preference for exactly relevant images
  try {
    // First, try Wikimedia Commons (most reliable for educational content)
    console.log(`🖼️  Attempting to fetch from Wikimedia Commons...`);
    const wikimediaImages = await fetchWikimediaImages(searchTerms, 3); // Increased to 3 images for better selection
    
    if (wikimediaImages && wikimediaImages.length > 0) {
      // Process Wikimedia images with maximally relevant labels
      const processedImages = wikimediaImages.map((image, index) => {
        const relevanceLabel = index === 0 
          ? `🎯 Exact match for: "${searchTerms}"`
          : index === 1
          ? `📚 Directly related to: "${searchTerms}"`
          : `📖 Contextually relevant to: "${searchTerms}"`;
          
        return {
          url: image.url,
          label: relevanceLabel,
          photographer: image.photographer || 'Wikimedia Commons',
          source: image.source || 'wikimedia',
          alt: `${searchTerms} - ${image.alt || 'educational illustration'}`
        };
      });
      
      console.log(`✅ Successfully found ${processedImages.length} maximally relevant Wikimedia images for: "${searchTerms}"`);
      return processedImages;
    }
  } catch (wikimediaError) {
    console.warn("⚠️  Wikimedia search failed, trying alternative sources:", wikimediaError.message);
  }
  
  // Fallback to Pexels if available
  try {
    console.log(`📸 Attempting to fetch from Pexels...`);
    const pexelsImages = await fetchPexelsImages(searchTerms, 3); // Increased to 3 images for better selection
    
    if (pexelsImages && pexelsImages.length > 0) {
      // Process Pexels images with maximally relevant labels
      const processedImages = pexelsImages.map((image, index) => {
        const relevanceLabel = index === 0 
          ? `🎯 Primary visualization of: "${searchTerms}"`
          : index === 1
          ? `📚 Supporting image for: "${searchTerms}"`
          : `📖 Illustrative example of: "${searchTerms}"`;
          
        return {
          url: image.url,
          label: relevanceLabel,
          photographer: image.photographer || 'Pexels Photographer',
          source: image.source || 'pexels',
          alt: `${searchTerms} - ${image.alt || 'relevant stock photo'}`
        };
      });
      
      console.log(`✅ Successfully found ${processedImages.length} maximally relevant Pexels images for: "${searchTerms}"`);
      return processedImages;
    }
  } catch (pexelsError) {
    console.warn("⚠️  Pexels search failed, falling back to placeholders:", pexelsError.message);
  }
  
  // Final fallback to descriptive placeholders with stronger relevance indicators
  console.log(`📄 Creating maximally descriptive placeholder images for: "${searchTerms}"`);
  const timestamp = Date.now();
  return [
    {
      url: `https://picsum.photos/400/300?random=${timestamp}`,
      label: `📘 Educational visualization: "${searchTerms}"`,
      photographer: 'AI-Generated Placeholder',
      source: 'placeholder',
      alt: `Conceptual representation specifically for ${searchTerms}`
    },
    {
      url: `https://picsum.photos/400/300?random=${timestamp + 1}`,
      label: `📙 Learning aid: "${searchTerms}"`,
      photographer: 'AI-Generated Placeholder',
      source: 'placeholder',
      alt: `Visual support specifically for ${searchTerms}`
    },
    {
      url: `https://picsum.photos/400/300?random=${timestamp + 2}`,
      label: `📓 Instructional diagram: "${searchTerms}"`,
      photographer: 'AI-Generated Placeholder',
      source: 'placeholder',
      alt: `Illustrative content specifically for ${searchTerms}`
    }
  ];
}

// Helper function to extract technical terms from text
function extractTechnicalTerms(text) {
  // Patterns for different types of technical terms
  const patterns = [
    // Scientific terms (e.g., "photosynthesis", "DNA replication")
    /\b([A-Z][a-z]+(?:\s+[a-z]+){1,3})\b/g,
    // Acronyms and abbreviations (e.g., "AI", "DNA", "HTTP")
    /\b([A-Z]{2,6})\b/g,
    // Technical phrases with hyphens (e.g., "machine-learning", "block-chain")
    /\b([a-z]+-[a-z]+(?:-[a-z]+)*)\b/g
  ];
  
  const terms = new Set();
  
  patterns.forEach(pattern => {
    const matches = text.match(pattern);
    if (matches) {
      matches.forEach(match => {
        // Filter out common words and ensure minimum relevance
        const cleaned = match.trim().toLowerCase();
        if (cleaned.length > 3 && !isCommonWord(cleaned)) {
          terms.add(match.trim());
        }
      });
    }
  });
  
  // Convert to array and sort by specificity (longer terms first)
  return Array.from(terms)
    .sort((a, b) => b.length - a.length)
    .slice(0, 3); // Return top 3 terms
}

// Helper function to extract named entities from text
function extractNamedEntities(text) {
  // Pattern for proper nouns (likely names of people, places, organizations)
  const properNounPattern = /\b([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)\b/g;
  const matches = text.match(properNounPattern);
  
  if (!matches) return [];
  
  // Filter for likely entities (more than one word, not common words)
  const entities = matches.filter(entity => {
    const words = entity.split(/\s+/);
    return words.length >= 2 && words.every(word => word.length > 2) && !isCommonWord(entity.toLowerCase());
  });
  
  // Also include single-word proper nouns that are likely names (capitalized and longer than 3 chars)
  const singleWordEntities = matches.filter(entity => {
    return entity.length > 3 && /^[A-Z]/.test(entity) && !isCommonWord(entity.toLowerCase());
  });
  
  // Combine and deduplicate
  const allEntities = [...entities, ...singleWordEntities];
  return [...new Set(allEntities)].slice(0, 3); // Return unique entities, max 3
}

// Helper function to check if a word is common and should be filtered out
function isCommonWord(word) {
  const commonWords = new Set([
    'the', 'and', 'for', 'are', 'but', 'not', 'you', 'all', 'can', 'had', 'her', 'was', 'one', 'our', 'out', 'day', 'get', 'has', 'him', 'his', 'how', 'its', 'may', 'new', 'now', 'old', 'see', 'two', 'who', 'boy', 'did', 'man', 'men', 'put', 'too', 'use', 'any', 'big', 'end', 'far', 'got', 'job', 'law', 'let', 'lot', 'low', 'may', 'nor', 'off', 'old', 'pro', 'run', 'say', 'set', 'she', 'sit', 'six', 'top', 'try', 'up', 'way', 'win', 'yes', 'yet', 'bit', 'eat', 'fix', 'fly', 'hit', 'ill', 'lay', 'led', 'lie', 'log', 'met', 'own', 'pay', 'per', 'pop', 'ran', 'rid', 'sat', 'sun', 'war', 'why', 'wit', 'wet', 'ask', 'buy', 'cut', 'die', 'eat', 'fit', 'get', 'hit', 'lie', 'mix', 'owe', 'put', 'rid', 'run', 'say', 'see', 'set', 'sit', 'tie', 'win', 'yes', 'add', 'age', 'ago', 'aid', 'aim', 'air', 'ale', 'all', 'amp', 'and', 'ant', 'any', 'ape', 'app', 'apt', 'arc', 'are', 'ark', 'arm', 'art', 'ash', 'ate', 'awe', 'axe', 'bad', 'bat', 'bay', 'bed', 'bee', 'beg', 'bet', 'bid', 'big', 'bit', 'bob', 'bot', 'bow', 'box', 'boy', 'bus', 'but', 'buy', 'bye', 'cab', 'cam', 'can', 'cap', 'car', 'cat', 'cop', 'cow', 'cry', 'cup', 'cut', 'dam', 'day', 'den', 'dew', 'did', 'die', 'dig', 'dim', 'din', 'dip', 'dog', 'dot', 'dry', 'dug', 'dye', 'ear', 'eat', 'eel', 'egg', 'ego', 'elf', 'elm', 'emu', 'end', 'era', 'eve', 'eye', 'fan', 'far', 'fat', 'fax', 'fed', 'fee', 'fen', 'few', 'fig', 'fin', 'fir', 'fit', 'fix', 'flu', 'fly', 'foe', 'fog', 'fox', 'fry', 'fun', 'fur', 'gag', 'gap', 'gas', 'gel', 'gem', 'get', 'gig', 'gin', 'god', 'got', 'gum', 'gun', 'gut', 'guy', 'gym', 'had', 'ham', 'has', 'hat', 'hay', 'hem', 'hen', 'her', 'hid', 'him', 'hip', 'his', 'hit', 'hog', 'hop', 'hot', 'how', 'hub', 'hue', 'hug', 'hut', 'ice', 'icy', 'ill', 'ink', 'inn', 'ion', 'ire', 'irk', 'ivy', 'jab', 'jam', 'jar', 'jaw', 'jet', 'job', 'jog', 'joy', 'jug', 'key', 'kid', 'kin', 'kit', 'lab', 'lad', 'lag', 'lap', 'law', 'lay', 'led', 'leg', 'let', 'lid', 'lie', 'lip', 'lit', 'log', 'lot', 'low', 'lug', 'mad', 'man', 'map', 'mat', 'may', 'men', 'met', 'mid', 'mix', 'mob', 'mop', 'mow', 'mud', 'mug', 'nag', 'nap', 'net', 'new', 'nil', 'nip', 'nod', 'nor', 'not', 'now', 'nut', 'oak', 'odd', 'off', 'oil', 'old', 'one', 'opt', 'orb', 'ore', 'our', 'out', 'owl', 'own', 'pad', 'pan', 'par', 'pat', 'paw', 'pay', 'pea', 'peg', 'pen', 'pet', 'pie', 'pig', 'pin', 'pit', 'ply', 'pod', 'pot', 'pro', 'pub', 'pun', 'put', 'rag', 'rat', 'raw', 'ray', 'red', 'rib', 'rim', 'rip', 'rob', 'rod', 'rot', 'row', 'rub', 'rug', 'rum', 'run', 'rut', 'rye', 'sad', 'sat', 'saw', 'say', 'sea', 'sec', 'see', 'set', 'sew', 'sex', 'she', 'shy', 'sic', 'sim', 'sin', 'sip', 'sit', 'six', 'ski', 'sky', 'sly', 'sob', 'son', 'soy', 'spa', 'spy', 'sum', 'sun', 'tab', 'tag', 'tan', 'tap', 'tar', 'tax', 'tea', 'ted', 'tee', 'ten', 'the', 'thy', 'tic', 'tie', 'tin', 'tip', 'toe', 'ton', 'too', 'top', 'toy', 'try', 'tub', 'tug', 'two', 'use', 'van', 'vat', 'vet', 'vow', 'war', 'was', 'wax', 'way', 'web', 'wed', 'wee', 'wet', 'who', 'why', 'wig', 'win', 'wis', 'wit', 'woe', 'won', 'woo', 'wow', 'yes', 'yet', 'zip', 'zone', 'zoom', 'what', 'explain', 'tell', 'describe', 'how', 'does', 'do', 'can', 'please', 'define', 'give', 'information', 'want', 'know', 'learn', 'show', 'display', 'illustrate', 'demonstrate', 'about', 'of', 'in', 'on', 'at', 'to', 'from', 'by', 'with', 'without', 'through', 'during', 'before', 'after', 'above', 'below', 'between', 'among', 'is', 'are', 'was', 'were', 'be', 'been', 'have', 'has', 'had', 'will', 'would', 'could', 'should', 'may', 'might', 'must', 'shall', 'this', 'that', 'these', 'those', 'my', 'your', 'his', 'her', 'its', 'our', 'their', 'mine', 'yours', 'hers', 'ours', 'theirs', 'which', 'who', 'whom', 'whose', 'where', 'when', 'why', 'how', 'if', 'unless', 'although', 'though', 'because', 'since', 'so', 'than', 'as', 'like', 'such', 'same', 'different', 'other', 'another', 'much', 'many', 'few', 'little', 'more', 'less', 'most', 'least', 'very', 'quite', 'rather', 'fairly', 'extremely', 'incredibly', 'really', 'truly', 'actually', 'literally', 'figuratively', 'basically', 'essentially', 'fundamentally', 'primarily', 'secondarily', 'additionally', 'furthermore', 'moreover', 'however', 'nevertheless', 'nonetheless', 'therefore', 'consequently', 'thus', 'hence', 'accordingly', 'meanwhile', 'subsequently', 'eventually', 'finally', 'initially', 'originally', 'eventually', 'ultimately', 'eventually', 'meanwhile', 'simultaneously', 'alternatively', 'likewise', 'similarly', 'conversely', 'otherwise', 'instead', 'regardless', 'nevertheless', 'nonetheless', 'notwithstanding', 'despite', 'in spite of', 'due to', 'owing to', 'thanks to', 'because of', 'as a result of', 'as a consequence of', 'on account of', 'on behalf of', 'for the sake of', 'in favor of', 'against', 'toward', 'towards', 'into', 'onto', 'upon', 'over', 'under', 'beneath', 'beside', 'between', 'among', 'throughout', 'inside', 'outside', 'within', 'beyond', 'near', 'next to', 'close to', 'far from', 'away from', 'along', 'across', 'around', 'about', 'round', 'up', 'down', 'back', 'forth', 'forward', 'backward', 'sideways', 'straight', 'directly', 'indirectly', 'immediately', 'directly', 'eventually', 'gradually', 'suddenly', 'quickly', 'slowly', 'carefully', 'carelessly', 'deliberately', 'accidentally', 'intentionally', 'unintentionally', 'purposely', 'purposefully', 'consciously', 'unconsciously', 'automatically', 'manually', 'mechanically', 'electronically', 'digitally', 'analogously', 'physically', 'mentally', 'emotionally', 'intellectually', 'spiritually', 'morally', 'ethically', 'legally', 'illegally', 'formally', 'informally', 'officially', 'unofficially', 'publicly', 'privately', 'personally', 'impersonally', 'subjectively', 'objectively', 'relatively', 'absolutely', 'completely', 'partially', 'entirely', 'fully', 'totally', 'wholly', 'altogether', 'entirely', 'comprehensively', 'thoroughly', 'extensively', 'broadly', 'widely', 'narrowly', 'specifically', 'particularly', 'especially', 'notably', 'significantly', 'remarkably', 'considerably', 'substantially', 'materially', 'noticeably', 'appreciably', 'perceptibly', 'visibly', 'obviously', 'clearly', 'plainly', 'distinctly', 'definitely', 'certainly', 'undoubtedly', 'unquestionably', 'indisputably', 'incontestably', 'unarguably', 'uncontroversially', 'unambiguously', 'unequivocally', 'explicitly', 'expressly', 'specifically', 'particularly', 'precisely', 'exactly', 'accurately', 'correctly', 'properly', 'appropriately', 'suitably', 'adequately', 'sufficiently', 'enough', 'plenty', 'abundantly', 'amply', 'liberally', 'generously', 'lavishly', 'extravagantly', 'excessively', 'overly', 'unduly', 'excessively', 'unnecessarily', 'needlessly', 'pointlessly', 'uselessly', 'fruitlessly', 'vainly', 'in vain', 'to no avail', 'in effect', 'in fact', 'in reality', 'in truth', 'in actuality', 'in practice', 'in theory', 'hypothetically', 'theoretically', 'practically', 'virtually', 'almost', 'nearly', 'approximately', 'roughly', 'about', 'around', 'circa', 'somewhere', 'somehow', 'somewhat', 'some', 'any', 'every', 'each', 'either', 'neither', 'both', 'all', 'none', 'no', 'not', 'nothing', 'nobody', 'no one', 'nowhere', 'never', 'ever', 'always', 'usually', 'normally', 'typically', 'generally', 'commonly', 'frequently', 'often', 'regularly', 'periodically', 'occasionally', 'sometimes', 'rarely', 'seldom', 'hardly', 'scarcely', 'barely', 'merely', 'just', 'only', 'solely', 'exclusively', 'uniquely', 'singularly', 'particularly', 'especially', 'particularly', 'notably', 'remarkably', 'significantly', 'considerably', 'substantially', 'materially', 'noticeably', 'appreciably', 'perceptibly', 'visibly', 'obviously', 'clearly', 'plainly', 'distinctly', 'definitely', 'certainly', 'undoubtedly', 'unquestionably', 'indisputably', 'incontestably', 'unarguably', 'uncontroversially', 'unambiguously', 'unequivocally', 'explicitly', 'expressly', 'specifically', 'particularly', 'precisely', 'exactly', 'accurately', 'correctly', 'properly', 'appropriately', 'suitably', 'adequately', 'sufficiently', 'enough', 'plenty', 'abundantly', 'amply', 'liberally', 'generously', 'lavishly', 'extravagantly', 'excessively', 'overly', 'unduly', 'excessively', 'unnecessarily', 'needlessly', 'pointlessly', 'uselessly', 'fruitlessly', 'vainly', 'in vain', 'to no avail', 'in effect', 'in fact', 'in reality', 'in truth', 'in actuality', 'in practice', 'in theory', 'hypothetically', 'theoretically', 'practically', 'virtually', 'almost', 'nearly', 'approximately', 'roughly', 'about', 'around', 'circa', 'somewhere', 'somehow', 'somewhat'
  ]);
  
  return commonWords.has(word.toLowerCase());
}

// Enhanced helper function to extract the exact core subject from a question with maximum precision
function extractCoreSubject(question) {
  // Clean and normalize the question
  let cleanQuestion = question.trim();
  
  // Remove common question prefixes more aggressively
  const prefixesToRemove = [
    'what is', 'what are', 'explain', 'tell me about', 'describe', 
    'how does', 'how do', 'can you explain', 'please explain',
    'what is the', 'what are the', 'define', 'give me information about',
    'i want to know about', 'i would like to learn about',
    'show me', 'display', 'illustrate', 'demonstrate', 'tell me',
    'can you tell me about', 'could you explain', 'would you mind explaining'
  ];
  
  // Sort prefixes by length (descending) to remove longer ones first
  prefixesToRemove.sort((a, b) => b.length - a.length);
  
  for (const prefix of prefixesToRemove) {
    if (cleanQuestion.toLowerCase().startsWith(prefix)) {
      cleanQuestion = cleanQuestion.substring(prefix.length).trim();
      break;
    }
  }
  
  // Remove trailing punctuation and whitespace
  cleanQuestion = cleanQuestion.replace(/[?!.]+$/, '').trim();
  
  // Handle "how to X" patterns first (e.g., "how to bake bread" -> "baking")
  if (cleanQuestion.toLowerCase().startsWith('how to ')) {
    const action = cleanQuestion.substring(7).trim(); // Remove "how to "
    
    // For multi-word actions, we want the whole phrase, not just verb conversion
    // Check if it's a simple single verb we know how to convert
    const words = action.split(/\s+/);
    if (words.length === 1) {
      // Single word action - apply conversion rules
      const actionMap = {
        'bake': 'baking',
        'cook': 'cooking',
        'write': 'writing',
        'read': 'reading',
        'run': 'running',
        'swim': 'swimming',
        'dance': 'dancing',
        'sing': 'singing',
        'draw': 'drawing',
        'paint': 'painting',
        'build': 'building',
        'create': 'creating',
        'make': 'making',
        'fix': 'fixing',
        'repair': 'repairing',
        'learn': 'learning',
        'teach': 'teaching',
        'study': 'studying'
      };
      
      const lowerAction = action.toLowerCase();
      if (actionMap[lowerAction]) {
        return actionMap[lowerAction];
      }
      
      // Generic conversion for other single-word verbs
      if (lowerAction.endsWith('ing')) {
        return lowerAction; // Already in gerund form
      } else if (lowerAction.endsWith('e')) {
        return lowerAction.substring(0, lowerAction.length - 1) + 'ing';
      } else {
        return lowerAction + 'ing';
      }
    } else {
      // Multi-word action - keep as is but remove articles
      return action.replace(/^(a|an|the)\s+/i, '');
    }
  }
  
  // Handle "X of Y" patterns (e.g., "process of photosynthesis" -> "photosynthesis")
  const ofPattern = /^(?:the )?(?:process|concept|theory|principle|law|function|structure|mechanism|procedure|approach|model|framework|design|architecture|component|element|feature|aspect|property|characteristic|attribute|quality|trait|behavior|pattern|relationship|connection|interaction|effect|impact|result|outcome|benefit|advantage|disadvantage|limitation|challenge|problem|solution|application|implementation|example|case) of (.+)$/i;
  const ofMatch = cleanQuestion.match(ofPattern);
  if (ofMatch) {
    return ofMatch[1].trim();
  }
  
  // Handle "X in Y" patterns (e.g., "photosynthesis in plants" -> "photosynthesis")
  const inPattern = /^(.+) (?:in|within|inside|during|throughout|across) (.+)$/i;
  const inMatch = cleanQuestion.match(inPattern);
  if (inMatch) {
    return inMatch[1].trim();
  }
  
  // Handle "benefits of X" or "advantages of X" patterns
  const benefitsPattern = /^(?:what are )?(?:the )?(?:benefits|advantages|uses|applications) (?:of|for) (.+)$/i;
  const benefitsMatch = cleanQuestion.match(benefitsPattern);
  if (benefitsMatch) {
    return benefitsMatch[1].trim();
  }
  
  // Handle "X vs Y" or "X versus Y" patterns
  const vsPattern = /^(.+) (?:vs|versus) (.+)$/i;
  const vsMatch = cleanQuestion.match(vsPattern);
  if (vsMatch) {
    return `${vsMatch[1].trim()} vs ${vsMatch[2].trim()}`;
  }
  
  // Split into words for further analysis
  const words = cleanQuestion.split(/\s+/);
  
  // If it's a short phrase (1-4 words), use it directly
  if (words.length <= 4) {
    return cleanQuestion;
  }
  
  // For longer phrases, try to identify the core noun phrase with enhanced precision
  // Expanded list of key nouns for better matching
  const keyNouns = [
    'algorithm', 'process', 'system', 'technology', 'method', 'technique',
    'theory', 'concept', 'principle', 'law', 'function', 'structure',
    'mechanism', 'procedure', 'approach', 'model', 'framework', 'design',
    'architecture', 'component', 'element', 'feature', 'aspect', 'property',
    'characteristic', 'attribute', 'quality', 'trait', 'behavior', 'pattern',
    'relationship', 'connection', 'interaction', 'effect', 'impact', 'result',
    'outcome', 'benefit', 'advantage', 'disadvantage', 'limitation', 'challenge',
    'problem', 'solution', 'application', 'implementation', 'example', 'case',
    'computer', 'machine', 'device', 'engine', 'robot', 'software', 'program',
    'network', 'internet', 'web', 'database', 'server', 'cloud', 'ai', 'intelligence',
    'brain', 'mind', 'thought', 'idea', 'philosophy', 'science',
    'mathematics', 'physics', 'chemistry', 'biology', 'medicine', 'health',
    'business', 'economics', 'finance', 'market', 'investment', 'trading',
    'history', 'culture', 'art', 'music', 'literature', 'poetry', 'writing',
    'climate', 'weather', 'geography', 'planet', 'animal', 'plant', 'cell',
    'dna', 'gene', 'evolution', 'gravity', 'energy', 'light', 'sound',
    'communication', 'language', 'education', 'learning', 'development',
    'revolution', 'war', 'peace', 'government', 'politics', 'law', 'justice',
    'religion', 'belief', 'faith', 'tradition', 'custom', 'society', 'culture',
    'economy', 'industry', 'production', 'manufacturing', 'engineering',
    'construction', 'architecture', 'design', 'art', 'music', 'film', 'literature',
    'psychology', 'sociology', 'anthropology', 'archaeology', 'astronomy',
    'geology', 'oceanography', 'meteorology', 'ecology', 'environment',
    'nutrition', 'diet', 'exercise', 'fitness', 'sport', 'game', 'entertainment'
  ];
  
  // Look for key nouns in the phrase from right to left (more likely to be the core subject)
  for (let i = words.length - 1; i >= 0; i--) {
    const word = words[i].toLowerCase().replace(/[^a-zA-Z]/g, '');
    if (keyNouns.includes(word)) {
      // Return the core noun and any modifiers directly before it
      const startIndex = Math.max(0, i - 2); // Up to 2 words before
      return words.slice(startIndex, i + 1).join(' ');
    }
  }
  
  // If no key noun found, look for proper nouns (capitalized words)
  const properNouns = words.filter(word => /^[A-Z][a-z]/.test(word));
  if (properNouns.length > 0) {
    return properNouns.join(' ');
  }
  
  // If still no match, return the last 2-3 words as the most likely subject
  const endIndex = words.length;
  const startIndex = Math.max(0, endIndex - 3);
  return words.slice(startIndex, endIndex).join(' ');
}

async function generateAvatarResponse(question, language = "english") {
  const requestId = `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  try {
    console.log(`[Gemini] [${requestId}] ===== Processing Request =====`);
    console.log(`[Gemini] [${requestId}] Question:`, question);
    console.log(`[Gemini] [${requestId}] Language parameter:`, language);
    console.log(`[Gemini] [${requestId}] Language type:`, typeof language);
    console.log(`[Gemini] [${requestId}] Language normalized:`, language.toLowerCase());
    console.log(`[Gemini] [${requestId}] Question length:`, question.length);
    console.log(`[Gemini] [${requestId}] ⚠️ CRITICAL: Response MUST be in ${language.toUpperCase()} language`);
    
    // Use the gemini 2.5 flash model as requested
    const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });
    
    // Adjust template based on language - normalize first
    const normalizedLang = language.toLowerCase().trim();
    console.log(`[Gemini] [${requestId}] Normalized language: "${normalizedLang}"`);
    
    let languageSpecificTemplate = template;
    if (normalizedLang === "hindi" || normalizedLang === "hi") {
      // For Hindi, respond naturally in Hindi
      languageSpecificTemplate = `${template}

CRITICAL LANGUAGE INSTRUCTIONS FOR HINDI:
- You MUST respond entirely in Hindi language using Devanagari script (हिंदी).
- DO NOT use English words or English script. Use ONLY Devanagari script characters.
- If the user asks in Hindi, respond in Hindi. If the user asks in English but language is set to Hindi, still respond in Hindi.
- Respond naturally and conversationally - match the tone of the user's question.
- CRITICAL: Keep your response SHORT - MAXIMUM 4-5 sentences. This is to save API credits.
- For simple greetings (like "hello" or "hi" or "नमस्ते"), give a simple, friendly greeting back in Hindi (1-2 sentences).
- For questions, provide a concise answer in EXACTLY 4-5 sentences. Do NOT exceed this limit.
- DO NOT add unnecessary information, examples, or lengthy explanations.
- All text in the "text" field must be in Hindi (Devanagari script).
- Be natural and conversational, but keep it brief.
- IMPORTANT: Your response must contain Devanagari script characters. If you cannot respond in Hindi, indicate that clearly in Hindi script.
- REMEMBER: Shorter responses = lower costs. Always aim for 4-5 sentences maximum.`;
    } else if (normalizedLang === "telugu" || normalizedLang === "te") {
      // For Telugu, respond naturally in Telugu
      languageSpecificTemplate = `${template}

CRITICAL LANGUAGE INSTRUCTIONS FOR TELUGU:
- You MUST respond ENTIRELY in Telugu language using Telugu script (తెలుగు).
- DO NOT use English words or English script. Use ONLY Telugu script characters.
- If the user asks in Telugu, respond in Telugu. If the user asks in English but language is set to Telugu, still respond in Telugu.
- Respond naturally and conversationally - match the tone of the user's question.
- CRITICAL: Keep your response SHORT - MAXIMUM 4-5 sentences. This is to save API credits.
- For simple greetings (like "hello" or "hi" or "నమస్కారం"), give a simple, friendly greeting back in Telugu (1-2 sentences).
- For questions, provide a concise answer in EXACTLY 4-5 sentences. Do NOT exceed this limit.
- DO NOT add unnecessary information, examples, or lengthy explanations.
- All text in the "text" field MUST be in Telugu script (తెలుగు లిపి).
- Be natural and conversational, but keep it brief.
- IMPORTANT: Your response must contain Telugu script characters. If you cannot respond in Telugu, indicate that clearly in Telugu script.
- REMEMBER: Shorter responses = lower costs. Always aim for 4-5 sentences maximum.`;
    } else {
      // For English, ensure it stays in English
      languageSpecificTemplate = `${template}

LANGUAGE INSTRUCTIONS FOR ENGLISH:
- Respond in English language.
- Write like you're talking to a friend - use natural, conversational English
- Use contractions and casual language to sound more human
- Keep it clear and easy to understand when spoken aloud
- Make it feel like a real conversation, not a formal response
- Be warm, friendly, and engaging`;
    }
    
    // Add explicit language instruction at the start of prompt for Telugu/Hindi
    let finalPrompt = languageSpecificTemplate;
    if (normalizedLang === "telugu" || normalizedLang === "te") {
      finalPrompt = `⚠️⚠️⚠️ CRITICAL LANGUAGE REQUIREMENT ⚠️⚠️⚠️
The user has SELECTED TELUGU as their language preference.
You MUST respond ENTIRELY in Telugu script (తెలుగు లిపి).
DO NOT use English words, English script, or any other language.
Even if the user's question appears in English (due to transcription), you MUST still respond in Telugu.
This is NON-NEGOTIABLE. The user expects a Telugu response.

${languageSpecificTemplate}`;
    } else if (normalizedLang === "hindi" || normalizedLang === "hi") {
      finalPrompt = `⚠️⚠️⚠️ CRITICAL LANGUAGE REQUIREMENT ⚠️⚠️⚠️
The user has SELECTED HINDI as their language preference.
You MUST respond ENTIRELY in Hindi script (हिंदी/Devanagari).
DO NOT use English words, English script, or any other language.
Even if the user's question appears in English (due to transcription), you MUST still respond in Hindi.
This is NON-NEGOTIABLE. The user expects a Hindi response.

${languageSpecificTemplate}`;
    }
    
    const prompt = `${finalPrompt}\n\nHuman: ${question}\nAI:`;
    console.log(`[Gemini] [${requestId}] Sending prompt to Gemini (first 300 chars):`, prompt.substring(0, 300) + "...");
    console.log(`[Gemini] [${requestId}] Full question:`, question);
    console.log(`[Gemini] [${requestId}] Language context: ${normalizedLang.toUpperCase()}`);
    
    const result = await model.generateContent(prompt);
    const response = await result.response;
    const text = response.text();
    
    console.log(`[Gemini] [${requestId}] Raw Gemini response (first 200 chars):`, text.substring(0, 200) + "...");
    console.log(`[Gemini] [${requestId}] Full response length:`, text.length);
    
    // Try to parse the JSON response
    try {
      const parsedResponse = JSON.parse(text);
      const validatedResponse = responseSchema.parse(parsedResponse);
      console.log(`[Gemini] [${requestId}] ✅ Successfully parsed and validated response`);
      console.log(`[Gemini] [${requestId}] Response messages:`, validatedResponse.messages.map(m => m.text.substring(0, 50) + "..."));
      
      // Validate language for Hindi/Telugu responses - use normalized language
      const checkLang = normalizedLang;
      if (checkLang === "telugu" || checkLang === "te") {
        const teluguScriptRegex = /[\u0C00-\u0C7F]/;
        const allMessages = validatedResponse.messages.map(m => m.text).join(' ');
        const hasTeluguScript = teluguScriptRegex.test(allMessages);
        if (!hasTeluguScript) {
          console.warn(`[Gemini] [${requestId}] ⚠️ WARNING: Response does not contain Telugu script! Response: ${allMessages.substring(0, 100)}`);
          // Force a Telugu response
          validatedResponse.messages[0].text = "క్షమించండి, నేను తెలుగులో మాత్రమే ప్రతిస్పందించగలను. దయచేసి మీ ప్రశ్నను తెలుగులో అడగండి.";
        } else {
          console.log(`[Gemini] [${requestId}] ✅ Response contains Telugu script`);
        }
      } else if (checkLang === "hindi" || checkLang === "hi") {
        const hindiScriptRegex = /[\u0900-\u097F]/;
        const allMessages = validatedResponse.messages.map(m => m.text).join(' ');
        const hasHindiScript = hindiScriptRegex.test(allMessages);
        if (!hasHindiScript) {
          console.warn(`[Gemini] [${requestId}] ⚠️ WARNING: Response does not contain Hindi script! Response: ${allMessages.substring(0, 100)}`);
          // Force a Hindi response
          validatedResponse.messages[0].text = "क्षमा करें, मैं केवल हिंदी में उत्तर दे सकता हूं। कृपया अपना प्रश्न हिंदी में पूछें।";
        } else {
          console.log(`[Gemini] [${requestId}] ✅ Response contains Hindi script`);
        }
      }
      
      // Add image URLs to the response
      const responseText = validatedResponse.messages.map(m => m.text).join(' ');
      validatedResponse.images = await generateImageUrls(question, responseText);
      console.log(`[Gemini] [${requestId}] Generated ${validatedResponse.images.length} images`);
      
      return validatedResponse;
    } catch (parseError) {
      // If parsing fails, create a default response
      console.error(`[Gemini] [${requestId}] ❌ Error parsing Gemini response:`, parseError);
      console.error(`[Gemini] [${requestId}] Raw response that failed to parse:`, text);
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
    console.error(`[Gemini] [${requestId}] ❌ Error generating response with Gemini:`, error);
    console.error(`[Gemini] [${requestId}] Error message:`, error.message);
    console.error(`[Gemini] [${requestId}] Error stack:`, error.stack);
    
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

// Function to generate chat summary
async function generateChatSummary(chatHistory) {
  try {
    console.log("Generating summary for chat history...");
    
    // Use the gemini 2.5 flash model
    const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });
    
    // Format the chat history for the prompt
    const formattedHistory = chatHistory.map(msg => {
      const sender = msg.sender === 'user' ? 'User' : msg.sender === 'ai' ? 'AI Assistant' : 'System';
      return `${sender}: ${msg.text}`;
    }).join('\n');
    
    const summaryPrompt = `You are an intelligent AI assistant. Your task is to create a concise, informative summary of the conversation between a user and an AI assistant.

Please follow these guidelines:
1. Provide a clear overview of the main topics discussed
2. Highlight any important decisions, agreements, or conclusions reached
3. Mention any questions asked and answers provided
4. Keep the summary concise but comprehensive (2-4 paragraphs)
5. Use natural language and avoid technical jargon when possible
6. Focus on the key insights and takeaways from the conversation

Conversation History:
${formattedHistory}

Please provide a summary of this conversation in a natural, readable format.`;
    
    console.log("Sending summary prompt to Gemini...");
    const result = await model.generateContent(summaryPrompt);
    const response = await result.response;
    const summaryText = response.text();
    
    console.log("Successfully generated chat summary");
    return summaryText.trim();
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

export { generateAvatarResponse, generateChatSummary, generateRetentionTest, generatePersonalizedFeedback, extractCoreSubject, fetchWikimediaImages, generateImageUrls };
