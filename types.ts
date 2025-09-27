export interface Ayah {
  id: number;
  text: string;
  translation: string;
}

export interface Surah {
  id: number;
  name: string;
  transliteration: string;
  translation: string;
  total_verses: number;
  verses: Ayah[];
}

export interface GroundingChunk {
  web: {
    uri: string;
    title: string;
  };
}

export interface Message {
  id: string;
  sender: 'user' | 'ai';
  text: string;
  interpretation?: string;
  groundingChunks?: GroundingChunk[];
  verses?: VerseLocation[];
  rawContent?: string;
}

export interface VerseLocation {
  surah: number;
  ayah: number;
}

export interface AIResponse {
  type: 'quran_query' | 'general_chat';
  responseText: string;
  interpretation?: string;
  rawContent?: string;
  verses?: VerseLocation[];
  groundingChunks?: GroundingChunk[];
}

export interface ChatSession {
  id: string;
  title: string;
  messages: Message[];
  createdAt: number;
}

export interface SavedMessage {
  id: string; // Corresponds to Message.id
  chatId: string;
  chatTitle: string;
  message: Message;
  savedAt: number;
}

// Represents one found occurrence of the search term.
export interface Match<K> {
  itemId: K; // The ID of the item where the match was found.
  occurrenceInItem: number; // 0-based index of this match within its parent item's text.
  globalIndex: number; // 0-based index of this match in the grand scheme of all matches.
}