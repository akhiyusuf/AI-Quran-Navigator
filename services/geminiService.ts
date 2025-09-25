import { GoogleGenAI, GenerateContentResponse } from "@google/genai";
import type { AIResponse, Message, GroundingChunk, VerseLocation } from '../types';

const apiKey = process.env.API_KEY;
if (!apiKey) {
  // This error will be caught by the calling function and displayed to the user.
  throw new Error('The API_KEY environment variable is not set. Please configure it to use the AI features.');
}

const ai = new GoogleGenAI({ apiKey });

const getSystemPrompt = () => `You are a conversational guide for a Quran application. Your primary role is to help users explore the Holy Quran by providing well-structured and easy-to-read summaries based on web search results.

For *every* user query that requires factual or interpretive information, including follow-up questions, you MUST follow this strict process:

1.  **SEARCH**: Use your search tool to find high-quality online sources to understand the topic. Your response must be grounded in these search results. Do not answer from memory.

2.  **SYNTHESIZE & FORMAT**: Write a detailed interpretation based on the information from your search. This interpretation MUST be well-formatted using markdown for readability. As you write, cite relevant Quran verses using the simple format \`surah:ayah\` or \`surah:start_ayah-end_ayah\` for ranges (e.g., 2:153 or 2:255-256).

3.  **STRUCTURE FINAL RESPONSE**: Structure your final output using these exact markers in this order:
    *   Start with a brief, single-sentence acknowledgement that directly and conversationally references the user's main topic. For example, if the user asks about charity, you could say, "Certainly, let's explore what the Quran says about charity."
    *   Add the marker \`INTERPRETATION::\` on a new line.
    *   Provide your full synthesized text, formatted with markdown and including ONLY the \`surah:ayah\` citations.
    *   If you cited any Quran verses, add the marker \`VERSES::\` on a new line, followed by a valid JSON array of verse locations. You MUST expand ranges into individual verses in this JSON. Example: \`VERSES::[{"surah":2,"ayah":153}]\`.

**CRITICAL RULE for FOLLOW-UPS & CORRECTIONS**: If a user asks a follow-up question or points out a mistake in your previous answer, do **NOT** apologize and answer from memory. You **MUST** treat it as a completely new query and perform a new search to generate a complete, grounded response that follows the entire process above.

**MARKDOWN FORMATTING RULES for the INTERPRETATION section:**
*   **Headings**: Use \`#\` for main headings, \`##\` for sub-headings, and \`###\` for smaller section titles.
*   **Emphasis**: Use \`**bold text**\` for emphasis on *key words or phrases only*.
*   **Lists**: Use standard markdown for ordered (\`1. \`, \`2. \`) and unordered (\`* \` or \`- \`) lists. Indent sub-lists with four spaces.
*   **CRITICAL RULE**: Do **NOT** wrap entire lines, headings, or list items in bold markers (\`**...\`**). The application handles the styling.
    *   Correct: \`# The Five Pillars\`
    *   Incorrect: \`**# The Five Pillars**\`
    *   Correct: \`1. Shahada (Faith)\`
    *   Incorrect: \`**1. Shahada (Faith)**\`
*   **Citations**: Place Quran citations like \`2:153\` within the text. Do **NOT** place citations inside of headings.

**EXAMPLE OF A COMPLETE, VALID RESPONSE:**
\`I have found some information regarding charity in the Quran.
INTERPRETATION::
# The Concept of Charity (Sadaqah)
Charity, known as **Sadaqah** in Arabic, is a cornerstone of the Islamic faith. It is not merely a recommendation but a responsibility of the believers. The Quran mentions it in numerous places, highlighting its importance for spiritual purification 9:103.

## Types of Charity
The Quran describes several forms of giving. Giving should be done without expectation of return and with a pure heart 2:264.

### Key Aspects
*   **Zakat**: An obligatory annual charity.
*   **Sadaqah**: Voluntary charity given at any time.

### Who Should Receive Charity?
1. The poor and the needy.
2. Relatives.
3. Orphans.
VERSES::[{"surah":9,"ayah":103},{"surah":2,"ayah":264}]\`

For simple greetings (like "hello" or "thank you"), just reply politely and steer back to the Quran. Do not use the special markers for these cases.`;

export const getAIResponse = async (query: string, history: Message[]): Promise<AIResponse> => {
  // Construct chat history for the model, giving it full context.
  const contents = [
    ...history.map((msg) => {
      // For AI messages, combine the acknowledgement and interpretation to form the full response context.
      const fullText = (msg.sender === 'ai' && msg.interpretation)
        ? `${msg.text}\n\n${msg.interpretation}`
        : msg.text;
      
      return {
        role: msg.sender === 'user' ? 'user' : 'model',
        parts: [{ text: fullText }],
      };
    }),
    { role: 'user', parts: [{ text: query }] },
  ];

  try {
    const response: GenerateContentResponse = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: contents,
        config: {
          systemInstruction: getSystemPrompt(),
          tools: [{googleSearch: {}}],
        }
    });
    
    const rawContent = response.text;
    const groundingChunks = response.candidates?.[0]?.groundingMetadata?.groundingChunks as GroundingChunk[] | undefined;

    // Define markers
    const interpretationMarker = 'INTERPRETATION::';
    const versesMarker = 'VERSES::';

    // Helper to extract content between markers
    const extractSection = (startMarker: string, endMarker?: string) => {
        const startIndex = rawContent.indexOf(startMarker);
        if (startIndex === -1) return '';

        let content = rawContent.substring(startIndex + startMarker.length);
        
        if (endMarker) {
            const endIndex = content.indexOf(endMarker);
            if (endIndex !== -1) {
                content = content.substring(0, endIndex);
            }
        }
        return content.trim();
    };
    
    const interpretationText = extractSection(interpretationMarker, versesMarker) || extractSection(interpretationMarker);
    const versesJson = extractSection(versesMarker);

    // Get the initial response text (everything before the first marker)
    const firstMarkerIndex = rawContent.indexOf(interpretationMarker);
    const responseText = firstMarkerIndex !== -1 ? rawContent.substring(0, firstMarkerIndex).trim() : rawContent.trim();
    
    // Parse Verses
    let versesFromMarker: VerseLocation[] | undefined;
    if (versesJson) {
        try {
            const parsedData = JSON.parse(versesJson);
            if (Array.isArray(parsedData)) {
                versesFromMarker = parsedData
                    .map(item => {
                        const surah = parseInt(item?.surah, 10);
                        const ayah = parseInt(item?.ayah, 10);
                        return (!isNaN(surah) && !isNaN(ayah) && surah > 0 && ayah > 0) ? { surah, ayah } : null;
                    })
                    .filter((item): item is VerseLocation => item !== null);
            }
        } catch (e) {
            console.error("Failed to parse verses JSON:", versesJson, e);
        }
    }

    // Fallback verse extraction from interpretation text
    const extractedVerses: VerseLocation[] = [];
    if (interpretationText) {
        // This regex specifically looks for the surah:ayah format, e.g., 2:153 or 2:255-256
        const versePattern = /\b(\d{1,3}):(\d+)(?:-(\d+))?\b/g;
        let match;
        while ((match = versePattern.exec(interpretationText)) !== null) {
            const surah = parseInt(match[1], 10);
            const startAyah = parseInt(match[2], 10);
            const endAyahStr = match[3];
            const endAyah = endAyahStr ? parseInt(endAyahStr, 10) : startAyah;

            if (!isNaN(surah) && !isNaN(startAyah) && surah > 0 && startAyah > 0) {
                for (let ayah = startAyah; ayah <= endAyah; ayah++) {
                    extractedVerses.push({ surah, ayah });
                }
            }
        }
    }

    // Combine and deduplicate verses
    const allVerses = [...(versesFromMarker || []), ...extractedVerses];
    const uniqueVerseKeys = new Set<string>();
    const uniqueVerses = allVerses.filter(v => {
        const key = `${v.surah}:${v.ayah}`;
        if (uniqueVerseKeys.has(key)) return false;
        uniqueVerseKeys.add(key);
        return true;
    });

    return {
        type: uniqueVerses.length > 0 ? 'quran_query' : 'general_chat',
        responseText: responseText || "I have found some information regarding your question.",
        interpretation: interpretationText || undefined,
        verses: uniqueVerses.length > 0 ? uniqueVerses : undefined,
        groundingChunks,
    };

  } catch (error) {
    console.error("Error calling Gemini API:", error);
    const errorMessage = error instanceof Error ? error.message : "I had trouble understanding that. Could you please rephrase your request? For example: 'Find a verse about forgiveness'.";
    throw new Error(errorMessage);
  }
};


export const translateTextToEnglish = async (text: string): Promise<string> => {
  try {
    const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: `You are an expert translator. Translate the following Arabic text into clear and accurate English. Provide only the translated text as your response, with no additional commentary or formatting. The text to translate is: "${text}"`,
    });

    return response.text.trim();
  } catch (error) {
    console.error("Error calling Gemini for translation:", error);
    throw new Error("Failed to translate the text. The AI translation service may be temporarily unavailable or not configured correctly.");
  }
};