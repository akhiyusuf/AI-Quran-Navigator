import React, { useState, useRef, useEffect, useContext, useMemo } from 'react';
import type { Message, VerseLocation, GroundingChunk, SavedMessage, Match } from '../types';
import { IconUser, IconSparkles, IconSend, IconChevronDown, IconBookOpen, IconLink, IconCopy, IconCheck, IconAlertTriangle, IconStar } from './Icons';

interface ChatBoxProps {
  messages: Message[];
  onSendMessage: (message: string) => void;
  isLoading: boolean;
  onViewVerses: (verses: VerseLocation[]) => void;
  savedMessages: SavedMessage[];
  onToggleSave: (message: Message) => void;
  searchTerm: string;
  activeMatch: Match<string> | null;
  networkErrorForMessageId: string | null;
  onRetry: (message: Message) => void;
}

// Helper function to create an array of verse locations from a string like "1:10-12"
const createVersesFromRange = (surah: number, startAyah: number, endAyahStr?: string): VerseLocation[] => {
    const verses: VerseLocation[] = [];
    const endAyah = endAyahStr ? parseInt(endAyahStr, 10) : startAyah;
    if (!isNaN(surah) && !isNaN(startAyah) && !isNaN(endAyah)) {
        for (let ayah = startAyah; ayah <= endAyah; ayah++) {
            verses.push({ surah, ayah });
        }
    }
    return verses;
};


// --- START: New Highlighting Logic ---

interface HighlightContextType {
  isParentActive: boolean;
  activeOccurrenceInParent: number;
  getAndIncrementOccurrence: () => number;
  activeMatchRef: React.RefObject<HTMLElement>;
  searchTerm: string;
}
const HighlightContext = React.createContext<HighlightContextType | null>(null);

const HighlightPlainText: React.FC<{ text: string | null | undefined }> = ({ text }) => {
  const context = useContext(HighlightContext);

  if (!context || !context.searchTerm || !text) {
    return <>{text}</>;
  }

  const { searchTerm, isParentActive, activeOccurrenceInParent, getAndIncrementOccurrence, activeMatchRef } = context;

  // Escape special characters for regex
  const safeHighlight = searchTerm.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&');
  const regex = new RegExp(`(${safeHighlight})`, 'gi');
  const parts = text.split(regex);
  
  return (
    <>
      {parts.map((part, i) => {
        if (regex.test(part)) {
          const myOccurrenceIndex = getAndIncrementOccurrence();
          const isActive = isParentActive && myOccurrenceIndex === activeOccurrenceInParent;
          
          return (
            <mark
              key={i}
              ref={isActive ? activeMatchRef : null}
              className={`rounded px-0.5 py-0 transition-colors ${isActive ? 'bg-orange-400 text-white' : 'bg-yellow-200 text-slate-800'}`}
            >
              {part}
            </mark>
          );
        }
        return part;
      })}
    </>
  );
};

// Recursive function to parse and render inline markdown and citations
const renderInlineContent = (
    text: string,
    onViewVerses: (verses: VerseLocation[]) => void,
    options?: { renderCitations?: boolean; }
): React.ReactNode => {
    const renderCitations = options?.renderCitations ?? true;

    if (!text) {
        return null;
    }

    const tokenRegex = /(\*\*\*.*?\*\*\*|\*\*.*?\*\*|__.*?__|\*.*?\*|_.*?_|~~.*?~~|`.*?`|\b\d{1,3}:\d+(?:-\d+)?\b|\[[^\]]+\]\([^)]+\))/s;
    const match = text.match(tokenRegex);

    if (!match || typeof match.index === 'undefined') {
        return <HighlightPlainText text={text} />; // Base case: no more tokens, render highlighted plain text
    }

    const before = text.substring(0, match.index);
    const matchedText = match[0];
    const after = text.substring(match.index + matchedText.length);

    let renderedMatch: React.ReactNode = matchedText;

    if (matchedText.startsWith('***') && matchedText.endsWith('***')) {
        renderedMatch = <strong><em>{renderInlineContent(matchedText.slice(3, -3), onViewVerses, options)}</em></strong>;
    } else if ((matchedText.startsWith('**') && matchedText.endsWith('**')) || (matchedText.startsWith('__') && matchedText.endsWith('__'))) {
        renderedMatch = <strong>{renderInlineContent(matchedText.slice(2, -2), onViewVerses, options)}</strong>;
    } else if ((matchedText.startsWith('*') && matchedText.endsWith('*')) || (matchedText.startsWith('_') && matchedText.endsWith('_'))) {
        renderedMatch = <em>{renderInlineContent(matchedText.slice(1, -1), onViewVerses, options)}</em>;
    } else if (matchedText.startsWith('~~') && matchedText.endsWith('~~')) {
        renderedMatch = <del>{renderInlineContent(matchedText.slice(2, -2), onViewVerses, options)}</del>;
    } else if (matchedText.startsWith('`') && matchedText.endsWith('`')) {
        // FIX: Corrected a JSX syntax error from `code>` to `<code>`.
        renderedMatch = <code><HighlightPlainText text={matchedText.slice(1, -1)} /></code>;
    } else if (matchedText.startsWith('[') && matchedText.includes('](')) {
        const linkMatch = matchedText.match(/\[([^\]]+)\]\(([^)]+)\)/);
        if (linkMatch) {
            const [, linkText, href] = linkMatch;
            renderedMatch = <a href={href} target="_blank" rel="noopener noreferrer">{linkText}</a>;
        }
    } else if (renderCitations && matchedText.match(/^\d{1,3}:\d+(?:-\d+)?$/)) {
        const versePatternMatch = matchedText.match(/^(\d{1,3}):(\d+)(?:-(\d+))?$/);
        if (versePatternMatch) {
            const [, surahStr, startAyahStr, endAyahStr] = versePatternMatch;
            const verses = createVersesFromRange(parseInt(surahStr, 10), parseInt(startAyahStr, 10), endAyahStr);
            renderedMatch = (
                <button
                    onClick={() => onViewVerses(verses)}
                    className="inline-flex items-center mx-1 px-2 py-0.5 rounded-md bg-blue-100 text-blue-700 text-sm font-medium hover:bg-blue-200 transition-colors"
                    title={`View Surah ${surahStr}, Verse ${startAyahStr}${endAyahStr ? `-${endAyahStr}` : ''}`}
                >
                    {endAyahStr ? `${surahStr}:${startAyahStr}-${endAyahStr}` : `${surahStr}:${startAyahStr}`}
                </button>
            );
        }
    } else {
        // Fallback for unrecognized tokens is to render them as highlighted text.
        renderedMatch = <HighlightPlainText text={matchedText} />;
    }

    return (
        <>
            {renderInlineContent(before, onViewVerses, options)}
            {renderedMatch}
            {renderInlineContent(after, onViewVerses, options)}
        </>
    );
};

const getCoreContentForBlockParsing = (line: string): string => {
    let current = line.trim();
    while (
        (current.startsWith('**') && current.endsWith('**') && current.length > 4) ||
        (current.startsWith('*') && current.endsWith('*') && current.length > 2)
    ) {
        current = current.slice(current.startsWith('**') ? 2 : 1, current.length - (current.startsWith('**') ? 2 : 1));
    }
    return current;
};

const InterpretationRenderer: React.FC<{
  text: string;
  onViewVerses: (verses: VerseLocation[]) => void;
}> = ({ text, onViewVerses }) => {
    const lines = text.split('\n');
    const elements: React.ReactNode[] = [];
    let i = 0;

    const parseListRecursive = (currentLineIndex: number, initialIndent: number): [React.ReactNode[], number] => {
        const listItems: React.ReactNode[] = [];
        let i = currentLineIndex;
        while (i < lines.length) {
            const line = lines[i];
            const coreContent = getCoreContentForBlockParsing(line);
            const indent = line.search(/\S|$/);
            const isListItem = /^\s*([\*\-]|\d+\.)\s/.test(coreContent);
            if (indent < initialIndent) break;
            if (indent >= initialIndent && isListItem) {
                const itemContent = coreContent.replace(/^\s*([\*\-]|\d+\.)\s/, '');
                let sublist: React.ReactNode = null;
                const nextLineIndex = i + 1;
                if (nextLineIndex < lines.length) {
                    const nextLine = lines[nextLineIndex];
                    const nextIndent = nextLine.search(/\S|$/);
                    const isNextLineListItem = /^\s*([\*\-]|\d+\.)\s/.test(getCoreContentForBlockParsing(nextLine));
                    if (nextIndent > indent && isNextLineListItem) {
                        const isSublistOrdered = /^\s*\d+\./.test(getCoreContentForBlockParsing(nextLine));
                        const SublistTag = isSublistOrdered ? 'ol' : 'ul';
                        const [sublistItems, newIndex] = parseListRecursive(nextLineIndex, nextIndent);
                        sublist = <SublistTag className="my-2">{sublistItems}</SublistTag>;
                        i = newIndex - 1; 
                    }
                }
                listItems.push(
                    <li key={i}>
                        {renderInlineContent(itemContent, onViewVerses)}
                        {sublist}
                    </li>
                );
                i++;
            } else {
                break;
            }
        }
        return [listItems, i];
    };

    while (i < lines.length) {
        const line = lines[i];
        const coreContent = getCoreContentForBlockParsing(line);
        if (line.trim() === '') {
            i++; continue;
        }
        const headingMatch = coreContent.match(/^(#+)\s*(.*)/);
        if (headingMatch) {
            const level = Math.min(headingMatch[1].length, 6);
            const content = headingMatch[2];
            const Tag = `h${level}`;
            elements.push(React.createElement(Tag, { key: i }, renderInlineContent(content, onViewVerses, { renderCitations: false })));
            i++; continue;
        }
        if (line.trim().startsWith('>')) {
            const bqLines = [];
            while (i < lines.length && lines[i].trim().startsWith('>')) {
                bqLines.push(lines[i].trim().replace(/^>\s?/, ''));
                i++;
            }
            elements.push(<blockquote key={i}><InterpretationRenderer text={bqLines.join('\n')} onViewVerses={onViewVerses} /></blockquote>);
            continue;
        }
        if (/^\s*([\*\-]|\d+\.)\s/.test(coreContent)) {
            const isOrdered = /^\s*\d+\./.test(coreContent);
            const ListTag = isOrdered ? 'ol' : 'ul';
            const initialIndent = line.search(/\S|$/);
            const [listItems, nextIndex] = parseListRecursive(i, initialIndent);
            elements.push(<ListTag key={`list-${i}`}>{listItems}</ListTag>);
            i = nextIndex; continue;
        }
        const paraLines = [];
        while (i < lines.length && lines[i].trim() !== '') {
            const currentCore = getCoreContentForBlockParsing(lines[i]);
            if (currentCore.startsWith('#') || lines[i].trim().startsWith('>') || /^\s*([\*\-]|\d+\.)\s/.test(currentCore)) break;
            paraLines.push(lines[i]);
            i++;
        }
        if (paraLines.length > 0) {
            elements.push(<p key={`para-${i}`}>{renderInlineContent(paraLines.join('\n'), onViewVerses)}</p>);
        }
    }
    return <>{elements.map((el, idx) => <React.Fragment key={idx}>{el}</React.Fragment>)}</>;
};

// --- END: New Highlighting Logic ---


const GroundingChunksRenderer = ({ chunks }: { chunks: GroundingChunk[] }) => {
    const [isExpanded, setIsExpanded] = useState(false);
    const [copiedIndex, setCopiedIndex] = useState<number | null>(null);

    const handleCopy = (url: string, index: number) => {
        navigator.clipboard.writeText(url);
        setCopiedIndex(index);
        setTimeout(() => setCopiedIndex(null), 2000);
    };

    if (!chunks || chunks.length === 0) return null;

    return (
        <div>
            <button onClick={() => setIsExpanded(!isExpanded)} className="flex items-center text-sm font-medium text-slate-500 hover:text-slate-700 w-full">
                <span>AI's Sources ({chunks.length})</span>
                <IconChevronDown className={`h-4 w-4 ml-auto transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
            </button>
            {isExpanded && (
                <div className="mt-2 space-y-2 pl-2 border-l-2 border-slate-200">
                    {chunks.map((chunk, index) => (
                        <div key={index} className="group flex items-center gap-2 text-sm">
                            <IconLink className="h-4 w-4 flex-shrink-0 text-slate-400" />
                            <a href={chunk.web.uri} target="_blank" rel="noopener noreferrer" className="text-blue-600 truncate hover:underline" title={chunk.web.uri}>
                                {chunk.web.title || chunk.web.uri}
                            </a>
                            <button onClick={() => handleCopy(chunk.web.uri, index)} className="p-1 rounded-md text-slate-400 hover:bg-slate-200 hover:text-slate-600 opacity-0 group-hover:opacity-100 transition-opacity" aria-label="Copy link">
                                {copiedIndex === index ? <IconCheck className="h-4 w-4 text-green-500" /> : <IconCopy className="h-4 w-4" />}
                            </button>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
};

const AIMessage: React.FC<{
  message: Message;
  onViewVerses: (verses: VerseLocation[]) => void;
  isSaved: boolean;
  onToggleSave: (message: Message) => void;
  searchTerm: string;
  activeMatch: Match<string> | null;
  activeMatchRef: React.RefObject<HTMLElement>;
}> = ({ message, onViewVerses, isSaved, onToggleSave, searchTerm, activeMatch, activeMatchRef }) => {
  const [isInterpretationExpanded, setIsInterpretationExpanded] = useState(false);
  const occurrenceCounter = useRef(0);

  const isMyMessageActive = activeMatch?.itemId === message.id;

  const contextValue = useMemo(() => ({
    isParentActive: isMyMessageActive,
    activeOccurrenceInParent: activeMatch?.occurrenceInItem ?? -1,
    getAndIncrementOccurrence: () => {
      const val = occurrenceCounter.current;
      occurrenceCounter.current += 1;
      return val;
    },
    activeMatchRef: activeMatchRef,
    searchTerm: searchTerm,
  }), [isMyMessageActive, activeMatch, activeMatchRef, searchTerm]);
  
  // Reset counter when the content changes to ensure it's accurate for each render.
  useEffect(() => {
    occurrenceCounter.current = 0;
  });

  const hasInterpretation = message.interpretation && message.interpretation.trim().length > 0;
  const hasFooterContent = (message.verses && message.verses.length > 0) || (message.groundingChunks && message.groundingChunks.length > 0);
  
  useEffect(() => {
    if (isMyMessageActive && searchTerm) {
        // If the interpretation text itself has a match, expand it.
        const safeSearchTerm = searchTerm.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&');
        const regex = new RegExp(safeSearchTerm, 'gi');
        if (message.interpretation && regex.test(message.interpretation)) {
            setIsInterpretationExpanded(true);
        }
    }
  }, [isMyMessageActive, searchTerm, message.interpretation]);

  return (
    <div className="group flex items-start gap-3">
        <div className="flex-shrink-0 h-8 w-8 rounded-full bg-slate-200 flex items-center justify-center">
            <IconSparkles className="h-5 w-5 text-slate-500" />
        </div>
        <div className="relative flex-grow bg-white rounded-lg rounded-tl-none p-4 border border-slate-200">
            <button
                onClick={() => onToggleSave(message)}
                className={`absolute top-2 right-2 p-1.5 rounded-full transition-all duration-200 ${isSaved ? 'text-yellow-500 bg-yellow-100' : 'text-slate-400 hover:bg-slate-100 hover:text-slate-600 opacity-0 group-hover:opacity-100'}`}
                aria-label={isSaved ? "Unsave this reply" : "Save this reply"}
                title={isSaved ? "Unsave this reply" : "Save this reply"}
            >
                <IconStar className={`h-5 w-5 ${isSaved ? 'fill-current' : ''}`} />
            </button>
            
            <HighlightContext.Provider value={contextValue}>
                <div className="prose prose-sm max-w-none text-slate-700">
                    <p><HighlightPlainText text={message.text} /></p>
                </div>

                {(hasInterpretation || hasFooterContent) && (
                    <div className="mt-3 pt-3 border-t border-slate-200 space-y-4">
                        {hasInterpretation && (
                            <div>
                                <button
                                    onClick={() => setIsInterpretationExpanded(!isInterpretationExpanded)}
                                    className="flex items-center justify-between w-full text-left"
                                    aria-expanded={isInterpretationExpanded}
                                >
                                    <span className="font-semibold text-slate-700">AI's Summary</span>
                                    <IconChevronDown
                                        className={`h-5 w-5 text-slate-500 transition-transform ${isInterpretationExpanded ? 'rotate-180' : ''}`}
                                    />
                                </button>
                                {isInterpretationExpanded && (
                                    <div className="mt-3 prose prose-sm max-w-none text-slate-700">
                                        <div className="p-3 bg-yellow-50 border border-yellow-200 rounded-lg flex items-start gap-3 not-prose mb-4">
                                            <IconAlertTriangle className="h-5 w-5 text-yellow-500 flex-shrink-0 mt-0.5" />
                                            <p className="text-xs text-yellow-800">
                                                <strong>AI-Generated Content:</strong> This interpretation is generated by an AI and may contain inaccuracies. Please verify information with scholarly sources.
                                            </p>
                                        </div>
                                        <InterpretationRenderer text={message.interpretation!} onViewVerses={onViewVerses} />
                                    </div>
                                )}
                            </div>
                        )}

                        {message.verses && message.verses.length > 0 && (
                            <div>
                                <button
                                    onClick={() => onViewVerses(message.verses!)}
                                    className="inline-flex items-center gap-2 px-4 py-2 text-sm font-semibold text-white bg-blue-600 rounded-full shadow-sm hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-all"
                                >
                                    <IconBookOpen className="h-5 w-5" />
                                    <span>View Related Verses</span>
                                </button>
                            </div>
                        )}

                        {message.groundingChunks && message.groundingChunks.length > 0 && (
                            <GroundingChunksRenderer chunks={message.groundingChunks} />
                        )}
                    </div>
                )}
            </HighlightContext.Provider>
        </div>
    </div>
  );
};


const UserMessage: React.FC<{
    message: Message,
    searchTerm: string;
    activeMatch: Match<string> | null;
    activeMatchRef: React.RefObject<HTMLElement>;
}> = ({ message, searchTerm, activeMatch, activeMatchRef }) => {
    const occurrenceCounter = useRef(0);
    const isMyMessageActive = activeMatch?.itemId === message.id;

    const contextValue = useMemo(() => ({
        isParentActive: isMyMessageActive,
        activeOccurrenceInParent: activeMatch?.occurrenceInItem ?? -1,
        getAndIncrementOccurrence: () => {
            const val = occurrenceCounter.current;
            occurrenceCounter.current += 1;
            return val;
        },
        activeMatchRef: activeMatchRef,
        searchTerm: searchTerm,
    }), [isMyMessageActive, activeMatch, activeMatchRef, searchTerm]);

    useEffect(() => {
        occurrenceCounter.current = 0;
    });

    return (
        <div className="flex items-start gap-3 justify-end">
            <div className="flex-grow bg-blue-500 rounded-lg rounded-br-none p-4">
                <HighlightContext.Provider value={contextValue}>
                    <p className="text-white"><HighlightPlainText text={message.text} /></p>
                </HighlightContext.Provider>
            </div>
            <div className="flex-shrink-0 h-8 w-8 rounded-full bg-slate-700 flex items-center justify-center">
                <IconUser className="h-5 w-5 text-slate-200" />
            </div>
        </div>
    );
};

const NetworkErrorNotification: React.FC<{ onRetry: () => void }> = ({ onRetry }) => (
  <div className="flex justify-center mt-2">
    <div className="w-full max-w-md bg-red-50 border border-red-200 text-red-800 text-sm rounded-lg p-3 flex items-center gap-3">
      <IconAlertTriangle className="h-5 w-5 flex-shrink-0" />
      <div className="flex-grow">
        <p><strong>Network Error:</strong> Could not send message.</p>
      </div>
      <button
        onClick={onRetry}
        className="font-semibold text-red-800 hover:text-red-900 underline flex-shrink-0"
      >
        Retry
      </button>
    </div>
  </div>
);

const ChatIntro: React.FC<{ onPromptClick: (prompt: string) => void }> = ({ onPromptClick }) => {
  const prompts = [
    "Explain some common misconceptions about the Quran.",
    "Who are we prohibited to marry in Islam according to the Quran?",
    "What are some miracles mentioned in the Quran?",
    "Why is the Hadith important for understanding the Quran?",
  ];

  const PromptButton: React.FC<{ text: string }> = ({ text }) => (
    <button
      onClick={() => onPromptClick(text)}
      className="w-full text-left p-3 bg-white border border-slate-200 rounded-lg hover:bg-slate-100 hover:border-slate-300 transition-all text-sm font-medium text-slate-700"
    >
      {text}
    </button>
  );

  return (
    <div className="flex-grow flex flex-col justify-center items-center p-4 overflow-y-auto">
      <div className="text-center max-w-md w-full">
        <IconSparkles className="h-12 w-12 text-blue-500 mx-auto mb-3" />
        <h2 className="text-2xl font-bold text-slate-800">Start a new conversation</h2>
        <p className="text-slate-500 mt-2 mb-8">
          Ask me anything about the Quran, or try one of these example prompts to get started.
        </p>
        
        <div className="space-y-3">
          {prompts.map((prompt, index) => (
            <PromptButton key={index} text={prompt} />
          ))}
        </div>
      </div>
    </div>
  );
};

export const ChatBox: React.FC<ChatBoxProps> = ({ messages, onSendMessage, isLoading, onViewVerses, savedMessages, onToggleSave, searchTerm, activeMatch, networkErrorForMessageId, onRetry }) => {
    const [input, setInput] = useState('');
    const messagesEndRef = useRef<HTMLDivElement>(null);
    const textareaRef = useRef<HTMLTextAreaElement>(null);
    const activeMatchRef = useRef<HTMLElement>(null);
    const messageContainerRef = useRef<HTMLDivElement>(null);

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    };

    useEffect(() => {
        if (!searchTerm) {
            scrollToBottom();
        }
    }, [messages.length, searchTerm]); // Trigger only on new messages
    
    useEffect(() => {
        if (activeMatchRef.current) {
            activeMatchRef.current.scrollIntoView({
                behavior: 'smooth',
                block: 'center',
                inline: 'nearest'
            });
        }
    }, [activeMatch]);
    
    useEffect(() => {
        if (textareaRef.current) {
            textareaRef.current.style.height = 'auto';
            const scrollHeight = textareaRef.current.scrollHeight;
            textareaRef.current.style.height = `${scrollHeight}px`;
        }
    }, [input]);

    const handleSend = () => {
        if (input.trim() && !isLoading) {
            onSendMessage(input.trim());
            setInput('');
        }
    };

    const handleKeyPress = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleSend();
        }
    };

    const isNewChat = messages.length === 0;

    return (
        <div className="flex flex-col h-full bg-slate-50">
            {isNewChat ? (
                <ChatIntro onPromptClick={onSendMessage} />
            ) : (
                <div ref={messageContainerRef} className="flex-grow p-4 overflow-y-auto">
                    <div className="space-y-6 max-w-3xl mx-auto">
                        {messages.map((msg) => {
                            if (msg.sender === 'ai') {
                                const isSaved = savedMessages.some(sm => sm.id === msg.id);
                                return (
                                    <AIMessage
                                        key={msg.id}
                                        message={msg}
                                        onViewVerses={onViewVerses}
                                        isSaved={isSaved}
                                        onToggleSave={onToggleSave}
                                        searchTerm={searchTerm}
                                        activeMatch={activeMatch}
                                        activeMatchRef={activeMatchRef}
                                    />
                                );
                            }
                            return (
                                <div key={msg.id}>
                                    <UserMessage
                                        message={msg}
                                        searchTerm={searchTerm}
                                        activeMatch={activeMatch}
                                        activeMatchRef={activeMatchRef}
                                    />
                                    {networkErrorForMessageId === msg.id && (
                                        <NetworkErrorNotification onRetry={() => onRetry(msg)} />
                                    )}
                                </div>
                            );
                        })}
                        <div ref={messagesEndRef} />
                    </div>
                </div>
            )}
            <div className="p-4 bg-white border-t border-slate-200 flex-shrink-0">
                <div className="max-w-3xl mx-auto flex items-start gap-2">
                    <textarea
                        ref={textareaRef}
                        value={input}
                        onChange={(e) => setInput(e.target.value)}
                        onKeyPress={handleKeyPress}
                        placeholder="Ask a question..."
                        className="flex-grow p-2 rounded-lg border-2 border-slate-300 focus:border-blue-500 focus:ring-blue-500 resize-none transition-colors w-full max-h-40"
                        rows={1}
                        disabled={isLoading}
                        aria-label="Chat input"
                    />
                    <button
                        onClick={handleSend}
                        disabled={isLoading || !input.trim()}
                        className="p-3 rounded-lg bg-blue-600 text-white disabled:bg-slate-300 disabled:cursor-not-allowed hover:bg-blue-700 transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                        aria-label="Send message"
                    >
                        {isLoading ? (
                            <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                        ) : (
                            <IconSend className="h-5 w-5" />
                        )}
                    </button>
                </div>
            </div>
        </div>
    );
};