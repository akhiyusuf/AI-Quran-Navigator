
import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { ChatBox } from './components/ChatBox';
import { QuranViewer, type QuranViewerRef } from './components/QuranViewer';
import { streamAIResponse, parseAIResponse, translateTextToEnglish } from './services/geminiService';
import type { Message, Surah, VerseLocation, AIResponse, ChatSession, SavedMessage, Match } from './types';
import { IconComment, IconLoader, IconBookmark, IconMessageCircle, IconPlus, IconHistory, IconStar, IconSearch, IconSettings, IconTarget, IconX, IconMenu, IconChevronsLeft, IconBook, IconChevronsRight } from './components/Icons';
import { TafsirModal } from './components/TafsirModal';
import { BookmarksPanel } from './components/BookmarksPanel';
import { HistoryPanel } from './components/HistoryPanel';
import { SavedPanel } from './components/SavedPanel';
import { DisclaimerModal } from './components/DisclaimerModal';
import { SearchControl } from './components/SearchControl';
import { useSearch } from './components/useChatSearch';
import { ThemeSwitcher, type Theme } from './components/ThemeSwitcher';
import type { GenerateContentResponse } from '@google/genai';


interface TafsirState {
  isOpen: boolean;
  surah?: number;
  ayah?: number;
  content: {
    english: string;
    arabic: string;
  };
  isLoading: boolean;
  error?: string;
}

const MobileVerseTray: React.FC<{
    verses: VerseLocation[],
    onVerseClick: (verse: VerseLocation) => void,
    isOpen: boolean,
    onClose: () => void
}> = ({ verses, onVerseClick, isOpen, onClose }) => {
    if (verses.length === 0 || !isOpen) {
        return null;
    }
    
    const sortedVerses = [...verses].sort((a, b) => {
        if (a.surah !== b.surah) return a.surah - b.surah;
        return a.ayah - b.ayah;
    });

    return (
        <div className="lg:hidden">
            {/* Overlay */}
            <div
                className="fixed inset-0 bg-[var(--overlay)] z-40"
                onClick={onClose}
                aria-hidden="true"
            ></div>
            {/* Bottom sheet */}
            <div
                id="mobile-verse-tray"
                className={`fixed bottom-0 left-0 right-0 bg-[var(--card)] rounded-t-2xl shadow-2xl p-4 z-50 transition-transform duration-300 ease-in-out ${isOpen ? 'translate-y-0' : 'translate-y-full'}`}
                role="dialog"
                aria-modal="true"
            >
                <div className="flex justify-between items-center mb-4">
                    <h3 className="font-semibold text-lg text-[var(--foreground)]">Cited Verses</h3>
                    <button onClick={onClose} className="p-2 rounded-full text-[var(--muted-foreground)] hover:bg-[var(--accent)]">
                        <IconX className="h-5 w-5" />
                    </button>
                </div>
                <div className="max-h-[40vh] overflow-y-auto">
                    <div className="flex flex-wrap gap-2">
                        {sortedVerses.map((verse, index) => (
                            <button
                                key={`${verse.surah}:${verse.ayah}:${index}`}
                                onClick={() => onVerseClick(verse)}
                                className="flex-shrink-0 px-4 py-2 text-md font-medium bg-[var(--primary-soft)] text-[var(--primary-soft-foreground)] rounded-lg hover:bg-[var(--accent)] transition-colors"
                            >
                                {verse.surah}:{verse.ayah}
                            </button>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    );
};


const initialMessages: Message[] = [];

const createNewChat = (): ChatSession => ({
    id: `chat_${Date.now()}`,
    title: "New Chat",
    messages: [...initialMessages],
    createdAt: Date.now(),
});

const App: React.FC = () => {
  const [initialState] = useState(() => {
    let savedHistory: ChatSession[] = [];
    try {
      const savedHistoryStr = localStorage.getItem('quranNavigatorHistory');
      if (savedHistoryStr) {
        savedHistory = JSON.parse(savedHistoryStr);
      }
    } catch (error) {
      console.error("Failed to load history from localStorage", error);
    }

    const newChat = createNewChat();
    const initialHistory = [newChat, ...savedHistory];
    const initialActiveChatId = newChat.id;

    return { initialHistory, initialActiveChatId };
  });
  
  const [history, setHistory] = useState<ChatSession[]>(initialState.initialHistory);
  const [activeChatId, setActiveChatId] = useState<string | null>(initialState.initialActiveChatId);
  
  const [bookmarks, setBookmarks] = useState<VerseLocation[]>(() => {
    try {
        const savedBookmarks = localStorage.getItem('quranNavigatorBookmarks');
        return savedBookmarks ? JSON.parse(savedBookmarks) : [];
    } catch (error) {
        console.error("Failed to load bookmarks from localStorage", error);
        return [];
    }
  });

  const [savedMessages, setSavedMessages] = useState<SavedMessage[]>(() => {
    try {
        const saved = localStorage.getItem('quranNavigatorSavedMessages');
        return saved ? JSON.parse(saved) : [];
    } catch (error) {
        console.error("Failed to load saved messages from localStorage", error);
        return [];
    }
  });
  
  const [theme, setTheme] = useState<Theme>(() => {
    try {
        const savedTheme = localStorage.getItem('quranNavigatorTheme') as Theme;
        return savedTheme || 'light-blue';
    } catch (error) {
        return 'light-blue';
    }
  });
  
  const [isThemeSwitcherOpen, setIsThemeSwitcherOpen] = useState(false);

  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [targetVerses, setTargetVerses] = useState<VerseLocation[]>([]);
  const [quranData, setQuranData] = useState<Surah[] | null>(null);
  const [isDataLoading, setIsDataLoading] = useState<boolean>(true);
  const [dataError, setDataError] = useState<string | null>(null);
  const [tafsirState, setTafsirState] = useState<TafsirState>({
    isOpen: false,
    content: { english: '', arabic: '' },
    isLoading: false,
  });
  const [activeTab, setActiveTab] = useState<'chat' | 'bookmarks' | 'saved'>('chat');
  const [mobileView, setMobileView] = useState<'chat' | 'viewer'>('chat');
  const [isDisclaimerOpen, setIsDisclaimerOpen] = useState<boolean>(false);
  const [isSearchVisible, setIsSearchVisible] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [networkErrorForMessageId, setNetworkErrorForMessageId] = useState<string | null>(null);
  const [isMobileTrayOpen, setIsMobileTrayOpen] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [isViewerCollapsed, setIsViewerCollapsed] = useState(false);
  const quranViewerRef = useRef<QuranViewerRef>(null);

  const activeChat = history.find(c => c.id === activeChatId);
  // Fallback to a default state if active chat disappears somehow
  const messages = activeChat ? activeChat.messages : initialMessages;

  useEffect(() => {
    // Always show the disclaimer on page load.
    setIsDisclaimerOpen(true);

    const fetchQuranData = async () => {
      try {
        const [arabicRes, englishRes] = await Promise.all([
          fetch('https://api.alquran.cloud/v1/quran/quran-uthmani'),
          fetch('https://api.alquran.cloud/v1/quran/en.sahih')
        ]);

        if (!arabicRes.ok || !englishRes.ok) {
          throw new Error('Failed to fetch Quran data from the API.');
        }

        const arabicData = await arabicRes.json();
        const englishData = await englishRes.json();

        if (arabicData.code !== 200 || englishData.code !== 200) {
            throw new Error('API returned an error while fetching Quran data.');
        }

        const mergedData = arabicData.data.surahs.map((arabicSurah: any) => {
          const englishSurah = englishData.data.surahs.find((s: any) => s.number === arabicSurah.number);
          return {
            id: arabicSurah.number,
            name: arabicSurah.name,
            transliteration: arabicSurah.englishName,
            translation: arabicSurah.englishNameTranslation,
            total_verses: arabicSurah.ayahs.length, // More robust: use the actual array length
            verses: arabicSurah.ayahs.map((ayah: any, index: number) => ({
              id: ayah.numberInSurah,
              text: ayah.text,
              translation: englishSurah?.ayahs?.[index]?.text || '', // Safeguard against mismatches
            })),
          };
        });
        setQuranData(mergedData);
      } catch (error) {
        console.error(error);
        setDataError("Could not load the Quran data. Please check your internet connection and try again.");
      } finally {
        setIsDataLoading(false);
      }
    };
    fetchQuranData();
  }, []);
  
  useEffect(() => {
    try {
        const historyToSave = history.filter(chat => {
            // A "New Chat" with no messages is a temporary one and shouldn't be saved.
            // It gets a new title and messages upon first user interaction, at which point it's persisted.
            if (chat.title === "New Chat" && chat.messages.length === 0) {
                return false;
            }
            return true;
        });
        localStorage.setItem('quranNavigatorHistory', JSON.stringify(historyToSave));
    } catch (error) {
        console.error("Failed to save history to localStorage", error);
    }
  }, [history]);

  useEffect(() => {
    try {
        localStorage.setItem('quranNavigatorBookmarks', JSON.stringify(bookmarks));
    } catch (error) {
        console.error("Failed to save bookmarks to localStorage", error);
    }
  }, [bookmarks]);

  useEffect(() => {
    try {
        localStorage.setItem('quranNavigatorSavedMessages', JSON.stringify(savedMessages));
    } catch (error) {
        console.error("Failed to save messages to localStorage", error);
    }
  }, [savedMessages]);
  
  useEffect(() => {
    try {
      document.documentElement.setAttribute('data-theme', theme);
      localStorage.setItem('quranNavigatorTheme', theme);
    } catch (error) {
        console.error("Failed to set theme", error);
    }
  }, [theme]);
  
  const handleNewChat = useCallback(() => {
    const currentChat = history.find(c => c.id === activeChatId);

    // If the active chat is already a fresh, unsaved "New Chat", just switch to it.
    if (currentChat?.title === "New Chat" && currentChat?.messages.length === initialMessages.length) {
        setActiveTab('chat');
        return;
    }

    const newChat = createNewChat();

    setHistory(prevHistory => [newChat, ...prevHistory]);
    setActiveChatId(newChat.id);
    setTargetVerses([]);
    setActiveTab('chat');
    setIsSidebarOpen(false);
  }, [history, activeChatId]);

  const handleSendMessage = useCallback(async (userMessage: string) => {
    if (!activeChatId || !quranData) return;

    setNetworkErrorForMessageId(null);
    setIsLoading(true);

    const userMessageObject: Message = { id: `msg_user_${Date.now()}`, sender: 'user', text: userMessage };
    const aiMessagePlaceholder: Message = { id: `msg_ai_${Date.now()}`, sender: 'ai', text: '' };
    const currentChatId = activeChatId;

    const currentMessages = history.find(c => c.id === currentChatId)?.messages || [];
    const historyForAI = [...currentMessages, userMessageObject];

    setHistory(prevHistory => {
        return prevHistory.map(chat => {
            if (chat.id === currentChatId) {
                const updatedChat = { ...chat };
                if (chat.title === "New Chat" && chat.messages.length === initialMessages.length) {
                    updatedChat.title = userMessage.length > 30 ? `${userMessage.substring(0, 27)}...` : userMessage;
                }
                updatedChat.messages = [...currentMessages, userMessageObject, aiMessagePlaceholder];
                return updatedChat;
            }
            return chat;
        });
    });
    
    try {
      let fullText = "";
      let finalResponse: GenerateContentResponse | null = null;
      
      const stream = streamAIResponse(historyForAI);

      for await (const chunk of stream) {
        const chunkText = chunk.text;
        if (chunkText) {
          const words = chunkText.split(/(\s+)/);
          for (const word of words) {
              if (word === '') continue;
              fullText += word;
              
              const interpretationMarker = 'INTERPRETATION::';
              const versesMarker = 'VERSES::';
              let streamingInterpretation: string | undefined = undefined;

              const interpretationIndex = fullText.indexOf(interpretationMarker);
              const versesIndex = fullText.lastIndexOf(versesMarker);

              if (interpretationIndex !== -1) {
                  // Format is correct
                  const contentStart = interpretationIndex + interpretationMarker.length;
                  streamingInterpretation = (versesIndex > contentStart)
                      ? fullText.substring(contentStart, versesIndex)
                      : fullText.substring(contentStart);
              } else if (fullText.length > 50) { // Fallback after 50 chars
                  // Format is likely incorrect, treat all text as interpretation
                  streamingInterpretation = (versesIndex !== -1)
                      ? fullText.substring(0, versesIndex)
                      : fullText;
              }
              
              setHistory(prevHistory =>
                prevHistory.map(chat => {
                  if (chat.id === currentChatId) {
                    const newMessages = chat.messages.map(msg =>
                      msg.id === aiMessagePlaceholder.id ? { 
                          ...msg, 
                          text: '',
                          interpretation: streamingInterpretation?.trimStart() 
                        } : msg
                    );
                    return { ...chat, messages: newMessages };
                  }
                  return chat;
                })
              );

              await new Promise(resolve => setTimeout(resolve, 10));
          }
        }
        finalResponse = chunk;
      }

      const groundingChunks = finalResponse?.candidates?.[0]?.groundingMetadata?.groundingChunks;
      const parsedData = parseAIResponse(fullText, groundingChunks);
      
      setHistory(prevHistory =>
        prevHistory.map(chat => {
          if (chat.id === currentChatId) {
            const newMessages = chat.messages.map(msg =>
              msg.id === aiMessagePlaceholder.id 
                ? { 
                    ...msg,
                    text: parsedData.responseText,
                    interpretation: parsedData.interpretation,
                    groundingChunks: parsedData.groundingChunks,
                    verses: parsedData.verses,
                    rawContent: parsedData.rawContent,
                  } 
                : msg
            );
            return { ...chat, messages: newMessages };
          }
          return chat;
        })
      );
      
      if (parsedData.verses && parsedData.verses.length > 0) {
        setTargetVerses(parsedData.verses);
      }

    } catch (error) {
      setHistory(prevHistory => prevHistory.map(chat =>
        chat.id === currentChatId
          ? { ...chat, messages: chat.messages.filter(msg => msg.id !== aiMessagePlaceholder.id) }
          : chat
      ));
      if (error instanceof Error && error.message.includes('Rpc failed')) {
          console.error("Network Error Detected:", error);
          setNetworkErrorForMessageId(userMessageObject.id);
      }
    } finally {
        setIsLoading(false);
    }
  }, [activeChatId, history, quranData]);

  const handleRetry = useCallback(async (messageToRetry: Message) => {
    if (!activeChatId || !quranData) return;
    
    setNetworkErrorForMessageId(null);
    setIsLoading(true);

    const currentChatId = activeChatId;
    const chatForAIContext = history.find(c => c.id === currentChatId);
    if (!chatForAIContext) {
        setIsLoading(false);
        return;
    }
    
    const historyForAI = chatForAIContext.messages.slice(0, chatForAIContext.messages.findIndex(m => m.id === messageToRetry.id) + 1);
    const aiMessagePlaceholder: Message = { id: `msg_ai_${Date.now()}`, sender: 'ai', text: '' };

    setHistory(prevHistory => prevHistory.map(chat => 
        chat.id === currentChatId
            ? { ...chat, messages: [...chat.messages, aiMessagePlaceholder] }
            : chat
    ));

    try {
      let fullText = "";
      let finalResponse: GenerateContentResponse | null = null;
      
      const stream = streamAIResponse(historyForAI);

      for await (const chunk of stream) {
        const chunkText = chunk.text;
        if (chunkText) {
            const words = chunkText.split(/(\s+)/);
            for (const word of words) {
              if (word === '') continue;
              fullText += word;
              
              const interpretationMarker = 'INTERPRETATION::';
              const versesMarker = 'VERSES::';
              let streamingInterpretation: string | undefined = undefined;

              const interpretationIndex = fullText.indexOf(interpretationMarker);
              const versesIndex = fullText.lastIndexOf(versesMarker);

              if (interpretationIndex !== -1) {
                  // Format is correct
                  const contentStart = interpretationIndex + interpretationMarker.length;
                  streamingInterpretation = (versesIndex > contentStart)
                      ? fullText.substring(contentStart, versesIndex)
                      : fullText.substring(contentStart);
              } else if (fullText.length > 50) { // Fallback after 50 chars
                  // Format is likely incorrect, treat all text as interpretation
                  streamingInterpretation = (versesIndex !== -1)
                      ? fullText.substring(0, versesIndex)
                      : fullText;
              }
              
              setHistory(prevHistory =>
                prevHistory.map(chat => {
                  if (chat.id === currentChatId) {
                    const newMessages = chat.messages.map(msg =>
                      msg.id === aiMessagePlaceholder.id ? { 
                          ...msg, 
                          text: '',
                          interpretation: streamingInterpretation?.trimStart()
                        } : msg
                    );
                    return { ...chat, messages: newMessages };
                  }
                  return chat;
                })
              );

              await new Promise(resolve => setTimeout(resolve, 10));
          }
        }
        finalResponse = chunk;
      }

      const groundingChunks = finalResponse?.candidates?.[0]?.groundingMetadata?.groundingChunks;
      const parsedData = parseAIResponse(fullText, groundingChunks);
      
      setHistory(prevHistory =>
        prevHistory.map(chat => {
          if (chat.id === currentChatId) {
            const newMessages = chat.messages.map(msg =>
              msg.id === aiMessagePlaceholder.id 
                ? { 
                    ...msg,
                    text: parsedData.responseText,
                    interpretation: parsedData.interpretation,
                    groundingChunks: parsedData.groundingChunks,
                    verses: parsedData.verses,
                    rawContent: parsedData.rawContent,
                  } 
                : msg
            );
            return { ...chat, messages: newMessages };
          }
          return chat;
        })
      );
      
      if (parsedData.verses && parsedData.verses.length > 0) {
        setTargetVerses(parsedData.verses);
      }
    } catch (error) {
        setHistory(prevHistory => prevHistory.map(chat =>
            chat.id === currentChatId
            ? { ...chat, messages: chat.messages.filter(msg => msg.id !== aiMessagePlaceholder.id) }
            : chat
        ));
         if (error instanceof Error && error.message.includes('Rpc failed')) {
            console.error("Network Error on Retry:", error);
            setNetworkErrorForMessageId(messageToRetry.id);
        }
    } finally {
        setIsLoading(false);
    }
  }, [activeChatId, history, quranData]);


  const handleToggleBookmark = useCallback((verse: VerseLocation) => {
    setBookmarks(prev => {
        const isBookmarked = prev.some(b => b.surah === verse.surah && b.ayah === verse.ayah);
        if (isBookmarked) {
            return prev.filter(b => !(b.surah === verse.surah && b.ayah === verse.ayah));
        } else {
            return [...prev, verse].sort((a, b) => {
                if (a.surah !== b.surah) return a.surah - b.surah;
                return a.ayah - b.ayah;
            });
        }
    });
  }, []);

  const handleToggleSaveMessage = useCallback((message: Message) => {
    setSavedMessages(prev => {
        const isSaved = prev.some(sm => sm.id === message.id);
        if (isSaved) {
            return prev.filter(sm => sm.id !== message.id);
        } else {
            if (!activeChat) return prev; // Should not happen if button is visible
            const newSavedMessage: SavedMessage = {
                id: message.id,
                chatId: activeChat.id,
                chatTitle: activeChat.title,
                message: message,
                savedAt: Date.now(),
            };
            // Add new saved message and sort by saved date
            return [...prev, newSavedMessage].sort((a, b) => b.savedAt - a.savedAt);
        }
    });
  }, [activeChat]);

  const handleBookmarkClick = useCallback((verse: VerseLocation) => {
      setTargetVerses([verse]);
      if (isViewerCollapsed) setIsViewerCollapsed(false);
      if (window.innerWidth < 1024) {
        setMobileView('viewer');
      }
      // Add a delay to ensure the viewer is visible before scrolling
      setTimeout(() => quranViewerRef.current?.scrollToVerse(verse), 100);
  }, [isViewerCollapsed]);
  
  const handleViewVerses = useCallback((verses: VerseLocation[]) => {
      setTargetVerses(verses);
      if (isViewerCollapsed) setIsViewerCollapsed(false);
      if (window.innerWidth < 1024) {
        setMobileView('viewer');
      }
      // Add a delay to ensure the viewer is visible before scrolling
      if (verses.length > 0) {
        setTimeout(() => quranViewerRef.current?.scrollToVerse(verses[0]), 100);
      }
  }, [isViewerCollapsed]);

  const handleShowCitedVerses = useCallback((verses: VerseLocation[]) => {
    setTargetVerses(verses);
    if (isViewerCollapsed) setIsViewerCollapsed(false);
    // On desktop, just scroll. On mobile, open the tray.
    if (window.innerWidth >= 1024) {
      if (verses.length > 0) {
        setMobileView('viewer');
        // A short delay ensures the viewer is visible before scrolling
        setTimeout(() => quranViewerRef.current?.scrollToVerse(verses[0]), 50);
      }
    } else {
      setIsMobileTrayOpen(true);
      // Ensure chat view is active so the user can see the tray open
      setMobileView('chat'); 
    }
  }, [isViewerCollapsed]);

  const handleShowTafsir = useCallback(async (surah: number, ayah: number) => {
    setTafsirState({ isOpen: true, surah, ayah, isLoading: true, content: { english: '', arabic: '' }, error: undefined });
    try {
      const arabicRes = await fetch(`https://api.alquran.cloud/v1/ayah/${surah}:${ayah}/ar.muyassar`);

      if (!arabicRes.ok) throw new Error("Failed to fetch Arabic Tafsir data from the API.");
      
      const arabicData = await arabicRes.json();
      if (arabicData.code !== 200 || !arabicData.data.text) throw new Error("Tafsir was not found for this verse.");
      
      const arabicTafsir = arabicData.data.text;
      setTafsirState(prev => ({ ...prev, content: { ...prev.content, arabic: arabicTafsir } }));
      
      const englishTafsir = await translateTextToEnglish(arabicTafsir);
      setTafsirState(prev => ({ ...prev, isLoading: false, content: { ...prev.content, english: englishTafsir }}));

    } catch (error) {
      const message = error instanceof Error ? error.message : "An unknown error occurred.";
      setTafsirState(prev => ({ ...prev, isLoading: false, error: message }));
    }
  }, []);

  const handleCloseTafsir = useCallback(() => {
    setTafsirState({ isOpen: false, isLoading: false, content: { english: '', arabic: '' } });
  }, []);

  const handleSelectChat = useCallback((id: string) => {
    setActiveChatId(id);
    setActiveTab('chat');
    setIsSidebarOpen(false); // Close sidebar on mobile after selection
  }, []);

  const handleDeleteChat = useCallback((id: string) => {
    if (window.confirm('Are you sure you want to delete this conversation?')) {
        setHistory(prev => {
            const newHistory = prev.filter(c => c.id !== id);
            // If the deleted chat was active, activate the next available one or create a new one.
            if (activeChatId === id) {
                if (newHistory.length > 0) {
                    setActiveChatId(newHistory[0].id);
                } else {
                    const newChat = createNewChat();
                    setActiveChatId(newChat.id);
                    return [newChat];
                }
            }
            return newHistory;
        });
    }
  }, [activeChatId]);

  const handleCloseDisclaimer = useCallback(() => {
    setIsDisclaimerOpen(false);
  }, []);

  // Universal search logic
  const textSelectors = useMemo(() => ({
    history: (session: ChatSession) => {
      const messageContent = session.messages
        .map(msg => [msg.text, msg.interpretation].filter(Boolean).join('\n'))
        .join('\n\n');
      return [session.title, messageContent].join('\n\n');
    },
  }), []);
  
  const idSelectors = {
    history: (session: ChatSession) => session.id,
  };

  const historySearchResults = useSearch(history, searchTerm, textSelectors.history, idSelectors.history);
  
  const AppSidebar = (
    <div className={`flex flex-col bg-[var(--muted)] text-[var(--foreground)] border-r border-[var(--border)] h-full overflow-hidden transition-all duration-300 ${isSidebarCollapsed ? 'w-20' : 'w-72'}`}>
        <header className="p-2 flex-shrink-0 h-[73px] flex items-center">
            <button
                onClick={() => setIsSidebarCollapsed(p => !p)}
                className="p-3 rounded-md text-[var(--muted-foreground)] hover:bg-[var(--accent)] hover:text-[var(--foreground)] hidden lg:flex"
                aria-label={isSidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"}
                title={isSidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"}
            >
                <IconMenu className="h-6 w-6" />
            </button>
        </header>

        <div className="flex flex-col flex-grow min-h-0 px-2 overflow-y-auto">
            <div className="space-y-1 flex-shrink-0">
                <button
                    onClick={handleNewChat}
                    className={`flex items-center gap-3 w-full p-3 rounded-md font-medium text-sm transition-colors duration-200 ${isSidebarCollapsed ? 'justify-center' : ''} bg-[var(--primary)] text-[var(--primary-foreground)] hover:bg-[var(--primary-hover)]`}
                    title="New Chat"
                >
                    <IconPlus className="h-5 w-5 flex-shrink-0" />
                    <span className={`whitespace-nowrap ${isSidebarCollapsed ? 'hidden' : ''}`}>New Chat</span>
                </button>
                <button 
                    onClick={() => setActiveTab('chat')} 
                    className={`flex items-center gap-3 w-full p-3 rounded-md font-medium text-sm transition-colors duration-200 ${isSidebarCollapsed ? 'justify-center' : ''} ${activeTab === 'chat' ? 'bg-[var(--primary-soft)] text-[var(--primary-soft-foreground)]' : 'text-[var(--muted-foreground)] hover:text-[var(--foreground)] hover:bg-[var(--accent)]'}`}
                    title="Chat History"
                >
                    <IconMessageCircle className="h-5 w-5 flex-shrink-0" />
                    <span className={`whitespace-nowrap ${isSidebarCollapsed ? 'hidden' : ''}`}>History</span>
                </button>
                <button 
                    onClick={() => setActiveTab('bookmarks')}
                    className={`flex items-center gap-3 w-full p-3 rounded-md font-medium text-sm transition-colors duration-200 ${isSidebarCollapsed ? 'justify-center' : ''} ${activeTab === 'bookmarks' ? 'bg-[var(--primary-soft)] text-[var(--primary-soft-foreground)]' : 'text-[var(--muted-foreground)] hover:text-[var(--foreground)] hover:bg-[var(--accent)]'}`}
                    title="Bookmarks"
                >
                    <IconBookmark className="h-5 w-5 flex-shrink-0" />
                    <span className={`whitespace-nowrap ${isSidebarCollapsed ? 'hidden' : ''}`}>Bookmarks</span>
                </button>
                <button 
                    onClick={() => setActiveTab('saved')}
                    className={`flex items-center gap-3 w-full p-3 rounded-md font-medium text-sm transition-colors duration-200 ${isSidebarCollapsed ? 'justify-center' : ''} ${activeTab === 'saved' ? 'bg-[var(--primary-soft)] text-[var(--primary-soft-foreground)]' : 'text-[var(--muted-foreground)] hover:text-[var(--foreground)] hover:bg-[var(--accent)]'}`}
                    title="Saved"
                >
                    <IconStar className="h-5 w-5 flex-shrink-0" />
                    <span className={`whitespace-nowrap ${isSidebarCollapsed ? 'hidden' : ''}`}>Saved</span>
                </button>
            </div>
            
            <div className={`flex flex-col flex-grow min-h-0 pt-2 ${isSidebarCollapsed ? 'hidden' : ''}`}>
                <SearchControl 
                    isSearchVisible={true}
                    searchTerm={searchTerm}
                    onSearchTermChange={setSearchTerm}
                    totalMatches={historySearchResults.totalMatches}
                    currentMatchIndex={historySearchResults.activeMatch ? historySearchResults.activeMatch.globalIndex + 1 : 0}
                    onPrev={historySearchResults.goToPrev}
                    onNext={historySearchResults.goToNext}
                    onClose={() => setSearchTerm('')}
                />
                <div className="flex-grow min-h-0 mt-2 border-t border-[var(--border)]">
                    {activeTab === 'chat' && (
                        <HistoryPanel
                            history={history}
                            activeChatId={activeChatId}
                            onSelectChat={handleSelectChat}
                            onDeleteChat={handleDeleteChat}
                            searchTerm={searchTerm}
                            activeMatch={historySearchResults.activeMatch}
                        />
                    )}
                    {activeTab === 'bookmarks' && (
                        <BookmarksPanel
                            bookmarks={bookmarks}
                            quranData={quranData}
                            onBookmarkClick={handleBookmarkClick}
                            onRemoveBookmark={handleToggleBookmark}
                            searchTerm={""}
                            activeMatch={null}
                        />
                    )}
                    {activeTab === 'saved' && (
                        <SavedPanel
                            savedMessages={savedMessages}
                            onGoToChat={handleSelectChat}
                            onRemoveSaved={handleToggleSaveMessage}
                            searchTerm={""}
                            activeMatch={null}
                        />
                    )}
                </div>
            </div>
        </div>
        
        <footer className="p-2 border-t border-[var(--border)] flex-shrink-0">
             <div className="relative">
                <button
                    onClick={() => setIsThemeSwitcherOpen(v => !v)}
                    className={`flex items-center gap-3 w-full p-3 rounded-md font-medium text-sm transition-colors duration-200 text-[var(--muted-foreground)] hover:text-[var(--foreground)] hover:bg-[var(--accent)] ${isSidebarCollapsed ? 'justify-center' : ''}`}
                    aria-label="Change theme"
                    title="Change theme"
                >
                    <IconSettings className="h-5 w-5 flex-shrink-0" />
                    <span className={`whitespace-nowrap ${isSidebarCollapsed ? 'hidden' : ''}`}>Theme</span>
                </button>
                {isThemeSwitcherOpen && (
                    <ThemeSwitcher 
                        currentTheme={theme} 
                        onThemeChange={setTheme}
                        onClose={() => setIsThemeSwitcherOpen(false)}
                    />
                )}
            </div>
        </footer>
    </div>
  );

  if (isDataLoading) {
    return (
      <div className="flex h-screen w-screen bg-[var(--muted)] flex-col items-center justify-center text-[var(--muted-foreground)]">
        <IconLoader className="h-12 w-12 animate-spin mb-4" />
        <h1 className="text-xl font-semibold text-[var(--foreground)]">Loading the Holy Quran...</h1>
        <p>Please wait a moment.</p>
      </div>
    );
  }

  if (dataError) {
    return (
      <div className="flex h-screen w-screen bg-[var(--muted)] flex-col items-center justify-center text-center p-4">
        <h1 className="text-xl font-semibold text-[var(--destructive)]">Failed to Load Data</h1>
        <p className="text-[var(--muted-foreground)] mt-2">{dataError}</p>
      </div>
    );
  }

  if (!quranData) {
    return null;
  }
  
  const MainContent = (
    <div className="flex-1 flex flex-col h-full min-w-0 bg-[var(--card)]">
        <header className="p-2 border-b border-[var(--border)] flex items-center lg:hidden">
            <button onClick={() => setIsSidebarOpen(true)} className="p-2 rounded-full text-[var(--muted-foreground)] hover:bg-[var(--accent)]">
                <IconMenu className="h-6 w-6" />
            </button>
            <h2 className="font-semibold text-lg mx-auto">{activeChat?.title || "AI Quran Navigator"}</h2>
            <div className="w-10"></div>
        </header>
        <div className="flex-grow min-h-0">
            {activeTab === 'chat' && (
              <ChatBox
                  messages={messages}
                  onSendMessage={handleSendMessage}
                  isLoading={isLoading}
                  savedMessages={savedMessages}
                  onToggleSave={handleToggleSaveMessage}
                  searchTerm={""} // Search is handled in history now
                  activeMatch={null}
                  networkErrorForMessageId={networkErrorForMessageId}
                  onRetry={handleRetry}
                  onViewVerses={handleViewVerses}
                  onShowCitedVerses={handleShowCitedVerses}
                />
            )}
            {activeTab === 'bookmarks' && (
              <BookmarksPanel
                  bookmarks={bookmarks}
                  quranData={quranData}
                  onBookmarkClick={handleBookmarkClick}
                  onRemoveBookmark={handleToggleBookmark}
                  searchTerm={""} // Search not implemented for this panel yet
                  activeMatch={null}
              />
            )}
            {activeTab === 'saved' && (
                <SavedPanel
                    savedMessages={savedMessages}
                    onGoToChat={handleSelectChat}
                    onRemoveSaved={handleToggleSaveMessage}
                    searchTerm={""} // Search not implemented for this panel yet
                    activeMatch={null}
                />
            )}
        </div>
    </div>
  );

  return (
    <>
      <DisclaimerModal isOpen={isDisclaimerOpen} onClose={handleCloseDisclaimer} />
      <div className="flex h-screen w-screen bg-[var(--muted)] text-[var(--foreground)] overflow-hidden relative">
        
        {/* Mobile Sidebar Overlay */}
        {isSidebarOpen && (
            <div className="lg:hidden fixed inset-0 z-50">
                <div className="fixed inset-0 bg-black/60" onClick={() => setIsSidebarOpen(false)}></div>
                <div className="absolute top-0 left-0 h-full z-10">
                    {AppSidebar}
                </div>
            </div>
        )}

        {/* Main layout container */}
        <div className="flex w-full h-full">
            <div className="hidden lg:flex flex-shrink-0">
                {AppSidebar}
            </div>
            
            <div className="flex flex-1 min-w-0">
                <div className={`${mobileView === 'chat' ? 'flex' : 'hidden'} lg:flex flex-col h-full transition-all duration-300 ${isViewerCollapsed ? 'w-full' : 'w-full lg:w-3/4'}`}>
                    {MainContent}
                </div>
                
                <main className={`${mobileView === 'viewer' ? 'flex' : 'hidden'} lg:flex relative flex-col overflow-hidden h-full transition-all duration-300 ${isViewerCollapsed ? 'w-0 min-w-0' : 'w-full lg:w-1/4'}`}>
                  <QuranViewer
                    ref={quranViewerRef}
                    quranData={quranData}
                    targetVerses={targetVerses}
                    onShowTafsir={handleShowTafsir}
                    bookmarks={bookmarks}
                    onToggleBookmark={handleToggleBookmark}
                    onBackToChat={() => setMobileView('chat')}
                    onCollapse={() => setIsViewerCollapsed(true)}
                  />
                </main>
                
                {isViewerCollapsed && (
                    <div className="hidden lg:block absolute top-0 right-0 h-full z-20">
                      <button
                        onClick={() => setIsViewerCollapsed(false)}
                        className="h-full flex items-center justify-center bg-[var(--card)] border-l border-[var(--border)] text-[var(--muted-foreground)] hover:bg-[var(--accent)] hover:text-[var(--foreground)] transition-colors px-1 shadow-lg"
                        title="Expand Viewer"
                      >
                        <div className="flex items-center gap-2 -rotate-90 whitespace-nowrap py-4">
                            <IconBook className="h-5 w-5 rotate-90" />
                            <span className="text-sm font-semibold">Quran Viewer</span>
                        </div>
                      </button>
                    </div>
                )}
            </div>
        </div>
      </div>
      <TafsirModal 
        isOpen={tafsirState.isOpen}
        onClose={handleCloseTafsir}
        surah={tafsirState.surah}
        ayah={tafsirState.ayah}
        content={tafsirState.content}
        isLoading={tafsirState.isLoading}
        error={tafsirState.error}
      />
      <MobileVerseTray
            verses={targetVerses}
            onVerseClick={(verse) => {
                setMobileView('viewer');
                setIsMobileTrayOpen(false);
                // Add a delay to ensure view has switched before scrolling
                setTimeout(() => {
                    quranViewerRef.current?.scrollToVerse(verse);
                }, 100);
            }}
            isOpen={isMobileTrayOpen}
            onClose={() => setIsMobileTrayOpen(false)}
        />
    </>
  );
};

export default App;
