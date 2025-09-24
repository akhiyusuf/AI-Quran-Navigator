import React, { useState, useRef, useEffect } from 'react';
import type { Message, VerseLocation, GroundingChunk } from '../types';
import { IconUser, IconSparkles, IconSend, IconChevronDown, IconBookOpen, IconLink, IconCopy, IconCheck, IconAlertTriangle } from './Icons';

interface ChatBoxProps {
  messages: Message[];
  onSendMessage: (message: string) => void;
  isLoading: boolean;
  onViewVerses: (verses: VerseLocation[]) => void;
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

// Recursive function to parse and render inline markdown and citations
const renderInlineContent = (
    text: string,
    onViewVerses: (verses: VerseLocation[]) => void,
    options?: { renderCitations?: boolean }
): React.ReactNode => {
    const renderCitations = options?.renderCitations ?? true;

    if (!text) {
        return null;
    }

    // Regex for all supported inline tokens. The 's' flag allows '.' to match newlines (for multi-line bold).
    // Order is important: *** before **, *, and __ before _ to ensure correct matching.
    const tokenRegex = /(\*\*\*.*?\*\*\*|\*\*.*?\*\*|__.*?__|\*.*?\*|_.*?_|~~.*?~~|`.*?`|\[QURAN:\d+:\d+(?:-\d+)?\]|\b\d{1,3}:\d+(?:-\d+)?\b|\[[^\]]+\]\([^)]+\))/s;
    const match = text.match(tokenRegex);

    if (!match || typeof match.index === 'undefined') {
        return text; // Base case: no more tokens, return plain text
    }

    const before = text.substring(0, match.index);
    const matchedText = match[0];
    const after = text.substring(match.index + matchedText.length);

    let renderedMatch: React.ReactNode = matchedText;

    // Bold + Italic
    if (matchedText.startsWith('***') && matchedText.endsWith('***')) {
        const content = matchedText.slice(3, -3);
        renderedMatch = <strong><em>{renderInlineContent(content, onViewVerses, options)}</em></strong>;
    }
    // Bold text
    else if ((matchedText.startsWith('**') && matchedText.endsWith('**')) || (matchedText.startsWith('__') && matchedText.endsWith('__'))) {
        const content = matchedText.slice(2, -2);
        renderedMatch = <strong>{renderInlineContent(content, onViewVerses, options)}</strong>;
    }
    // Italic text (using underscores or asterisks)
    else if ((matchedText.startsWith('*') && matchedText.endsWith('*')) || (matchedText.startsWith('_') && matchedText.endsWith('_'))) {
        const content = matchedText.slice(1, -1);
        renderedMatch = <em>{renderInlineContent(content, onViewVerses, options)}</em>;
    }
    // Strikethrough text
    else if (matchedText.startsWith('~~') && matchedText.endsWith('~~')) {
        const content = matchedText.slice(2, -2);
        renderedMatch = <del>{renderInlineContent(content, onViewVerses, options)}</del>;
    }
    // Inline code
    else if (matchedText.startsWith('`') && matchedText.endsWith('`')) {
        const content = matchedText.slice(1, -1);
        // Code is not recursively parsed. The `prose` class will style it.
        // FIX: Replaced invalid `code>` with valid `<code>` JSX tag.
        renderedMatch = <code>{content}</code>;
    }
    // Markdown Link
    else if (matchedText.startsWith('[') && matchedText.includes('](')) {
        const linkMatch = matchedText.match(/\[([^\]]+)\]\(([^)]+)\)/);
        if (linkMatch) {
            const [, linkText, href] = linkMatch;
            // Link text is not recursively parsed. The `prose` class will style the link.
            renderedMatch = <a href={href} target="_blank" rel="noopener noreferrer">{linkText}</a>;
        }
    }
    // [QURAN:S:A-B] marker
    else if (renderCitations && matchedText.startsWith('[QURAN:')) {
        const quranMatch = matchedText.match(/\[QURAN:(\d+):(\d+)(?:-\d+)?\]/);
        if (quranMatch) {
            const [, surahStr, startAyahStr, endAyahStr] = quranMatch;
            const surah = parseInt(surahStr, 10);
            const startAyah = parseInt(startAyahStr, 10);
            const verses = createVersesFromRange(surah, startAyah, endAyahStr);
            const buttonText = endAyahStr ? `${surah}:${startAyah}-${endAyahStr}` : `${surah}:${startAyah}`;
            renderedMatch = (
                <button
                    onClick={() => onViewVerses(verses)}
                    className="inline-flex items-center mx-1 px-2 py-0.5 rounded-md bg-blue-100 text-blue-700 text-sm font-medium hover:bg-blue-200 transition-colors"
                    title={`View Surah ${surah}, Verse ${startAyah}${endAyahStr ? `-${endAyahStr}` : ''}`}
                >
                    {buttonText}
                </button>
            );
        }
    }
    // Standalone S:A-B pattern
    else if (renderCitations && matchedText.match(/\b(\d{1,3}):(\d+)(?:-\d+)?\b/)) {
        const versePatternMatch = matchedText.match(/\b(\d{1,3}):(\d+)(?:-\d+)?\b/);
        if (versePatternMatch) {
            const [, surahStr, startAyahStr, endAyahStr] = versePatternMatch;
            const surah = parseInt(surahStr, 10);
            const startAyah = parseInt(startAyahStr, 10);
            const verses = createVersesFromRange(surah, startAyah, endAyahStr);
            const buttonText = endAyahStr ? `${surah}:${startAyah}-${endAyahStr}` : `${surah}:${startAyah}`;
            renderedMatch = (
                <button
                    onClick={() => onViewVerses(verses)}
                    className="inline-flex items-center mx-1 px-2 py-0.5 rounded-md bg-blue-100 text-blue-700 text-sm font-medium hover:bg-blue-200 transition-colors"
                    title={`View Surah ${surah}, Verse ${startAyah}${endAyahStr ? `-${endAyahStr}` : ''}`}
                >
                    {buttonText}
                </button>
            );
        }
    }

    return (
        <>
            {renderInlineContent(before, onViewVerses, options)}
            {renderedMatch}
            {renderInlineContent(after, onViewVerses, options)}
        </>
    );
};

// Strips outer markdown formatting (like **...**) for more reliable block-level detection.
const getCoreContentForBlockParsing = (line: string): string => {
    let current = line.trim();
    // Recursively strip pairs of ** or *
    while (
        (current.startsWith('**') && current.endsWith('**') && current.length > 4) ||
        (current.startsWith('*') && current.endsWith('*') && current.length > 2)
    ) {
        current = current.slice(current.startsWith('**') ? 2 : 1, current.length - (current.startsWith('**') ? 2 : 1));
    }
    return current;
};


// Renders block-level elements by processing the text line by line.
const InterpretationRenderer: React.FC<{
  text: string;
  onViewVerses: (verses: VerseLocation[]) => void;
}> = ({ text, onViewVerses }) => {
    const lines = text.split('\n');
    const elements: React.ReactNode[] = [];
    let i = 0;

    const parseListRecursive = (
        currentLineIndex: number,
        initialIndent: number
    ): [React.ReactNode[], number] => {
        const listItems: React.ReactNode[] = [];
        let i = currentLineIndex;

        while (i < lines.length) {
            const line = lines[i];
            const coreContent = getCoreContentForBlockParsing(line);
            const indent = line.search(/\S|$/);
            const isListItem = /^\s*([\*\-]|\d+\.)\s/.test(coreContent);

            if (indent < initialIndent) {
                // Dedented, so this list level is done.
                break;
            }

            if (indent >= initialIndent && isListItem) {
                 // This is a list item at the current level or a sub-level.
                const itemContent = coreContent.replace(/^\s*([\*\-]|\d+\.)\s/, '');
                let sublist: React.ReactNode = null;

                // Look ahead to see if the next line is a more-indented list (a sublist).
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
                        i = newIndex - 1; // The recursive call returns the next line to process. Adjust index.
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
                // Not a list item for our level (could be empty, a paragraph, or dedented).
                break;
            }
        }
        return [listItems, i];
    };


    while (i < lines.length) {
        const line = lines[i];
        const coreContent = getCoreContentForBlockParsing(line);

        if (line.trim() === '') {
            i++;
            continue;
        }

        // Headings - check core content, but render the original content for inline parsing
        const headingMatch = coreContent.match(/^(#+)\s*(.*)/);
        if (headingMatch) {
            const level = Math.min(headingMatch[1].length, 6);
            const content = headingMatch[2]; // This is the text after "# " from the core content
            // FIX: The type `keyof JSX.IntrinsicElements` was causing a 'Cannot find namespace JSX' error.
            // Using a capitalized string variable as a tag was causing a construct signature error.
            // Using `React.createElement` with a string variable for the tag name is the correct and safe way to create dynamic elements.
            const Tag = `h${level}`;
            elements.push(React.createElement(Tag, { key: i }, renderInlineContent(content, onViewVerses, { renderCitations: false })));
            i++;
            continue;
        }
        
        // Blockquotes
        if (line.trim().startsWith('>')) {
            const bqLines = [];
            while (i < lines.length && lines[i].trim().startsWith('>')) {
                bqLines.push(lines[i].trim().replace(/^>\s?/, ''));
                i++;
            }
            elements.push(<blockquote key={i}><InterpretationRenderer text={bqLines.join('\n')} onViewVerses={onViewVerses} /></blockquote>);
            continue;
        }

        // Unordered & Ordered Lists (handles nesting)
        if (/^\s*([\*\-]|\d+\.)\s/.test(coreContent)) {
            const isOrdered = /^\s*\d+\./.test(coreContent);
            const ListTag = isOrdered ? 'ol' : 'ul';
            const initialIndent = line.search(/\S|$/);
            const [listItems, nextIndex] = parseListRecursive(i, initialIndent);
            elements.push(<ListTag key={`list-${i}`}>{listItems}</ListTag>);
            i = nextIndex;
            continue;
        }

        // Default to paragraph. A paragraph is a sequence of non-empty lines that don't start any other block type.
        const paraLines = [];
        while (
            i < lines.length &&
            lines[i].trim() !== ''
        ) {
            const currentCore = getCoreContentForBlockParsing(lines[i]);
             if (
                currentCore.startsWith('#') ||
                lines[i].trim().startsWith('>') ||
                /^\s*([\*\-]|\d+\.)\s/.test(currentCore)
            ) {
                break;
            }
            paraLines.push(lines[i]);
            i++;
        }

        if (paraLines.length > 0) {
            elements.push(<p key={`para-${i}`}>{renderInlineContent(paraLines.join('\n'), onViewVerses)}</p>);
        }
    }

    return <>{elements.map((el, idx) => <React.Fragment key={idx}>{el}</React.Fragment>)}</>;
};


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

const AIMessage: React.FC<{ message: Message; onViewVerses: (verses: VerseLocation[]) => void }> = ({ message, onViewVerses }) => {
  const [isInterpretationExpanded, setIsInterpretationExpanded] = useState(false);

  const hasInterpretation = message.interpretation && message.interpretation.trim().length > 0;
  const hasFooterContent = (message.verses && message.verses.length > 0) || (message.groundingChunks && message.groundingChunks.length > 0);

  return (
    <div className="flex items-start gap-3">
        <div className="flex-shrink-0 h-8 w-8 rounded-full bg-slate-200 flex items-center justify-center">
            <IconSparkles className="h-5 w-5 text-slate-500" />
        </div>
        <div className="flex-grow bg-white rounded-lg rounded-tl-none p-4 border border-slate-200">
            {/* Acknowledgement Text */}
            <div className="prose prose-sm max-w-none text-slate-700">
                <p>{message.text}</p>
            </div>

            {/* Optional content below a divider */}
            {(hasInterpretation || hasFooterContent) && (
                <div className="mt-3 pt-3 border-t border-slate-200 space-y-4">
                    {/* Collapsible Interpretation Section */}
                    {hasInterpretation && (
                        <div>
                            <button
                                onClick={() => setIsInterpretationExpanded(!isInterpretationExpanded)}
                                className="flex items-center justify-between w-full text-left"
                                aria-expanded={isInterpretationExpanded}
                                aria-controls="ai-interpretation-content"
                            >
                                <span className="font-semibold text-slate-700">AI's Summary</span>
                                <IconChevronDown
                                    className={`h-5 w-5 text-slate-500 transition-transform ${isInterpretationExpanded ? 'rotate-180' : ''}`}
                                />
                            </button>
                            {isInterpretationExpanded && (
                                <div id="ai-interpretation-content" className="mt-3 prose prose-sm max-w-none text-slate-700">
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

                    {/* View Verses button */}
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

                    {/* Grounding Sources */}
                    {message.groundingChunks && message.groundingChunks.length > 0 && (
                        <GroundingChunksRenderer chunks={message.groundingChunks} />
                    )}
                </div>
            )}
        </div>
    </div>
  );
};


const UserMessage: React.FC<{ message: Message }> = ({ message }) => {
    return (
        <div className="flex items-start gap-3 justify-end">
            <div className="flex-grow bg-blue-500 rounded-lg rounded-br-none p-4">
                <p className="text-white">{message.text}</p>
            </div>
            <div className="flex-shrink-0 h-8 w-8 rounded-full bg-slate-700 flex items-center justify-center">
                <IconUser className="h-5 w-5 text-slate-200" />
            </div>
        </div>
    );
};


export const ChatBox: React.FC<ChatBoxProps> = ({ messages, onSendMessage, isLoading, onViewVerses }) => {
    const [input, setInput] = useState('');
    const messagesEndRef = useRef<HTMLDivElement>(null);
    const textareaRef = useRef<HTMLTextAreaElement>(null);

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    };

    useEffect(scrollToBottom, [messages]);
    
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

    return (
        <div className="flex flex-col h-full bg-slate-50">
            <div className="flex-grow p-4 overflow-y-auto">
                <div className="space-y-6 max-w-3xl mx-auto">
                    {messages.map((msg, index) =>
                        msg.sender === 'ai' ? (
                            <AIMessage key={index} message={msg} onViewVerses={onViewVerses} />
                        ) : (
                            <UserMessage key={index} message={msg} />
                        )
                    )}
                    <div ref={messagesEndRef} />
                </div>
            </div>
            <div className="p-4 bg-white border-t border-slate-200 flex-shrink-0">
                <div className="max-w-3xl mx-auto flex items-start gap-2">
                    <textarea
                        ref={textareaRef}
                        value={input}
                        onChange={(e) => setInput(e.target.value)}
                        onKeyPress={handleKeyPress}
                        placeholder="Ask a question..."
                        className="flex-grow p-2 rounded-lg border-2 border-slate-300 focus:border-blue-500 focus:ring-blue-500 resize-none transition-colors w-full"
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
