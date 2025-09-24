import React from 'react';
import type { ChatSession } from '../types';
import { IconHistory, IconTrash } from './Icons';

interface HistoryPanelProps {
  history: ChatSession[];
  activeChatId: string | null;
  onSelectChat: (id: string) => void;
  onDeleteChat: (id: string) => void;
}

export const HistoryPanel: React.FC<HistoryPanelProps> = ({ history, activeChatId, onSelectChat, onDeleteChat }) => {
  if (history.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-center text-slate-500 p-4 bg-white">
        <IconHistory className="h-12 w-12 mb-4" />
        <h3 className="font-semibold text-slate-700">No History Yet</h3>
        <p className="text-sm">Your conversations will be saved here.</p>
      </div>
    );
  }

  return (
    <div className="h-full flex-grow overflow-y-auto bg-white">
      <ul className="divide-y divide-gray-200">
        {history.map((chat) => (
          <li 
            key={chat.id} 
            className={`group flex items-center justify-between transition-colors duration-150 ${activeChatId === chat.id ? 'bg-blue-50' : 'hover:bg-slate-50'}`}
          >
            <button
              onClick={() => onSelectChat(chat.id)}
              className="text-left w-full px-4 py-3"
            >
              <p className={`font-semibold truncate ${activeChatId === chat.id ? 'text-blue-700' : 'text-slate-800'}`}>{chat.title}</p>
              <p className="text-sm text-slate-500">{new Date(chat.createdAt).toLocaleString()}</p>
            </button>
            <button
              onClick={(e) => {
                  e.stopPropagation();
                  onDeleteChat(chat.id);
              }}
              className="mr-4 ml-2 p-2 rounded-full text-slate-400 hover:bg-red-100 hover:text-red-600 opacity-0 group-hover:opacity-100 focus:opacity-100 transition-all duration-200"
              aria-label={`Delete conversation: ${chat.title}`}
            >
              <IconTrash className="h-5 w-5" />
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
};