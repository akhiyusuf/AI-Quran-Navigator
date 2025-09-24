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
  sender: 'user' | 'ai';
  text: string;
  interpretation?: string;
  groundingChunks?: GroundingChunk[];
  verses?: VerseLocation[];
}

export interface VerseLocation {
  surah: number;
  ayah: number;
}

export interface AIResponse {
  type: 'quran_query' | 'general_chat';
  responseText: string;
  interpretation?: string;
  verses?: VerseLocation[];
  groundingChunks?: GroundingChunk[];
}

export interface ChatSession {
  id: string;
  title: string;
  messages: Message[];
  createdAt: number;
}