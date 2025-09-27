import React, { useState, useRef, useEffect } from 'react';
import type { ChatSession, Match } from '../types';
import { IconHistory, IconTrash, IconMoreHorizontal, IconPencil } from './Icons';

interface HistoryPanelProps {
  history: ChatSession[];
  activeChatId: string | null;
  onSelectChat: (id: string) => void;
  onDeleteChat: (id: string) => void;
  onRenameChat: (id: string, newTitle: string) => void;
  searchTerm: string;
  activeMatch: Match<string> | null;
}

const Highlight: React.FC<{ 
  text: string; 
  highlight: string;
  isParentActive: boolean;
  activeOccurrenceInParent: number;
}> = ({ text, highlight, isParentActive, activeOccurrenceInParent }) => {
  if (!highlight) {
    return <>{text}</>;
  }
  const safeHighlight = highlight.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&');
  const regex = new RegExp(`(${safeHighlight})`, 'gi');
  const parts = text.split(regex);
  let occurrenceCounter = 0;
  
  return (
    <>
      {parts.map((part, i) => {
        if (regex.test(part)) {
          const isActive = isParentActive && occurrenceCounter === activeOccurrenceInParent;
          occurrenceCounter++;
          return (
            <mark key={i} className={`rounded px-0.5 py-0 transition-colors ${isActive ? 'bg-[var(--highlight-active)] text-[var(--highlight-active-foreground)]' : 'bg-[var(--highlight)] text-[var(--foreground)]'}`}>
              {part}
            </mark>
          );
        }
        return part;
      })}
    </>
  );
};

export const HistoryPanel: React.FC<HistoryPanelProps> = ({ history, activeChatId, onSelectChat, onDeleteChat, onRenameChat, searchTerm, activeMatch }) => {
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState('');
  const menuRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setOpenMenuId(null);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  useEffect(() => {
    if (renamingId && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [renamingId]);

  const handleStartRename = (chat: ChatSession) => {
    setRenamingId(chat.id);
    setRenameValue(chat.title);
    setOpenMenuId(null);
  };

  const handleConfirmRename = () => {
    if (renamingId && renameValue.trim()) {
      onRenameChat(renamingId, renameValue);
    }
    setRenamingId(null);
  };

  const handleCancelRename = () => {
    setRenamingId(null);
  };

  const handleRenameKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleConfirmRename();
    } else if (e.key === 'Escape') {
      handleCancelRename();
    }
  };

  if (history.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-center text-[var(--muted-foreground)] p-4 bg-[var(--card)]">
        <IconHistory className="h-12 w-12 mb-4" />
        <h3 className="font-semibold text-[var(--foreground)]">No History Yet</h3>
        <p className="text-sm">Your conversations will be saved here.</p>
      </div>
    );
  }

  return (
    <div className="h-full flex-grow overflow-y-auto bg-[var(--card)]">
      <ul className="divide-y divide-[var(--border)]">
        {history.map((chat) => {
          const isCurrentActiveChat = activeChatId === chat.id;
          const isActiveSearchResult = activeMatch?.itemId === chat.id;

          let bgClass = 'hover:bg-[var(--accent)]';
          if (isActiveSearchResult) {
            bgClass = 'bg-[var(--highlight)]'; // Highlight for active search result
          } else if (isCurrentActiveChat) {
            bgClass = 'bg-[var(--primary-soft)]'; // Highlight for currently open chat
          }
          
          return (
            <li 
              key={chat.id} 
              className={`group relative flex items-center justify-between transition-colors duration-150 ${bgClass}`}
            >
              {renamingId === chat.id ? (
                <div className="flex-grow px-4 py-3">
                    <input
                        ref={inputRef}
                        type="text"
                        value={renameValue}
                        onChange={(e) => setRenameValue(e.target.value)}
                        onKeyDown={handleRenameKeyDown}
                        onBlur={handleConfirmRename}
                        className="w-full bg-transparent border-b border-[var(--primary)] text-[var(--foreground)] font-semibold focus:outline-none"
                    />
                </div>
              ) : (
                <>
                  <button
                    onClick={() => onSelectChat(chat.id)}
                    className="flex-grow min-w-0 text-left px-4 py-3"
                  >
                    <p className={`font-semibold truncate ${isCurrentActiveChat ? 'text-[var(--primary-soft-foreground)]' : 'text-[var(--foreground)]'}`}>
                        <Highlight 
                          text={chat.title} 
                          highlight={searchTerm}
                          isParentActive={isActiveSearchResult}
                          activeOccurrenceInParent={activeMatch?.occurrenceInItem ?? -1}
                        />
                    </p>
                    <p className="text-sm text-[var(--muted-foreground)]">{new Date(chat.createdAt).toLocaleString()}</p>
                  </button>
                  <div className="flex-shrink-0 mr-2">
                    <button
                        onClick={(e) => {
                            e.stopPropagation();
                            setOpenMenuId(openMenuId === chat.id ? null : chat.id);
                        }}
                        className="p-2 rounded-full text-[var(--muted-foreground)] hover:bg-[var(--accent)] hover:text-[var(--accent-foreground)]"
                        aria-label={`Options for ${chat.title}`}
                        >
                        <IconMoreHorizontal className="h-5 w-5" />
                    </button>
                    {openMenuId === chat.id && (
                        <div
                            ref={menuRef}
                            className="absolute right-4 top-full mt-1 w-40 bg-[var(--card)] rounded-md shadow-lg ring-1 ring-black ring-opacity-5 z-20"
                            role="menu"
                        >
                            <div className="py-1">
                                <button
                                    onClick={(e) => { e.stopPropagation(); handleStartRename(chat); }}
                                    className="w-full text-left flex items-center gap-3 px-4 py-2 text-sm text-[var(--foreground)] hover:bg-[var(--accent)]"
                                    role="menuitem"
                                >
                                    <IconPencil className="h-4 w-4" />
                                    <span>Rename</span>
                                </button>
                                <button
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        onDeleteChat(chat.id);
                                        setOpenMenuId(null);
                                    }}
                                    className="w-full text-left flex items-center gap-3 px-4 py-2 text-sm text-[var(--destructive)] hover:bg-[var(--destructive-soft)]"
                                    role="menuitem"
                                >
                                    <IconTrash className="h-4 w-4" />
                                    <span>Delete</span>
                                </button>
                            </div>
                        </div>
                    )}
                  </div>
                </>
              )}
            </li>
          )
        })}
      </ul>
    </div>
  );
};
