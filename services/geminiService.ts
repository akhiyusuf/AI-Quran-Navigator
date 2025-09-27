import { GoogleGenAI, GenerateContentResponse } from "@google/genai";
import type { AIResponse, Message, GroundingChunk, VerseLocation } from '../types';

// A consistent, more informative error message for configuration or restriction issues.
const analyticsConfigurationError = 'The AI service is currently unavailable. This may be due to regional restrictions or a server configuration issue. Please contact the site administrator for assistance.';

// Memoize the instance so we don't re-create it on every call.
let aiInstance: GoogleGenAI | null = null;

const getAiInstance = (): GoogleGenAI => {
  if (aiInstance) {
    return aiInstance;
  }
  try {
    // In a browser environment, `process` may not be defined. This check prevents a crash.
    // The environment is expected to provide the API key via this mechanism.
    if (typeof process === 'undefined' || !process.env || !process.env.API_KEY) {
      throw new Error("API_KEY environment variable not set or accessible.");
    }
    aiInstance = new GoogleGenAI({ apiKey: process.env.API_KEY });
    return aiInstance;
  } catch (e) {
    console.error("Failed to initialize GoogleGenAI:", e);
    // Provide a user-facing error that doesn't expose implementation details.
    throw new Error(analyticsConfigurationError);
  }
};

const systemInstruction = `You are a specialized AI assistant named 'Quran Navigator', designed to help users explore and understand the Holy Quran. Your knowledge is based on the Quran and authoritative Islamic sources.

**PRIMARY DIRECTIVE:**
Your goal is to provide detailed, well-supported interpretations anchored in Quranic scripture. While your primary function is to cite the Quran, you must also acknowledge the Sunnah (the teachings and practices of Prophet Muhammad ﷺ, as recorded in the Hadith) as the second primary source of Islamic guidance.

**BEHAVIOR GUIDELINES:**
- **Quran and Sunnah:** When answering, base your interpretations on the Quran first and foremost. If a concept is primarily detailed in the Hadith, acknowledge its origin from the Sunnah and authentic narrations (e.g., Sahih al-Bukhari, Sahih Muslim) without sounding dismissive. Do not adopt a "Quran-only" perspective. Your role is to be a helpful, mainstream Islamic studies assistant.
- **Tool Limitations:** If a user asks why the tool does not yet cite specific Hadith books or verses, you must explain: "This tool is currently focused on navigating the Quran. Integration of a comprehensive and searchable Hadith database is a planned feature for a future update." Do not deviate from this explanation.
- **Google Search:** ALWAYS use Google Search grounding (\`googleSearch: {}\`) to ensure your information is up-to-date and based on reliable sources.
- **Tone:** Be respectful, knowledgeable, and neutral.

**RESPONSE FORMATTING RULES (MANDATORY & STRICT):**
Your entire response MUST be a single block of text and follow this structure precisely. DO NOT add any conversational text, apologies, or explanations outside of this structure.

1.  **Interpretation Section (MANDATORY):** Your entire response MUST begin with the separator \`INTERPRETATION::\`.
    - This section must contain a comprehensive, well-structured answer to the user's query.
    - **CRITICAL:** Identify and cite *all pertinent verses from across the Holy Quran* that address or support *any aspect* of the user's query.
    - Ensure that *every significant point, characteristic, or explanation* is anchored by specific scriptural references (e.g., \`2:153\`, \`5:3\`, \`18:1-10\`).
    - Draw *comprehensively from the entire Quran* rather than limiting citations to a single Surah or immediate textual context.
    - Use Markdown for formatting. Structure your response logically with headings (e.g., ### Title), nested bullet points (* or -), and bolding (**text**) to enhance readability. For historical or chronological topics, an ordered list (1., 2.) is appropriate.

2.  **Verse Data Section (MANDATORY):** You MUST cite at least one relevant verse in EVERY response. At the very end of your response, add the separator \`VERSES::\` followed by a minified JSON array of all cited verse locations. This JSON block CANNOT be empty.

3.  **Suggestions Section (MANDATORY):** After the \`VERSES::\` block, you MUST add a \`SUGGESTIONS::\` separator.
    - Provide 2-3 relevant follow-up questions that encourage further exploration.
    - **CRITICAL:** These suggestions MUST be directly inspired by the content of the web sources you consulted (\`groundingChunks\`). They should represent natural next steps in learning about the topic.
    - Format the suggestions as a minified JSON array of strings. If no suggestions are appropriate for a simple query (e.g., "hello"), provide an empty array \`[]\`.

**EXAMPLE OF A PERFECT RESPONSE:**
INTERPRETATION::
### The Virtue of Patience (Sabr)
Patience is more than just waiting; it's a form of spiritual endurance, as highlighted in verses like 2:153 and 3:200. It is considered a characteristic of the prophets and the righteous, and its importance is stressed throughout the Quran, such as in 31:17 where Luqman advises his son to be patient.
*   **In 2:153:** The verse connects patience directly with prayer, showing them as two primary tools for seeking divine help.
*   **In 3:200:** This verse encourages believers to surpass others in patience and to remain steadfast.
*   **In 31:17:** This highlights patience as a core virtue passed down through generations.
VERSES::[{"surah":2,"ayah":153},{"surah":3,"ayah":200},{"surah":31,"ayah":17}]
SUGGESTIONS::["What are the different types of Sabr mentioned by scholars?","How did Prophet Ayub (Job) exemplify patience?","What is the reward for being patient?"]
`;

const tutorialSystemInstruction = `You are a friendly and helpful AI guide for the 'Quran Navigator' application. Your purpose is to provide a brief, interactive tutorial for new users.

**BEHAVIOR GUIDELINES:**
- **Be Step-by-Step:** Guide the user through one feature at a time. Wait for them to respond with "ok", "got it", "next", etc., before moving on.
- **Be Encouraging:** Use a warm and welcoming tone.
- **Demonstrate Features:** Actively use the features you are explaining. For example, when explaining verse citations, you MUST cite a verse.
- **Stay On-Topic:** Do not answer general Quranic questions. If the user asks an unrelated question, gently guide them back to the tutorial by saying something like: "That's a great question! We can explore that after the tutorial. For now, shall we continue?"
- **Keep it Brief:** The tutorial should only be 4-5 steps long.
- **Response Format:** You MUST follow the same strict response format as the main AI. Every response needs INTERPRETATION::, VERSES:: (can be an empty array \`[]\` if not citing), and SUGGESTIONS::.

**TUTORIAL FLOW:**
1.  **Welcome:** Start with a warm welcome. Explain that you'll guide them through the main features. Ask if they're ready to start.
2.  **Asking a Question:** After they agree, explain that the main feature is asking questions. Prompt them to try asking a simple question, like "What does the Quran say about charity?".
3.  **Verse Citations & Viewer:** When you respond to their question, you MUST include a verse citation (e.g., 2:277). Then, explain what the blue citation button does (opens the verse in the viewer on the right). Encourage them to click it.
4.  **Viewer Features:** After they've interacted with the viewer, briefly explain the Tafsir and Bookmark icons inside the viewer.
5.  **Sidebar & Saving:** Explain the sidebar for History, Bookmarks, and Saved messages. Explain that they can save any helpful AI response using the 'Save' button below the message.
6.  **Conclusion:** Conclude the tutorial and tell them they can start a new chat to begin their own exploration.

**EXAMPLE OF A STEP 3 RESPONSE:**
INTERPRETATION::
Excellent! The story of Prophet Yusuf (Joseph) is a beautiful one, primarily detailed in Surah Yusuf. It begins with his dream as a young boy, where he saw eleven stars, the sun, and the moon prostrating to him (12:4).

Now, notice the blue button with "12:4" in my response? That's a direct link to the verse. Clicking it will instantly open the Quran Viewer on the right to that exact passage. Go ahead and give it a try!
VERSES::[{"surah":12,"ayah":4}]
SUGGESTIONS::["Okay, I clicked it.","What's next?"]
`;

export async function* streamAIResponse(
  messages: Message[]
): AsyncGenerator<GenerateContentResponse> {
  const ai = getAiInstance();

  const contents = messages.map(msg => ({
    role: msg.sender === 'user' ? 'user' : 'model',
    parts: [{ text: msg.rawContent || msg.text }],
  }));

  const stream = await ai.models.generateContentStream({
    model: 'gemini-2.5-flash',
    contents: contents,
    config: {
        systemInstruction,
        tools: [{ googleSearch: {} }],
    },
  });

  for await (const chunk of stream) {
    yield chunk;
  }
}

export async function* streamTutorialResponse(
  messages: Message[]
): AsyncGenerator<GenerateContentResponse> {
  const ai = getAiInstance();

  const contents = messages.map(msg => ({
    role: msg.sender === 'user' ? 'user' : 'model',
    parts: [{ text: msg.rawContent || msg.text }],
  }));

  // The first message from the user is empty, so we add a specific prompt to kick off the tutorial.
  const isFirstTurn = contents.length === 0;
  if (isFirstTurn) {
    contents.push({ role: 'user', parts: [{ text: "Let's start the tutorial." }] });
  }

  const stream = await ai.models.generateContentStream({
    model: 'gemini-2.5-flash',
    contents: contents,
    config: {
        systemInstruction: tutorialSystemInstruction,
    },
  });

  for await (const chunk of stream) {
    yield chunk;
  }
}

const expandVerseRange = (surah: number, startAyah: number, endAyah?: number): VerseLocation[] => {
  const verses: VerseLocation[] = [];
  const end = endAyah || startAyah;
  for (let i = startAyah; i <= end; i++) {
    verses.push({ surah, ayah: i });
  }
  return verses;
};

export const parseAIResponse = (fullText: string, groundingChunks?: GroundingChunk[]): AIResponse => {
    const rawContent = fullText;
    let responseText = '';
    let interpretation: string | undefined = undefined;
    let verses: VerseLocation[] = [];
    let suggestions: string[] = [];

    const interpretationMarker = 'INTERPRETATION::';
    const versesMarker = 'VERSES::';
    const suggestionsMarker = 'SUGGESTIONS::';
    
    const interpretationStartIndex = fullText.indexOf(interpretationMarker);
    const versesStartIndex = fullText.lastIndexOf(versesMarker);
    const suggestionsStartIndex = fullText.lastIndexOf(suggestionsMarker);

    // -- PARSE SUGGESTIONS --
    if (suggestionsStartIndex !== -1) {
        const suggestionsPart = fullText.substring(suggestionsStartIndex + suggestionsMarker.length);
        try {
            const parsed = JSON.parse(suggestionsPart.trim());
            if (Array.isArray(parsed)) {
                suggestions = parsed.filter((s): s is string => typeof s === 'string');
            }
        } catch (e) { console.error("Failed to parse SUGGESTIONS:: JSON block.", e); }
    }
    
    // -- PARSE VERSES --
    if (versesStartIndex !== -1) {
        const endOfVersesIndex = (suggestionsStartIndex > versesStartIndex) ? suggestionsStartIndex : undefined;
        const versesPart = fullText.substring(versesStartIndex + versesMarker.length, endOfVersesIndex);
        try {
            const parsed = JSON.parse(versesPart.trim());
            if (Array.isArray(parsed)) {
                verses = parsed.filter((v): v is VerseLocation => typeof v === 'object' && v !== null && 'surah' in v && 'ayah' in v);
            }
        } catch (e) { console.error("Failed to parse VERSES:: JSON block.", e); }
    }

    // -- PARSE INTERPRETATION --
    if (interpretationStartIndex !== -1) {
        const potentialEndMarkers = [versesStartIndex, suggestionsStartIndex].filter(i => i > interpretationStartIndex);
        const endOfInterpretationIndex = potentialEndMarkers.length > 0 ? Math.min(...potentialEndMarkers) : undefined;
        interpretation = fullText.substring(interpretationStartIndex + interpretationMarker.length, endOfInterpretationIndex).trim();
    } else {
        console.warn("AI response did not contain INTERPRETATION:: marker. Falling back.");
        const potentialEndMarkers = [versesStartIndex, suggestionsStartIndex].filter(i => i !== -1);
        const startOfOtherContent = potentialEndMarkers.length > 0 ? Math.min(...potentialEndMarkers) : undefined;
        interpretation = fullText.substring(0, startOfOtherContent).trim();
    }

    // Regex fallback/enhancement: find all verses mentioned in the text to ensure none are missed.
    const verseRegex = /\b(\d{1,3}):(\d+)(?:-(\d+))?\b/g;
    const foundVerses = new Set<string>(); // Use a Set to avoid duplicates, e.g., '2:153'
    verses.forEach(v => foundVerses.add(`${v.surah}:${v.ayah}`));

    let match;
    // Search the entire raw content for citations, not just the interpretation part.
    while ((match = verseRegex.exec(rawContent)) !== null) {
        const surah = parseInt(match[1], 10);
        const startAyah = parseInt(match[2], 10);
        const endAyah = match[3] ? parseInt(match[3], 10) : undefined;
        const expanded = expandVerseRange(surah, startAyah, endAyah);
        expanded.forEach(v => foundVerses.add(`${v.surah}:${v.ayah}`));
    }

    // Convert Set back to array of VerseLocation objects
    verses = Array.from(foundVerses).map(vStr => {
        const [surah, ayah] = vStr.split(':').map(Number);
        return { surah, ayah };
    }).sort((a, b) => { // Keep them sorted
        if (a.surah !== b.surah) return a.surah - b.surah;
        return a.ayah - b.ayah;
    });

    return {
        type: 'quran_query',
        responseText,
        interpretation,
        rawContent,
        verses: verses.length > 0 ? verses : undefined,
        groundingChunks,
        suggestions: suggestions.length > 0 ? suggestions : undefined,
    };
};

export const translateTextToEnglish = async (text: string): Promise<string> => {
  if (!text.trim()) {
    return "";
  }
  try {
    const ai = getAiInstance();
    const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: `Translate the following Arabic text to English. Provide only the translation, without any additional commentary or phrases like "Here is the translation:":\n\n${text}`,
    });
    return response.text.trim();
  } catch (error) {
    console.error("Translation failed:", error);
    if (error instanceof Error && error.message.includes(analyticsConfigurationError)) {
        throw error;
    }
    return "Could not translate the text at this time.";
  }
};

export const generateChatTitle = async (userMessage: string): Promise<string> => {
  if (!userMessage.trim()) {
    return "New Chat";
  }
  try {
    const ai = getAiInstance();
    const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: `Generate a short, concise title (4 words maximum) for the following user query. Respond with ONLY the title text, and nothing else (no quotes, no "Title:").\n\nQuery: "${userMessage}"`,
        config: { thinkingConfig: { thinkingBudget: 0 } } // Optimize for low latency
    });
    // Clean up response: trim whitespace and remove any surrounding quotes
    const title = response.text.trim().replace(/^["']|["']$/g, '');
    // Further fallback if AI returns an empty string
    return title || (userMessage.length > 30 ? `${userMessage.substring(0, 27)}...` : userMessage);
  } catch (error) {
    console.error("Title generation failed:", error);
    // Fallback to simple truncation on any API error
    return userMessage.length > 30 ? `${userMessage.substring(0, 27)}...` : userMessage;
  }
};
