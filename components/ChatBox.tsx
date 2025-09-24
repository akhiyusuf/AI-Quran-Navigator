import React, { useState, useRef, useEffect } from 'react';
import type { Message, VerseLocation } from '../types';
import { IconUser, IconSparkles, IconSend, IconLink, IconChevronDown, IconBookOpen } from './Icons';

interface ChatBoxProps {
  messages: Message[];
  onSendMessage: (message: string) => void;
  isLoading: boolean;
  onViewVerses: (verses: VerseLocation[]) => void;
}

const AIMessageBubble: React.FC<{ msg: Message; onViewVerses: (verses: VerseLocation[]) => void; }> = ({ msg, onViewVerses }) => {
  const [isExpanded, setIsExpanded] = useState(false);

  return (
    <div className="max-w-xs md:max-w-md p-3 rounded-2xl bg-slate-100 text-slate-800 rounded-bl-none">
      <p className="text-sm leading-relaxed whitespace-pre-wrap">{msg.text}</p>
      
      {msg.interpretation && (
        <div className="mt-3 pt-3 border-t border-slate-200/80">
          <button 
            onClick={() => setIsExpanded(!isExpanded)}
            className="flex items-center justify-between w-full text-sm font-medium text-slate-600 hover:text-slate-800 transition-colors"
            aria-expanded={isExpanded}
          >
            <span>AI Interpretation</span>
            <IconChevronDown className={`h-5 w-5 transform transition-transform duration-200 ${isExpanded ? 'rotate-180' : ''}`} />
          </button>
          {isExpanded && (
            <div className="mt-2 text-sm text-slate-700 bg-slate-200/50 p-3 rounded-md">
              <p className="italic text-xs text-slate-500 mb-2">
                Note: This interpretation is AI-generated and may not be fully accurate. Always refer to scholarly sources.
              </p>
              <p className="whitespace-pre-wrap">{msg.interpretation}</p>
            </div>
          )}
        </div>
      )}

      {msg.groundingChunks && msg.groundingChunks.length > 0 && (
        <div className={`mt-4 pt-3 ${msg.interpretation ? 'border-t border-slate-200/80' : ''}`}>
          <h4 className="text-xs font-semibold text-slate-500 mb-2">Sources</h4>
          <ul className="space-y-2">
            {msg.groundingChunks.map((source, i) => (
              <li key={i} className="flex items-start gap-2">
                <IconLink className="h-3.5 w-3.5 flex-shrink-0 text-slate-400 mt-0.5" />
                <a 
                    href={source.web.uri} 
                    target="_blank" 
                    rel="noopener noreferrer" 
                    title={source.web.title || source.web.uri}
                    className="text-xs text-blue-600 hover:underline truncate block"
                >
                  {source.web.title || new URL(source.web.uri).hostname}
                </a>
              </li>
            ))}
          </ul>
        </div>
      )}
      
      <div className="grid grid-cols-1 gap-2 mt-4 pt-3 border-t border-slate-200/80">
        {msg.verses && msg.verses.length > 0 && (
            <button 
              onClick={() => onViewVerses(msg.verses!)}
              className="w-full flex items-center justify-center gap-2 text-center px-4 py-2 bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700 transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-slate-100 focus:ring-blue-500"
            >
              <IconBookOpen className="h-5 w-5" />
              <span>View Verses</span>
            </button>
        )}
       </div>
    </div>
  );
};


export const ChatBox: React.FC<ChatBoxProps> = ({ messages, onSendMessage, isLoading, onViewVerses }) => {
  const [input, setInput] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(scrollToBottom, [messages]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (input.trim() && !isLoading) {
      onSendMessage(input.trim());
      setInput('');
    }
  };

  return (
    <div className="flex flex-col h-full bg-white">
      <div className="flex-grow p-4 overflow-y-auto">
        <div className="space-y-6">
          {messages.map((msg, index) => (
            <div key={index} className={`flex items-start gap-3 ${msg.sender === 'user' ? 'justify-end' : ''}`}>
              {msg.sender === 'ai' && (
                <div className="flex-shrink-0 h-8 w-8 rounded-full bg-slate-200 flex items-center justify-center">
                  <IconSparkles className="h-5 w-5 text-slate-600" />
                </div>
              )}
              {msg.sender === 'ai' ? (
                <AIMessageBubble msg={msg} onViewVerses={onViewVerses} />
              ) : (
                <div className="max-w-xs md:max-w-md p-3 rounded-2xl bg-blue-600 text-white rounded-br-none">
                  <p className="text-sm leading-relaxed whitespace-pre-wrap">{msg.text}</p>
                </div>
              )}
              {msg.sender === 'user' && (
                 <div className="flex-shrink-0 h-8 w-8 rounded-full bg-slate-200 flex items-center justify-center">
                    <IconUser className="h-5 w-5 text-slate-600" />
                 </div>
              )}
            </div>
          ))}
          {isLoading && (
            <div className="flex items-start gap-3">
              <div className="flex-shrink-0 h-8 w-8 rounded-full bg-slate-200 flex items-center justify-center">
                <IconSparkles className="h-5 w-5 text-slate-600" />
              </div>
              <div className="max-w-xs md:max-w-md p-3 rounded-2xl bg-slate-100 text-slate-800 rounded-bl-none">
                <div className="flex items-center space-x-2">
                    <div className="w-2 h-2 bg-slate-400 rounded-full animate-pulse [animation-delay:-0.3s]"></div>
                    <div className="w-2 h-2 bg-slate-400 rounded-full animate-pulse [animation-delay:-0.15s]"></div>
                    <div className="w-2 h-2 bg-slate-400 rounded-full animate-pulse"></div>
                </div>
              </div>
            </div>
          )}
        </div>
        <div ref={messagesEndRef} />
      </div>
      <div className="p-4 border-t border-gray-200 bg-white flex-shrink-0">
        <form onSubmit={handleSubmit} className="relative">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="e.g. A verse on charity..."
            disabled={isLoading}
            className="w-full pl-4 pr-12 py-3 bg-slate-100 border border-slate-200 rounded-full focus:outline-none focus:ring-2 focus:ring-blue-500 transition-shadow duration-200"
          />
          <button
            type="submit"
            disabled={isLoading || !input.trim()}
            className="absolute right-2 top-1/2 -translate-y-1/2 h-9 w-9 bg-blue-600 text-white rounded-full flex items-center justify-center disabled:bg-slate-400 disabled:cursor-not-allowed hover:bg-blue-700 transition-colors"
          >
            <IconSend className="h-5 w-5" />
          </button>
        </form>
      </div>
    </div>
  );
};
