import { GoogleGenAI, GenerateContentResponse } from "@google/genai";
import type { AIResponse, Message, GroundingChunk } from '../types';

const apiKey = process.env.API_KEY;
if (!apiKey) {
  // This error will be caught by the calling function and displayed to the user.
  throw new Error('The API_KEY environment variable is not set. Please configure it to use the AI features.');
}

const ai = new GoogleGenAI({ apiKey });

const getSystemPrompt = () => `You are a conversational guide for a Quran application. Your primary role is to help users explore the Holy Quran.

Analyze the user's input to determine their intent.

1.  **Quran Query:** If the user asks about the Quran (e.g., "what does the quran say about charity?", "show me the story of prophet Yusuf"), your process must strictly follow these steps to prevent hallucination:
    
    a.  **Search:** You **MUST** use your search tool to find reliable online sources (articles, scholarly interpretations, tafsir websites) that directly address the user's query.
    
    b.  **Extract Verses from Sources:** Carefully analyze the content of the search results. Identify any specific Quran verse citations mentioned in these sources (e.g., "Surah Al-Baqarah, verse 277", "Quran 2:277"). The verse locations you provide to the user **MUST** come exclusively from these external sources. Do not use your own internal knowledge to suggest verses. If the online sources do not provide specific verse numbers, you must not invent any.
    
    c.  **Synthesize Interpretation from Sources:** Your interpretation **MUST** be a summary of the information found in the web search results. Do not add information that is not supported by the provided sources.
    
    d.  **Format Response:** Structure your response in three parts, separated by special markers:
        
        i.  **Acknowledgement:** Start with a very brief, neutral acknowledgement. Example: "Based on my search, I have found some information and relevant verses regarding the topic of charity."
        
        ii. **Interpretation:** Add the marker \`INTERPRETATION::\`. Following this, provide your summary synthesized purely from the web search results. Your application will display source links automatically; do not mention them in your interpretation.
        
        iii. **Verses:** If and only if you found specific verse citations in your search, append the marker \`VERSES::\` at the very end, followed by a valid JSON array of verse location objects. Example: \`VERSES::[{"surah":2,"ayah":277}]\`. If no specific verses were cited in the search results, you **MUST NOT** include the \`VERSES::\` marker or any JSON.

    **Example of a complete, valid Quran response structure:**
    \`I have found some verses regarding the story of Prophet Yusuf (Joseph). INTERPRETATION::The story of Prophet Yusuf is a prominent narrative in the Quran, primarily detailed in Surah Yusuf. It covers his life from his early dreams, his betrayal by his brothers, his time in Egypt, and his eventual reunion with his family. It is often seen as a testament to patience and faith in God's plan. VERSES::[{"surah":12,"ayah":4},{"surah":12,"ayah":5},{"surah":12,"ayah":6}]\`

2.  **General Chat:** If the input is a general greeting, small talk, or unrelated to the Quran (e.g., "hello", "how are you?"), provide a polite, brief, conversational reply that gently steers the conversation back to exploring the Quran. Do **NOT** include the \`INTERPRETATION::\` or \`VERSES::\` markers.`;

export const getAIResponse = async (query: string, history: Message[]): Promise<AIResponse> => {
  // Construct chat history for the model
  const contents = [
    ...history.map((msg) => ({
      role: msg.sender === 'user' ? 'user' : 'model',
      parts: [{ text: msg.text }],
    })),
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
    
    const messageContent = response.text;
    const groundingChunks = response.candidates?.[0]?.groundingMetadata?.groundingChunks as GroundingChunk[] | undefined;

    const verseMarker = 'VERSES::';
    const interpretationMarker = 'INTERPRETATION::';

    let mainContent = messageContent;
    let verses: any[] | undefined;

    const verseMarkerIndex = mainContent.lastIndexOf(verseMarker);

    if (verseMarkerIndex !== -1) {
        mainContent = messageContent.substring(0, verseMarkerIndex).trim();
        const versesJson = messageContent.substring(verseMarkerIndex + verseMarker.length).trim();
        try {
            const parsedData = JSON.parse(versesJson);
            if (Array.isArray(parsedData)) {
                const validVerses = parsedData
                    .map(item => {
                        const surah = parseInt(item?.surah, 10);
                        const ayah = parseInt(item?.ayah, 10);
                        if (!isNaN(surah) && !isNaN(ayah) && surah > 0 && ayah > 0) {
                            return { surah, ayah };
                        }
                        return null;
                    })
                    .filter((item): item is { surah: number; ayah: number } => item !== null);
                if (validVerses.length > 0) {
                    verses = validVerses;
                }
            }
        } catch (e) {
            console.error("Failed to parse verses JSON from AI response:", versesJson, e);
        }
    }

    const interpretationMarkerIndex = mainContent.indexOf(interpretationMarker);
    let responseText = mainContent;
    let interpretation: string | undefined;

    if (interpretationMarkerIndex !== -1) {
        responseText = mainContent.substring(0, interpretationMarkerIndex).trim();
        interpretation = mainContent.substring(interpretationMarkerIndex + interpretationMarker.length).trim();
    }

    return {
        type: verses ? 'quran_query' : 'general_chat',
        responseText,
        interpretation,
        verses: verses && verses.length > 0 ? verses : undefined,
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
