
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { ChatBox } from './components/ChatBox';
import { QuranViewer } from './components/QuranViewer';
import { getAIResponse, translateTextToEnglish } from './services/geminiService';
import type { Message, Surah, VerseLocation, AIResponse, ChatSession, SavedMessage, Match } from './types';
import { IconBook, IconLoader, IconBookmark, IconMessageCircle, IconPlus, IconHistory, IconStar, IconSearch } from './components/Icons';
import { TafsirModal } from './components/TafsirModal';
import { BookmarksPanel } from './components/BookmarksPanel';
import { HistoryPanel } from './components/HistoryPanel';
import { SavedPanel } from './components/SavedPanel';
import { DisclaimerModal } from './components/DisclaimerModal';
import { SearchControl } from './components/SearchControl';
import { useSearch } from './components/useChatSearch';

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

const initialMessages: Message[] = [];

const App: React.FC = () => {
  const [history, setHistory] = useState<ChatSession[]>(() => {
    try {
      const savedHistory = localStorage.getItem('quranNavigatorHistory');
      return savedHistory ? JSON.parse(savedHistory) : [];
    } catch (error) {
      console.error("Failed to load history from localStorage", error);
      return [];
    }
  });

  const [activeChatId, setActiveChatId] = useState<string | null>(() => {
     try {
      const savedHistory = localStorage.getItem('quranNavigatorHistory');
      if (savedHistory) {
        const parsedHistory = JSON.parse(savedHistory);
        if (Array.isArray(parsedHistory) && parsedHistory.length > 0) {
            return parsedHistory[0].id;
        }
      }
    } catch (error) {
        console.error("Failed to set active chat from localStorage", error);
    }
    // If no history, we'll create a new chat on first load.
    return null;
  });

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
  const [activeTab, setActiveTab] = useState<'chat' | 'history' | 'bookmarks' | 'saved'>('chat');
  const [mobileView, setMobileView] = useState<'chat' | 'viewer'>('chat');
  const [isDisclaimerOpen, setIsDisclaimerOpen] = useState<boolean>(false);
  const [isSearchVisible, setIsSearchVisible] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [networkErrorForMessageId, setNetworkErrorForMessageId] = useState<string | null>(null);

  useEffect(() => {
    // If there's no active chat and no history, create the first one.
    if (!activeChatId && history.length === 0) {
        const newChat: ChatSession = {
            id: `chat_${Date.now()}`,
            title: "New Chat",
            messages: [...initialMessages],
            createdAt: Date.now(),
        };
        setHistory([newChat]);
        setActiveChatId(newChat.id);
    }
  }, []); // Run only once on initial mount


  const activeChat = history.find(c => c.id === activeChatId);
  // Fallback to a default state if active chat disappears somehow
  const messages = activeChat ? activeChat.messages : initialMessages;

  useEffect(() => {
    try {
        const disclaimerAcknowledged = localStorage.getItem('quranNavigatorDisclaimerAcknowledged');
        if (!disclaimerAcknowledged) {
            setIsDisclaimerOpen(true);
        }
    } catch (error) {
        console.error("Failed to read from localStorage", error);
        // If localStorage is blocked, show disclaimer every time.
        setIsDisclaimerOpen(true);
    }

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
        localStorage.setItem('quranNavigatorHistory', JSON.stringify(history));
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
  
  const handleNewChat = useCallback(() => {
    const currentChat = history.find(c => c.id === activeChatId);

    // If the active chat is already a fresh, unsaved "New Chat", just switch to it.
    if (currentChat?.title === "New Chat" && currentChat?.messages.length === initialMessages.length) {
        setActiveTab('chat');
        return;
    }

    const newChat: ChatSession = {
        id: `chat_${Date.now()}`,
        title: "New Chat",
        messages: [...initialMessages],
        createdAt: Date.now(),
    };

    setHistory(prevHistory => [newChat, ...prevHistory]);
    setActiveChatId(newChat.id);
    setTargetVerses([]);
    setActiveTab('chat');
  }, [history, activeChatId]);

  const processAIResponse = useCallback(async (userQuery: string, forChatId: string) => {
    if (!quranData) return;
    setIsLoading(true);

    const chatForAIContext = history.find(c => c.id === forChatId);
    if (!chatForAIContext) {
        console.error("Active chat not found in history for AI processing.");
        setIsLoading(false);
        return;
    }

    try {
      const result: AIResponse = await getAIResponse(userQuery, chatForAIContext.messages);
      
      let versesForMessage: VerseLocation[] | undefined = undefined;
      let followUpErrorMessage: Message | undefined = undefined;

      if (result.type === 'quran_query' && result.verses && result.verses.length > 0) {
        const validVerses = result.verses.filter(verse => {
          const surahExists = quranData && verse.surah > 0 && quranData.length >= verse.surah;
          if (!surahExists) {
            console.warn(`AI returned an invalid surah number: ${verse.surah}.`);
            return false;
          }
          
          const ayahExists = verse.ayah > 0 && quranData[verse.surah - 1].total_verses >= verse.ayah;
          if (!ayahExists) {
            console.warn(`AI returned an invalid ayah number (${verse.ayah}) for surah ${verse.surah}.`);
            return false;
          }
          return true;
        });

        if (validVerses.length > 0) {
          versesForMessage = validVerses;
        } else {
          console.error("AI returned verse locations, but none were valid after checking against Quran data:", JSON.stringify(result.verses));
          followUpErrorMessage = { id: `msg_err_${Date.now()}_validation`, sender: 'ai', text: "I found a reference, but I couldn't pinpoint the exact verse in my copy of the text. Please try a different query." };
        }
      }

      const aiMessage: Message = {
        id: `msg_ai_${Date.now()}`,
        sender: 'ai',
        text: result.responseText,
        interpretation: result.interpretation,
        groundingChunks: result.groundingChunks,
        verses: versesForMessage,
      };

      setHistory(prevHistory => prevHistory.map(chat => {
          if (chat.id === forChatId) {
              const newMessages = [...chat.messages, aiMessage];
              if (followUpErrorMessage) {
                  newMessages.push(followUpErrorMessage);
              }
              return { ...chat, messages: newMessages };
          }
          return chat;
      }));
      
      if (versesForMessage && window.innerWidth >= 1024) {
        setTargetVerses(versesForMessage);
      }

    } catch (error) {
      console.error('Error processing AI request:', error);
      // Let the caller handle network errors, but post a message for AI-side errors.
      if (error instanceof Error && !error.message.includes('Rpc failed')) {
        const errorMessageText = error.message;
        const errorMsg: Message = { id: `msg_err_${Date.now()}`, sender: 'ai', text: errorMessageText };
        setHistory(prevHistory => prevHistory.map(chat => 
            chat.id === forChatId 
              ? { ...chat, messages: [...chat.messages, errorMsg] }
              : chat
          ));
      }
      // Re-throw so the caller can detect network issues
      throw error;
    } finally {
      setIsLoading(false);
    }
  }, [quranData, history]);

  const handleSendMessage = useCallback(async (userMessage: string) => {
    if (!activeChatId) return;

    // Clear any previous network error on a new message attempt
    setNetworkErrorForMessageId(null);

    const userMessageObject: Message = { id: `msg_user_${Date.now()}`, sender: 'user', text: userMessage };
    const currentChatId = activeChatId;

    // Optimistically add user message to history
    setHistory(prevHistory =>
        prevHistory.map(chat => {
            if (chat.id === currentChatId) {
                const updatedChat = { ...chat };
                if (chat.title === "New Chat" && chat.messages.length === initialMessages.length) {
                    updatedChat.title = userMessage.length > 30 ? `${userMessage.substring(0, 27)}...` : userMessage;
                }
                updatedChat.messages = [...chat.messages, userMessageObject];
                return updatedChat;
            }
            return chat;
        })
    );
    
    try {
        await processAIResponse(userMessage, currentChatId);
    } catch (error) {
        if (error instanceof Error && error.message.includes('Rpc failed')) {
            console.error("Network Error Detected:", error);
            setNetworkErrorForMessageId(userMessageObject.id);
        }
    }
  }, [activeChatId, processAIResponse]);

  const handleRetry = useCallback(async (messageToRetry: Message) => {
    if (!activeChatId) return;
    setNetworkErrorForMessageId(null);
    try {
        await processAIResponse(messageToRetry.text, activeChatId);
    } catch (error) {
         if (error instanceof Error && error.message.includes('Rpc failed')) {
            console.error("Network Error on Retry:", error);
            setNetworkErrorForMessageId(messageToRetry.id); // Set error on the same message again
        }
    }
  }, [activeChatId, processAIResponse]);


  const handleViewVerses = useCallback((verses: VerseLocation[]) => {
    setTargetVerses(verses);
    if (window.innerWidth < 1024) {
      setMobileView('viewer');
    }
  }, []);
  
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
      if (window.innerWidth < 1024) {
        setMobileView('viewer');
      }
  }, []);

  const handleShowTafsir = useCallback(async (surah: number, ayah: number) => {
    setTafsirState({ isOpen: true, surah, ayah, isLoading: true, content: { english: '', arabic: '' }, error: undefined });
    try {
      const arabicRes = await fetch(`https://api.alquran.cloud/v1/ayah/${surah}:${ayah}/ar.muyassar`);

      if (!arabicRes.ok) throw new Error("Failed to fetch Arabic Tafsir data from the API.");
      
      const arabicData = await arabicRes.json();
      if (arabicData.code !== 200 || !arabicData.data.text) throw new Error("Tafsir was not found for this verse.");
      
      const arabicTafsir = arabicData.data.text;
// FIX: The original state update was structurally incorrect, attempting to add `arabic` to the root of the state object. This corrects it to update `content.arabic`.
      setTafsirState(prev => ({ ...prev, content: { ...prev.content, arabic: arabicTafsir } }));
      
      const englishTafsir = await translateTextToEnglish(arabicTafsir);
      setTafsirState(prev => ({ ...prev, isLoading: false, content: { ...prev.content, english: englishTafsir }}));

    } catch (error) {
      const message = error instanceof Error ? error.message : "An unknown error occurred.";
      setTafsirState(prev => ({ ...prev, isLoading: false, error: message }));
    }
// FIX: Added a missing closing brace for the `handleShowTafsir` async function body. This was the root cause of numerous "Cannot find name" errors as it put subsequent code out of the component's scope.
  }, []);

  const handleCloseTafsir = useCallback(() => {
    setTafsirState({ isOpen: false, isLoading: false, content: { english: '', arabic: '' } });
  }, []);

  const handleSelectChat = useCallback((id: string) => {
    setActiveChatId(id);
    setActiveTab('chat');
  }, []);

  const handleDeleteChat = useCallback((id: string) => {
    if (window.confirm('Are you sure you want to delete this conversation?')) {
        setHistory(prev => {
            const newHistory = prev.filter(c => c.id !== id);
            // If the deleted chat was a-ctive, activate the next available one or create a new one.
            if (activeChatId === id) {
                if (newHistory.length > 0) {
                    setActiveChatId(newHistory[0].id);
                } else {
                    const newChat: ChatSession = {
                        id: `chat_${Date.now()}`,
                        title: "New Chat",
                        messages: [...initialMessages],
                        createdAt: Date.now(),
                    };
                    setActiveChatId(newChat.id);
                    return [newChat];
                }
            }
            return newHistory;
        });
    }
  }, [activeChatId]);

  const handleCloseDisclaimer = useCallback(() => {
    try {
        localStorage.setItem('quranNavigatorDisclaimerAcknowledged', 'true');
    } catch (error) {
        console.error("Failed to write to localStorage", error);
    }
    setIsDisclaimerOpen(false);
  }, []);

  // Universal search logic
  const textSelectors = useMemo(() => ({
    chat: (msg: Message) => [msg.text, msg.interpretation].filter(Boolean).join('\n'),
    history: (session: ChatSession) => {
      const messageContent = session.messages
        .map(msg => [msg.text, msg.interpretation].filter(Boolean).join('\n'))
        .join('\n\n');
      return [session.title, messageContent].join('\n\n');
    },
    bookmarks: (bookmark: VerseLocation) => {
      if (!quranData) return '';
      const surah = quranData.find(s => s.id === bookmark.surah);
      if (!surah) return '';
      return `${surah.transliteration} verse ${bookmark.ayah}`;
    },
    saved: (savedMsg: SavedMessage) => [
      savedMsg.chatTitle,
      savedMsg.message.text,
      savedMsg.message.interpretation,
    ].filter(Boolean).join('\n'),
  }), [quranData]);
  
  const idSelectors = {
    chat: (msg: Message) => msg.id,
    history: (session: ChatSession) => session.id,
    bookmarks: (bookmark: VerseLocation) => `${bookmark.surah}:${bookmark.ayah}`,
    saved: (savedMsg: SavedMessage) => savedMsg.id,
  };

  const chatSearchResults = useSearch(messages, searchTerm, textSelectors.chat, idSelectors.chat);
  const historySearchResults = useSearch(history, searchTerm, textSelectors.history, idSelectors.history);
  const bookmarksSearchResults = useSearch(bookmarks, searchTerm, textSelectors.bookmarks, idSelectors.bookmarks);
  const savedSearchResults = useSearch(savedMessages, searchTerm, textSelectors.saved, idSelectors.saved);

  const activeSearchResult = useMemo(() => {
    switch (activeTab) {
      case 'history':
        return historySearchResults;
      case 'bookmarks':
        return bookmarksSearchResults;
      case 'saved':
        return savedSearchResults;
      case 'chat':
      default:
        return chatSearchResults;
    }
  }, [
    activeTab,
    chatSearchResults,
    historySearchResults,
    bookmarksSearchResults,
    savedSearchResults,
  ]);

  if (isDataLoading) {
    return (
      <div className="flex h-screen w-screen bg-slate-100 flex-col items-center justify-center text-slate-600">
        <IconLoader className="h-12 w-12 animate-spin mb-4" />
        <h1 className="text-xl font-semibold">Loading the Holy Quran...</h1>
        <p className="text-slate-500">Please wait a moment.</p>
      </div>
    );
  }

  if (dataError) {
    return (
      <div className="flex h-screen w-screen bg-slate-100 flex-col items-center justify-center text-center p-4">
        <h1 className="text-xl font-semibold text-red-600">Failed to Load Data</h1>
        <p className="text-slate-500 mt-2">{dataError}</p>
      </div>
    );
  }

  if (!quranData) {
    return null;
  }

  return (
    <>
      <DisclaimerModal isOpen={isDisclaimerOpen} onClose={handleCloseDisclaimer} />
      <div className="flex flex-col lg:flex-row h-screen w-screen bg-slate-100 text-gray-800 overflow-hidden">
        <div className={`${mobileView === 'chat' ? 'flex' : 'hidden'} lg:flex w-full lg:w-1/3 xl:w-1/4 h-full flex-col bg-white border-r border-gray-200 overflow-hidden`}>
          <header className="p-4 border-b border-gray-200 flex items-center justify-between bg-slate-50 flex-shrink-0">
            <div className="flex items-center space-x-3">
              <IconBook className="h-8 w-8 text-slate-600" />
              <div>
                <h1 className="text-xl font-bold text-slate-800">AI Quran Navigator</h1>
                <p className="text-sm text-slate-500">Your guide to the Holy Quran</p>
              </div>
            </div>
            <div className="flex items-center space-x-1">
              <button
                  onClick={() => setIsSearchVisible(v => !v)}
                  className={`p-2 rounded-full transition-colors ${isSearchVisible ? 'bg-blue-100 text-blue-600' : 'text-slate-500 hover:bg-slate-200 hover:text-slate-700'}`}
                  aria-label="Search"
                  title="Search"
              >
                  <IconSearch className="h-6 w-6" />
              </button>
              <button
                  onClick={handleNewChat}
                  className="p-2 rounded-full text-slate-500 hover:bg-slate-200 hover:text-slate-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-slate-50 focus:ring-blue-500 transition-colors"
                  aria-label="New Chat"
                  title="New Chat"
              >
                  <IconPlus className="h-6 w-6" />
              </button>
            </div>
          </header>
          
          <div className="border-b border-gray-200 flex-shrink-0">
            <nav className="-mb-px flex" aria-label="Tabs">
                <button 
                    onClick={() => setActiveTab('chat')} 
                    className={`flex items-center justify-center w-1/4 py-3 px-1 text-center border-b-2 font-medium text-sm transition-colors duration-200 ${activeTab === 'chat' ? 'border-blue-500 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'}`}
                >
                    <IconMessageCircle className="h-4 w-4 mr-2" />
                    Chat
                </button>
                <button 
                    onClick={() => setActiveTab('history')}
                    className={`flex items-center justify-center w-1/4 py-3 px-1 text-center border-b-2 font-medium text-sm transition-colors duration-200 ${activeTab === 'history' ? 'border-blue-500 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'}`}
                >
                    <IconHistory className="h-4 w-4 mr-2" />
                    History
                </button>
                <button 
                    onClick={() => setActiveTab('bookmarks')}
                    className={`flex items-center justify-center w-1/4 py-3 px-1 text-center border-b-2 font-medium text-sm transition-colors duration-200 ${activeTab === 'bookmarks' ? 'border-blue-500 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'}`}
                >
                    <IconBookmark className="h-4 w-4 mr-2" />
                    Bookmarks
                </button>
                 <button 
                    onClick={() => setActiveTab('saved')}
                    className={`flex items-center justify-center w-1/4 py-3 px-1 text-center border-b-2 font-medium text-sm transition-colors duration-200 ${activeTab === 'saved' ? 'border-blue-500 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'}`}
                >
                    <IconStar className="h-4 w-4 mr-2" />
                    Saved
                </button>
            </nav>
          </div>
          <SearchControl 
            isSearchVisible={isSearchVisible}
            searchTerm={searchTerm}
            onSearchTermChange={setSearchTerm}
            totalMatches={activeSearchResult.totalMatches}
            currentMatchIndex={activeSearchResult.activeMatch ? activeSearchResult.activeMatch.globalIndex + 1 : 0}
            onPrev={activeSearchResult.goToPrev}
            onNext={activeSearchResult.goToNext}
            onClose={() => {
              setIsSearchVisible(false);
              setSearchTerm('');
            }}
          />
          
          <div className="flex-grow min-h-0">
            {activeTab === 'chat' && (
              <ChatBox
                  messages={messages}
                  onSendMessage={handleSendMessage}
                  isLoading={isLoading}
                  onViewVerses={handleViewVerses}
                  savedMessages={savedMessages}
                  onToggleSave={handleToggleSaveMessage}
                  searchTerm={searchTerm}
                  activeMatch={chatSearchResults.activeMatch}
                  networkErrorForMessageId={networkErrorForMessageId}
                  onRetry={handleRetry}
                />
            )}
            {activeTab === 'history' && (
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
                  searchTerm={searchTerm}
                  activeMatch={bookmarksSearchResults.activeMatch}
              />
            )}
            {activeTab === 'saved' && (
                <SavedPanel
                    savedMessages={savedMessages}
                    onGoToChat={handleSelectChat}
                    onRemoveSaved={handleToggleSaveMessage}
                    searchTerm={searchTerm}
                    activeMatch={savedSearchResults.activeMatch}
                />
            )}
          </div>
        </div>
        <main className={`${mobileView === 'viewer' ? 'flex' : 'hidden'} lg:flex w-full lg:w-2/3 xl:w-3/4 h-full flex-col overflow-hidden`}>
          <QuranViewer
            quranData={quranData}
            targetVerses={targetVerses}
            onShowTafsir={handleShowTafsir}
            bookmarks={bookmarks}
            onToggleBookmark={handleToggleBookmark}
            onBackToChat={() => setMobileView('chat')}
          />
        </main>
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
    </>
  );
};

export default App;
