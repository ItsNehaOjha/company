/**
 * AI-Powered News Pipeline Service
 * 
 * Connects to Google Gemini API (gemini-1.5-flash) for translation,
 * summarization, duplicate checking, and headline optimization.
 * Features robust local fallbacks if API keys are missing.
 */
const { dbGet } = require('../db/database');

// Helper to retrieve the API key from Environment or Settings Database
async function getApiKey() {
  if (process.env.GEMINI_API_KEY) {
    return process.env.GEMINI_API_KEY;
  }
  try {
    const setting = await dbGet("SELECT value FROM settings WHERE key = 'gemini_api_key'");
    return setting ? setting.value : null;
  } catch (err) {
    return null;
  }
}

// Call Google Gemini API
async function callGemini(prompt) {
  const apiKey = await getApiKey();
  if (!apiKey) {
    return null;
  }

  try {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`;
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }]
      })
    });

    if (!res.ok) {
      const errText = await res.text();
      console.warn('[AI Pipeline] Gemini API error response:', errText);
      return null;
    }

    const data = await res.json();
    if (data.candidates && data.candidates[0] && data.candidates[0].content && data.candidates[0].content.parts[0]) {
      return data.candidates[0].content.parts[0].text.trim();
    }
    return null;
  } catch (err) {
    console.error('[AI Pipeline] Gemini fetch failed:', err.message);
    return null;
  }
}

// Simple Jaccard Similarity for Duplicate Detection (Fallback)
function calculateSimilarity(str1, str2) {
  const clean = (str) => str.toLowerCase().replace(/[^\w\s]/g, '').split(/\s+/).filter(Boolean);
  const words1 = new Set(clean(str1));
  const words2 = new Set(clean(str2));
  
  if (words1.size === 0 || words2.size === 0) return 0;
  
  const intersection = new Set([...words1].filter(x => words2.has(x)));
  const union = new Set([...words1, ...words2]);
  
  return intersection.size / union.size;
}

/**
 * Checks if a new article is duplicate of existing ones.
 * Leverages Gemini API semantic checking with local Jaccard fallback.
 */
async function isDuplicate(newTitle, existingTitles, threshold = 0.65) {
  if (!existingTitles || existingTitles.length === 0) return false;

  // 1. Try Gemini semantic duplicate checking
  const apiKey = await getApiKey();
  if (apiKey) {
    // Take a slice of recent titles (e.g. latest 30) to keep prompt size reasonable
    const compareList = existingTitles.slice(0, 30);
    const prompt = `Determine if the new headline: "${newTitle}" represents a duplicate/redundant news story of any of the following existing headlines.
Respond with only 'YES' if it is a duplicate of any existing headline in the list, or 'NO' if it is a unique/different story. Do not add any punctuation or extra text.

Existing Headlines:
${compareList.map((t, idx) => `${idx + 1}. ${t}`).join('\n')}`;

    const answer = await callGemini(prompt);
    if (answer && answer.toUpperCase().includes('YES')) {
      console.log(`[AI Pipeline] Gemini flagged duplicate headline: "${newTitle}"`);
      return true;
    }
  }

  // 2. Local Fallback Jaccard Similarity
  for (const title of existingTitles) {
    if (calculateSimilarity(newTitle, title) >= threshold) {
      console.log(`[AI Pipeline] Jaccard similarity flagged duplicate: "${newTitle}" vs "${title}"`);
      return true;
    }
  }
  return false;
}

/**
 * Auto-categorize article content based on keywords
 */
function autoCategorize(title, content = '') {
  const text = `${title} ${content}`.toLowerCase();
  
  // States Mapping
  let state = 'National';
  
  const upRegex = /\b(uttar pradesh|lucknow|noida|kanpur|yogi|prayagraj|varanasi|agra|meerut|gorakhpur|ayodhya)\b/i;
  const delhiRegex = /\b(delhi|ncr|gurugram|gurgaon|ghaziabad|faridabad|kejriwal|new delhi|noida|greater noida)\b/i;
  const punjabRegex = /\b(punjab|amritsar|ludhiana|chandigarh|mann|jalandhar|patiala|mohali|bathinda)\b/i;
  const haryanaRegex = /\b(haryana|panchkula|rohtak|ambala|saini|gurugram|gurgaon|faridabad|panipat|karnal|hisar|sonipat)\b/i;
  const uttararakhandRegex = /\b(uttarakhand|dehradun|haridwar|nainital|rishi|dhami|rishikesh|haldwani|almora|pithoragarh)\b/i;
  const himachalRegex = /\b(himachal|shimla|dharamshala|sukhu)\b/i;
  const kashmirRegex = /\b(kashmir|jammu|srinagar|ladakh)\b/i;

  if (upRegex.test(text)) state = 'Uttar Pradesh';
  else if (delhiRegex.test(text)) state = 'Delhi NCR';
  else if (punjabRegex.test(text)) state = 'Punjab';
  else if (haryanaRegex.test(text)) state = 'Haryana';
  else if (uttararakhandRegex.test(text)) state = 'Uttarakhand';
  else if (himachalRegex.test(text)) state = 'Himachal Pradesh';
  else if (kashmirRegex.test(text)) state = 'Jammu & Kashmir';

  // Category Mapping
  let category = 'General News'; // Fallback is General News

  const bizRegex = /\b(stocks?|markets?|economy|funding|startups?|finance|rbi|gst|trade|investment|investments|business)\b/i;
  const techRegex = /\b(ai|technology|technologies|tech|silicon|software|cybersecurity|cyber|programming|cloud|gadgets?|smartphones?)\b/i;
  const sportsRegex = /\b(cricket|football|kabaddi|olympics?|fifa|ipl|sports?|athletics?)\b/i;
  const politicsRegex = /\b(government|election|elections|policy|policies|politics|political)\b/i;
  const videoRegex = /\b(video|ground report|interview|watch|youtube)\b/i;
  const opinionRegex = /\b(opinion|column|editorial|essay|analysis)\b/i;
  const worldRegex = /\b(world|global|china|ukraine|russia|america|israel|gaza)\b/i;
  const eduRegex = /\b(cbse|university|universities|exams?|syllabus|education|students?|neet|jee)\b/i;

  if (bizRegex.test(text)) category = 'Business';
  else if (techRegex.test(text)) category = 'Technology';
  else if (sportsRegex.test(text)) category = 'Sports';
  else if (politicsRegex.test(text)) category = 'National'; // Map politics to National
  else if (videoRegex.test(text)) category = 'Videos';
  else if (opinionRegex.test(text)) category = 'Opinion';
  else if (worldRegex.test(text)) category = 'World';
  else if (eduRegex.test(text)) category = 'Education';

  return { category, state };
}

/**
 * Summarize article text using Gemini API
 */
async function generateSummary(text, title, lang = 'en') {
  if (!text || text.length < 50) return text || '';

  // 1. Try Gemini
  const summaryPrompt = lang === 'hi'
    ? `शीर्षक: "${title}" के साथ इस समाचार लेख का हिंदी में 2-3 मुख्य बिंदुओं का संक्षिप्त सारांश (bullets में) लिखें। केवल सारांश दें, कोई अन्य परिचय या पाठ न जोड़ें: \n\n${text.substring(0, 4000)}`
    : `Summarize the following news article titled "${title}" in 2-3 bullet points of key takeaways. Provide ONLY the summary itself. Do not add any introductory phrases or formatting other than plain bullet points: \n\n${text.substring(0, 4000)}`;

  const geminiResult = await callGemini(summaryPrompt);
  if (geminiResult) {
    return geminiResult;
  }

  // 2. Local fallback: first 2 sentences
  const sentences = text.split(/[.!?।]\s+/);
  const summarySentences = sentences.slice(0, 2).map(s => s.trim());
  let summary = summarySentences.join('. ') + '.';
  
  if (lang === 'hi') {
    if (!summary.endsWith('।')) {
      summary = summary.replace(/\.$/, '।');
    }
  }
  return summary;
}

/**
 * Translate text to Hindi using Gemini API
 */
async function translateText(text, targetLang = 'hi') {
  if (!text || targetLang !== 'hi') return text || '';

  // 1. Try Gemini
  const translationPrompt = `Translate the following news text into accurate, professional, and natural-sounding Hindi. Maintain news-style terminology. Do not translate proper nouns or technical names if they are commonly read in English inside Hindi media (e.g. SaaS, DeepTech). Output ONLY the translated text, do not add explanations or notes: \n\n${text}`;
  
  const geminiResult = await callGemini(translationPrompt);
  if (geminiResult) {
    return geminiResult;
  }

  // 2. Local fallback: return original English text
  return text;
}

async function isAiEnabled() {
  try {
    const setting = await dbGet("SELECT value FROM settings WHERE key = 'ai_summarization_enabled'");
    if (setting && setting.value === '0') return false;
    return !!(await getApiKey());
  } catch {
    return false;
  }
}

/**
 * Optimize headline using Gemini API
 */
async function optimizeHeadline(title, lang = 'en') {
  if (!title) return '';

  const apiKey = await getApiKey();
  if (!apiKey) return title;

  const prompt = lang === 'hi'
    ? `इस समाचार शीर्षक को आकर्षक, पेशेवर और हिंदी समाचार पत्र की शैली में अनुकूलित करें। केवल अनुकूलित शीर्षक दें: "${title}"`
    : `Optimize this news headline to be catchy, professional, and highly readable. Respond with ONLY the optimized headline, nothing else: "${title}"`;

  const optimized = await callGemini(prompt);
  return optimized || title;
}

module.exports = {
  isDuplicate,
  autoCategorize,
  generateSummary,
  translateText,
  optimizeHeadline,
  calculateSimilarity,
  isAiEnabled
};
