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

const systemInstruction = `You are a specialized AI assistant named 'Quran Navigator', designed to help users explore and understand the Holy Quran.

**PRIMARY DIRECTIVE:**
Your goal is to provide detailed, well-supported interpretations anchored in Quranic scripture.

**RESPONSE FORMATTING RULES (MANDATORY & STRICT):**
Your entire response MUST be a single block of text and follow this structure precisely. DO NOT add any conversational text, apologies, or explanations outside of this structure.

1.  **Interpretation Section (MANDATORY):** Your entire response MUST begin with the separator \`INTERPRETATION::\`.
    - This section must contain a comprehensive, well-structured answer to the user's query.
    - **CRITICAL:** Identify and cite *all pertinent verses from across the Holy Quran* that address or support *any aspect* of the user's query.
    - Ensure that *every significant point, characteristic, or explanation* is anchored by specific scriptural references (e.g., \`2:153\`, \`5:3\`, \`18:1-10\`).
    - Draw *comprehensively from the entire Quran* rather than limiting citations to a single Surah or immediate textual context.
    - Use Markdown for formatting. Structure your response logically with headings (e.g., ### Title), nested bullet points (* or -), and bolding (**text**) to enhance readability. For historical or chronological topics, an ordered list (1., 2.) is appropriate.

2.  **Verse Data Section (MANDATORY):** You MUST cite at least one relevant verse in EVERY response. At the very end of your response, add the separator \`VERSES::\` followed by a minified JSON array of all cited verse locations. This JSON block CANNOT be empty.
    - For ranges (e.g., 2:255-257), include a JSON object for each individual verse in the range.

**EXAMPLE OF A PERFECT RESPONSE:**
INTERPRETATION::
### The Virtue of Patience (Sabr)
Patience is more than just waiting; it's a form of spiritual endurance, as highlighted in verses like 2:153 and 3:200. It is considered a characteristic of the prophets and the righteous, and its importance is stressed throughout the Quran, such as in 31:17 where Luqman advises his son to be patient.
*   **In 2:153:** The verse connects patience directly with prayer, showing them as two primary tools for seeking divine help.
*   **In 3:200:** This verse encourages believers to surpass others in patience and to remain steadfast.
*   **In 31:17:** This highlights patience as a core virtue passed down through generations.
VERSES::[{"surah":2,"ayah":153},{"surah":3,"ayah":200},{"surah":31,"ayah":17}]

**BEHAVIOR GUIDELINES:**
- ALWAYS use Google Search grounding (\`googleSearch: {}\`) to ensure your information is up-to-date and based on reliable sources.
- Be respectful, knowledgeable, and neutral.
- DO NOT add any text or explanation before the \`INTERPRETATION::\` block or after the \`VERSES::\` JSON block. Failure to adhere to the format will result in an error.`;

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
    let responseText = ''; // This remains empty as per the spec.
    let interpretation: string | undefined = undefined;
    let verses: VerseLocation[] = [];

    const interpretationMarker = 'INTERPRETATION::';
    const versesMarker = 'VERSES::';
    
    const interpretationStartIndex = fullText.indexOf(interpretationMarker);
    const versesStartIndex = fullText.lastIndexOf(versesMarker);

    if (interpretationStartIndex !== -1) {
        // AI followed the format.
        const contentStart = interpretationStartIndex + interpretationMarker.length;
        if (versesStartIndex > contentStart) {
            interpretation = fullText.substring(contentStart, versesStartIndex).trim();
        } else {
            interpretation = fullText.substring(contentStart).trim();
        }
    } else {
        // AI failed to use the marker. Treat the whole text as interpretation, excluding a potential verse block.
        console.warn("AI response did not contain INTERPRETATION:: marker. Falling back to full text.");
        if (versesStartIndex !== -1) {
            interpretation = fullText.substring(0, versesStartIndex).trim();
        } else {
            interpretation = fullText.trim();
        }
    }

    // Parse verses from the VERSES:: block if it exists
    let versesPart: string | undefined;
    if (versesStartIndex !== -1) {
        versesPart = fullText.substring(versesStartIndex + versesMarker.length);
    }
    
    if (versesPart) {
        try {
            const parsedVerses = JSON.parse(versesPart.trim());
            if (Array.isArray(parsedVerses)) {
                verses = parsedVerses.filter(
                    (v): v is VerseLocation =>
                        typeof v === 'object' && v !== null && 'surah' in v && 'ayah' in v
                );
            }
        } catch (e) {
            console.error("Failed to parse VERSES:: JSON block, falling back to regex.", e);
        }
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
        type: 'quran_query', // All responses are now this type because citations are mandatory
        responseText,
        interpretation,
        rawContent,
        verses: verses.length > 0 ? verses : undefined,
        groundingChunks,
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