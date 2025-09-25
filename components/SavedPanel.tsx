import React from 'react';
import type { Message, SavedMessage, Match } from '../types';
import { IconStar, IconTrash, IconMessageCircle } from './Icons';

interface SavedPanelProps {
  savedMessages: SavedMessage[];
  onGoToChat: (chatId: string) => void;
  onRemoveSaved: (message: Message) => void;
  searchTerm: string;
  activeMatch: Match<string> | null;
}

const Highlight: React.FC<{ 
  text: string; 
  highlight: string;
  isParentActive: boolean;
  activeOccurrenceInParent: number;
  occurrenceOffset: number;
}> = ({ text, highlight, isParentActive, activeOccurrenceInParent, occurrenceOffset }) => {
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
          const isActive = isParentActive && (occurrenceOffset + occurrenceCounter) === activeOccurrenceInParent;
          occurrenceCounter++;
          return (
            <mark key={i} className={`rounded px-0.5 py-0 transition-colors ${isActive ? 'bg-orange-400 text-white' : 'bg-yellow-200 text-slate-800'}`}>
              {part}
            </mark>
          );
        }
        return part;
      })}
    </>
  );
};


const SavedMessageItem: React.FC<{
  saved: SavedMessage;
  onGoToChat: (chatId: string) => void;
  onRemoveSaved: (message: Message) => void;
  searchTerm: string;
  activeMatch: Match<string> | null;
}> = ({ saved, onGoToChat, onRemoveSaved, searchTerm, activeMatch }) => {
  const { message, chatTitle, chatId } = saved;
  const contentSnippet = message.interpretation?.substring(0, 100) || message.text;
  const isParentActive = activeMatch?.itemId === saved.id;

  const getMatchesCount = (text: string) => {
    if (!searchTerm) return 0;
    const safeHighlight = searchTerm.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&');
    const regex = new RegExp(safeHighlight, 'gi');
    return (text.match(regex) || []).length;
  };

  const matchesInTitle = getMatchesCount(chatTitle);

  return (
    <li className={`group p-4 border-b border-gray-200 last:border-b-0 transition-colors duration-150 ${isParentActive ? 'bg-yellow-100' : ''}`}>
      <div className="flex justify-between items-start">
        <div className="flex-grow pr-4">
          <p className="text-sm text-slate-600 line-clamp-3">
            <Highlight 
              text={contentSnippet} 
              highlight={searchTerm} 
              isParentActive={isParentActive}
              activeOccurrenceInParent={activeMatch?.occurrenceInItem ?? -1}
              occurrenceOffset={matchesInTitle} // Content matches come after title matches
            />
            {contentSnippet.length === 100 && '...'}
          </p>
          <div className="mt-2 text-xs text-slate-400">
            From: <span className="font-medium text-slate-500">
                <Highlight 
                  text={chatTitle} 
                  highlight={searchTerm} 
                  isParentActive={isParentActive}
                  activeOccurrenceInParent={activeMatch?.occurrenceInItem ?? -1}
                  occurrenceOffset={0}
                />
            </span>
          </div>
        </div>
        <button
          onClick={() => onRemoveSaved(message)}
          className="flex-shrink-0 p-2 rounded-full text-slate-400 hover:bg-red-100 hover:text-red-600 opacity-0 group-hover:opacity-100 transition-all"
          aria-label="Remove saved message"
        >
          <IconTrash className="h-5 w-5" />
        </button>
      </div>
      <div className="mt-3">
        <button
          onClick={() => onGoToChat(chatId)}
          className="inline-flex items-center gap-2 px-3 py-1 text-xs font-medium text-blue-700 bg-blue-100 rounded-full hover:bg-blue-200 transition-colors"
        >
          <IconMessageCircle className="w-4 h-4" />
          Go to Conversation
        </button>
      </div>
    </li>
  );
};

export const SavedPanel: React.FC<SavedPanelProps> = ({ savedMessages, onGoToChat, onRemoveSaved, searchTerm, activeMatch }) => {
  if (savedMessages.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-center text-slate-500 p-4 bg-white">
        <IconStar className="h-12 w-12 mb-4" />
        <h3 className="font-semibold text-slate-700">No Saved Replies</h3>
        <p className="text-sm">Click the star icon on an AI reply to save it here for later.</p>
      </div>
    );
  }

  return (
    <div className="h-full flex-grow overflow-y-auto bg-white">
      <ul className="">
        {savedMessages.map((saved) => (
          <SavedMessageItem
            key={saved.id}
            saved={saved}
            onGoToChat={onGoToChat}
            onRemoveSaved={onRemoveSaved}
            searchTerm={searchTerm}
            activeMatch={activeMatch}
          />
        ))}
      </ul>
    </div>
  );
};