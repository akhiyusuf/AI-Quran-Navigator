import React from 'react';
import type { ChatSession, Match } from '../types';
import { IconHistory, IconTrash } from './Icons';

interface HistoryPanelProps {
  history: ChatSession[];
  activeChatId: string | null;
  onSelectChat: (id: string) => void;
  onDeleteChat: (id: string) => void;
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

export const HistoryPanel: React.FC<HistoryPanelProps> = ({ history, activeChatId, onSelectChat, onDeleteChat, searchTerm, activeMatch }) => {
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
              className={`group flex items-center justify-between transition-colors duration-150 ${bgClass}`}
            >
              <button
                onClick={() => onSelectChat(chat.id)}
                className="text-left w-full px-4 py-3"
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
              <button
                onClick={(e) => {
                    e.stopPropagation();
                    onDeleteChat(chat.id);
                }}
                className="mr-4 ml-2 p-2 rounded-full text-[var(--muted-foreground)] hover:bg-[var(--destructive-soft)] hover:text-[var(--destructive)] opacity-0 group-hover:opacity-100 focus:opacity-100 transition-all duration-200"
                aria-label={`Delete conversation: ${chat.title}`}
              >
                <IconTrash className="h-5 w-5" />
              </button>
            </li>
          )
        })}
      </ul>
    </div>
  );
};