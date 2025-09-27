import React, { useState, useRef, useEffect, useContext, useMemo } from 'react';
import type { Message, VerseLocation, GroundingChunk, SavedMessage, Match } from '../types';
import { IconUser, IconSparkles, IconSend, IconChevronDown, IconLink, IconCopy, IconCheck, IconAlertTriangle, IconStar, IconTarget, IconComment } from './Icons';

interface ChatBoxProps {
  messages: Message[];
  onSendMessage: (message: string) => void;
  isLoading: boolean;
  savedMessages: SavedMessage[];
  onToggleSave: (message: Message) => void;
  searchTerm: string;
  activeMatch: Match<string> | null;
  networkErrorForMessageId: string | null;
  onRetry: (message: Message) => void;
  onViewVerses: (verses: VerseLocation[]) => void;
  onShowCitedVerses: (verses: VerseLocation[]) => void;
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
              className={`rounded px-0.5 py-0 transition-colors ${isActive ? 'bg-[var(--highlight-active)] text-[var(--highlight-active-foreground)]' : 'bg-[var(--highlight)] text-[var(--foreground)]'}`}
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
    options?: { renderCitations?: boolean; groundingChunks?: GroundingChunk[]; }
): React.ReactNode => {
    const renderCitations = options?.renderCitations ?? true;
    const groundingChunks = options?.groundingChunks;

    if (!text) {
        return null;
    }

    // Updated regex to correctly identify verse citations adjacent to punctuation using negative lookarounds.
    const tokenRegex = /(\*\*\*.*?\*\*\*|\*\*.*?\*\*|__.*?__|\*.*?\*|_.*?_|~~.*?~~|`.*?`|(?<![\d:])\d{1,3}:\d+(?:-\d+)?(?![\d])|\[[^\]]+\]\([^)]+\)|\[\d+\])/s;
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
        renderedMatch = <code>{renderInlineContent(matchedText.slice(1, -1), onViewVerses, options)}</code>;
    } else if (matchedText.startsWith('[') && matchedText.includes('](')) {
        const linkMatch = matchedText.match(/\[([^\]]+)\]\(([^)]+)\)/);
        if (linkMatch) {
            const [, linkText, href] = linkMatch;
            renderedMatch = <a href={href} target="_blank" rel="noopener noreferrer">{renderInlineContent(linkText, onViewVerses, options)}</a>;
        }
    } else if (groundingChunks && matchedText.match(/^\[\d+\]$/)) {
        const index = parseInt(matchedText.slice(1, -1), 10) - 1;
        if (index >= 0 && index < groundingChunks.length) {
            const chunk = groundingChunks[index];
            renderedMatch = (
                <a
                    href={chunk.web.uri}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center justify-center mx-1 w-5 h-5 rounded-full bg-[var(--primary-soft)] text-[var(--primary-soft-foreground)] text-xs font-bold hover:bg-[var(--accent)] transition-colors"
                    title={chunk.web.title || chunk.web.uri}
                >
                    {index + 1}
                </a>
            );
        }
    } else if (renderCitations && matchedText.match(/^\d{1,3}:\d+(?:-\d+)?$/)) {
        const versePatternMatch = matchedText.match(/^(\d{1,3}):(\d+)(?:-(\d+))?$/);
        if (versePatternMatch) {
            const [, surahStr, startAyahStr, endAyahStr] = versePatternMatch;
            const verses = createVersesFromRange(parseInt(surahStr, 10), parseInt(startAyahStr, 10), endAyahStr);
            renderedMatch = (
                <button
                    onClick={() => onViewVerses(verses)}
                    className="inline-flex items-center mx-1 px-2 py-0.5 rounded-md bg-[var(--primary)] text-[var(--primary-foreground)] text-sm font-medium hover:bg-[var(--primary-hover)] transition-colors"
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
  groundingChunks?: GroundingChunk[];
}> = ({ text, onViewVerses, groundingChunks }) => {
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
                        {renderInlineContent(itemContent, onViewVerses, { groundingChunks })}
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
            elements.push(React.createElement(Tag, { key: i }, renderInlineContent(content, onViewVerses, { renderCitations: false, groundingChunks })));
            i++; continue;
        }
        if (line.trim().startsWith('>')) {
            const bqLines = [];
            while (i < lines.length && lines[i].trim().startsWith('>')) {
                bqLines.push(lines[i].trim().replace(/^>\s?/, ''));
                i++;
            }
            elements.push(<blockquote><InterpretationRenderer text={bqLines.join('\n')} onViewVerses={onViewVerses} groundingChunks={groundingChunks} /></blockquote>);
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
            elements.push(<p key={`para-${i}`}>{renderInlineContent(paraLines.join('\n'), onViewVerses, { groundingChunks })}</p>);
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
            <button onClick={() => setIsExpanded(!isExpanded)} className="flex items-center text-sm font-medium text-[var(--muted-foreground)] hover:text-[var(--foreground)] w-full">
                <span>AI's Sources ({chunks.length})</span>
                <IconChevronDown className={`h-4 w-4 ml-auto transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
            </button>
            {isExpanded && (
                <div className="mt-2 space-y-2 pl-2 border-l-2 border-[var(--border)]">
                    {chunks.map((chunk, index) => (
                        <div key={index} className="group flex items-center gap-2 text-sm">
                            <IconLink className="h-4 w-4 flex-shrink-0 text-[var(--muted-foreground)]" />
                            <a href={chunk.web.uri} target="_blank" rel="noopener noreferrer" className="text-[var(--primary)] truncate hover:underline" title={chunk.web.uri}>
                                {chunk.web.title || chunk.web.uri}
                            </a>
                            <button onClick={() => handleCopy(chunk.web.uri, index)} className="p-1 rounded-md text-[var(--muted-foreground)] hover:bg-[var(--accent)] hover:text-[var(--accent-foreground)] opacity-0 group-hover:opacity-100 transition-opacity" aria-label="Copy link">
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
  isSaved: boolean;
  onToggleSave: (message: Message) => void;
  searchTerm: string;
  activeMatch: Match<string> | null;
  activeMatchRef: React.RefObject<HTMLElement>;
  onViewVerses: (verses: VerseLocation[]) => void;
  onShowCitedVerses: (verses: VerseLocation[]) => void;
}> = ({ message, isSaved, onToggleSave, searchTerm, activeMatch, activeMatchRef, onViewVerses, onShowCitedVerses }) => {
  const [isRawCopied, setIsRawCopied] = useState(false);
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
  const hasGrounding = message.groundingChunks && message.groundingChunks.length > 0;
  const hasFooterActions = hasGrounding || (message.verses && message.verses.length > 0) || message.rawContent;

  const handleCopyRaw = () => {
    if (!message.rawContent) return;
    navigator.clipboard.writeText(message.rawContent);
    setIsRawCopied(true);
    setTimeout(() => setIsRawCopied(false), 2000);
  };

  return (
    <div className="group">
        <div className="pt-1">
            <HighlightContext.Provider value={contextValue}>
                {hasInterpretation ? (
                    <div className="prose prose-lg max-w-none text-[var(--card-foreground)]">
                        <div 
                        style={{ backgroundColor: 'var(--warning-soft)', borderColor: 'var(--warning)' }} 
                        className="p-3 border rounded-lg flex items-start gap-3 not-prose mb-4"
                        >
                            <IconAlertTriangle style={{ color: 'var(--warning)' }} className="h-5 w-5 flex-shrink-0 mt-0.5" />
                            <p style={{ color: 'var(--warning-foreground)' }} className="text-xs">
                                <strong>AI-Generated Content:</strong> This interpretation is generated by an AI and may contain inaccuracies. Please verify information with scholarly sources.
                            </p>
                        </div>
                        <InterpretationRenderer text={message.interpretation!} onViewVerses={onViewVerses} groundingChunks={message.groundingChunks} />
                    </div>
                ) : (
                    // Blinking cursor for streaming state
                    <div className="w-2.5 h-5 bg-[var(--ring)] animate-pulse rounded-sm"></div>
                )}
                
                {hasFooterActions && (
                    <div className="mt-3 pt-3 border-t border-[var(--border)] space-y-4">
                        {hasGrounding && (
                            <GroundingChunksRenderer chunks={message.groundingChunks!} />
                        )}

                        <div className="flex items-center gap-2">
                            <button
                                onClick={() => onToggleSave(message)}
                                style={isSaved ? { color: 'var(--saved)' } : {}}
                                // FIX: Corrected a malformed ternary operator in className that caused a parsing error.
                                className={`flex items-center gap-2 text-xs font-medium transition-colors py-2 px-3 rounded-full ${isSaved ? 'bg-[var(--saved-soft)]' : 'text-[var(--muted-foreground)] hover:text-[var(--foreground)] hover:bg-[var(--accent)]'}`}
                                title={isSaved ? "Unsave this reply" : "Save this reply"}
                            >
                                <IconStar className={`h-4 w-4 ${isSaved ? 'fill-current' : ''}`} />
                                <span>{isSaved ? 'Saved' : 'Save'}</span>
                            </button>

                            {message.verses && message.verses.length > 0 && (
                                <button
                                    onClick={() => onShowCitedVerses(message.verses!)}
                                    className="flex items-center gap-2 text-xs font-medium text-[var(--muted-foreground)] hover:text-[var(--foreground)] transition-colors py-2 px-3 rounded-full hover:bg-[var(--accent)]"
                                    title="View cited verses"
                                >
                                    <IconTarget className="h-4 w-4" />
                                    <span>Verses ({message.verses.length})</span>
                                </button>
                            )}
                            
                            {message.rawContent && (
                                <button
                                    onClick={handleCopyRaw}
                                    className="flex items-center gap-2 text-xs font-medium text-[var(--muted-foreground)] hover:text-[var(--foreground)] transition-colors py-2 px-3 rounded-full hover:bg-[var(--accent)]"
                                    title="Copy AI response"
                                >
                                    {isRawCopied ? (
                                        <>
                                            <IconCheck className="h-4 w-4 text-green-500" />
                                            <span className="text-[var(--foreground)]">Copied</span>
                                        </>
                                    ) : (
                                        <>
                                            <IconCopy className="h-4 w-4" />
                                            <span>Copy</span>
                                        </>
                                    )}
                                </button>
                            )}
                        </div>
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
        <div className="flex justify-end">
            <div className="bg-[var(--primary)] rounded-2xl rounded-br-lg px-4 py-3 max-w-xl">
                <HighlightContext.Provider value={contextValue}>
                    <p className="text-[var(--primary-foreground)] whitespace-pre-wrap break-words text-lg"><HighlightPlainText text={message.text} /></p>
                </HighlightContext.Provider>
            </div>
        </div>
    );
};

const NetworkErrorNotification: React.FC<{ onRetry: () => void }> = ({ onRetry }) => (
  <div className="flex justify-center mt-2">
    <div className="w-full max-w-md bg-[var(--destructive-soft)] border border-[var(--destructive)] text-[var(--destructive-foreground)] text-sm rounded-lg p-3 flex items-center gap-3">
      <IconAlertTriangle className="h-5 w-5 flex-shrink-0" />
      <div className="flex-grow">
        <p><strong>Network Error:</strong> Could not send message.</p>
      </div>
      <button
        onClick={onRetry}
        className="font-semibold text-[var(--destructive-foreground)] hover:text-[var(--foreground)] underline flex-shrink-0"
      >
        Retry
      </button>
    </div>
  </div>
);

const IntroductoryPrompts: React.FC<{ onPromptClick: (prompt: string) => void }> = ({ onPromptClick }) => {
  const prompts = [
    "Where does the Quran mention patience?",
    "Tell me about the story of Prophet Yusuf (Joseph).",
    "What are the characteristics of the believers (Mu'minun)?",
    "Explain the concept of Tawhid (Oneness of God)."
  ];

  return (
    <div className="flex flex-col items-center justify-center h-full text-center p-4">
      <div className="p-4 rounded-lg bg-[var(--primary-soft)] mb-4">
          <IconComment className="h-10 w-10 text-[var(--primary-soft-foreground)]" />
      </div>
      <h2 className="text-2xl font-bold text-[var(--foreground)]">Welcome to the AI Quran Navigator</h2>
      <p className="mt-2 max-w-md text-[var(--muted-foreground)]">
        How can I assist you in exploring the Holy Quran today?
      </p>
      <div className="mt-8 w-full max-w-md grid grid-cols-1 md:grid-cols-2 gap-3">
        {prompts.map((prompt, i) => (
          <button
            key={i}
            onClick={() => onPromptClick(prompt)}
            className="p-3 bg-[var(--card)] border border-[var(--border)] rounded-lg text-left hover:bg-[var(--accent)] transition-colors"
          >
            <p className="font-medium text-sm text-[var(--foreground)]">{prompt}</p>
          </button>
        ))}
      </div>
    </div>
  );
};

export const ChatBox: React.FC<ChatBoxProps> = ({ messages, onSendMessage, isLoading, savedMessages, onToggleSave, searchTerm, activeMatch, networkErrorForMessageId, onRetry, onViewVerses, onShowCitedVerses }) => {
    const [input, setInput] = useState('');
    const messagesEndRef = useRef<HTMLDivElement>(null);
    const textareaRef = useRef<HTMLTextAreaElement>(null);
    const activeMatchRef = useRef<HTMLElement>(null);
    const messageContainerRef = useRef<HTMLDivElement>(null);
    const prevMessagesLength = useRef(messages.length);

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    };

    useEffect(() => {
        const isNewMessageAdded = messages.length > prevMessagesLength.current;
        prevMessagesLength.current = messages.length;

        const container = messageContainerRef.current;
        if (!container || searchTerm) return;

        const lastMessage = messages[messages.length - 1];

        // Always scroll for a new user message
        if (isNewMessageAdded && lastMessage?.sender === 'user') {
            scrollToBottom();
            return;
        }

        // For other updates (like AI streaming), only scroll if user is already near the bottom
        const SCROLL_THRESHOLD = 150;
        const isNearBottom = container.scrollHeight - container.scrollTop <= container.clientHeight + SCROLL_THRESHOLD;
        
        if (isNearBottom) {
             scrollToBottom();
        }
    }, [messages, searchTerm]);
    
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

    const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
        if (e.key === 'Enter' && e.ctrlKey) {
            e.preventDefault();
            handleSend();
        }
    };

    return (
        <div className="flex flex-col h-full bg-[var(--background)]">
            {messages.length === 0 ? (
                <IntroductoryPrompts onPromptClick={onSendMessage} />
            ) : (
                <div ref={messageContainerRef} className="flex-grow p-4 sm:px-6 lg:px-8 overflow-y-auto">
                    <div className="space-y-6 max-w-5xl mx-auto">
                        {messages.map((msg) => {
                            if (msg.sender === 'ai') {
                                const isSaved = savedMessages.some(sm => sm.id === msg.id);
                                return (
                                    <AIMessage
                                        key={msg.id}
                                        message={msg}
                                        isSaved={isSaved}
                                        onToggleSave={onToggleSave}
                                        searchTerm={searchTerm}
                                        activeMatch={activeMatch}
                                        activeMatchRef={activeMatchRef}
                                        onViewVerses={onViewVerses}
                                        onShowCitedVerses={onShowCitedVerses}
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
            <div className="p-4 bg-[var(--card)] border-t border-[var(--border)] flex-shrink-0">
                <div className="max-w-5xl mx-auto flex items-start gap-2">
                    <textarea
                        ref={textareaRef}
                        value={input}
                        onChange={(e) => setInput(e.target.value)}
                        onKeyDown={handleKeyDown}
                        placeholder="Ask a question... (Ctrl+Enter to send)"
                        className="flex-grow p-2 rounded-lg border-2 border-[var(--input)] bg-[var(--card)] text-[var(--card-foreground)] focus:border-[var(--ring)] focus:ring-[var(--ring)] resize-none transition-colors w-full max-h-40"
                        rows={1}
                        disabled={isLoading}
                        aria-label="Chat input"
                    />
                    <button
                        onClick={handleSend}
                        disabled={isLoading || !input.trim()}
                        className="p-3 rounded-lg bg-[var(--primary)] text-[var(--primary-foreground)] disabled:bg-[var(--muted)] disabled:cursor-not-allowed hover:bg-[var(--primary-hover)] transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[var(--ring)]"
                        aria-label="Send message"
                    >
                        {isLoading ? (
                            <div className="w-5 h-5 border-2 border-[var(--primary-foreground)] border-t-transparent rounded-full animate-spin"></div>
                        ) : (
                            <IconSend className="h-5 w-5" />
                        )}
                    </button>
                </div>
            </div>
        </div>
    );
};