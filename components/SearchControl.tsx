import React, { useRef, useEffect } from 'react';
import { IconSearch, IconX, IconChevronUp, IconChevronDown } from './Icons';

interface SearchControlProps {
  isSearchVisible: boolean;
  searchTerm: string;
  onSearchTermChange: (term: string) => void;
  totalMatches: number;
  currentMatchIndex: number; // 1-based
  onPrev: () => void;
  onNext: () => void;
  onClose: () => void;
}

export const SearchControl: React.FC<SearchControlProps> = ({ 
    isSearchVisible, 
    searchTerm, 
    onSearchTermChange, 
    totalMatches, 
    currentMatchIndex, 
    onPrev, 
    onNext, 
    onClose 
}) => {
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isSearchVisible) {
      // Use a timeout to ensure the element is visible before focusing
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [isSearchVisible]);

  if (!isSearchVisible) {
    return null;
  }
  
  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
        if (e.shiftKey) {
            onPrev();
        } else {
            onNext();
        }
    } else if (e.key === 'Escape') {
        onClose();
    }
  };


  return (
    <div className="flex-shrink-0 bg-white p-2 border-b border-gray-200 shadow-sm">
      <div className="flex items-center gap-2">
        <div className="relative flex-grow">
          <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
            <IconSearch className="h-5 w-5 text-slate-400" />
          </div>
          <input
            ref={inputRef}
            type="text"
            placeholder="Search..."
            value={searchTerm}
            onChange={(e) => onSearchTermChange(e.target.value)}
            onKeyDown={handleKeyDown}
            className="block w-full rounded-md border-slate-300 py-2 pl-10 pr-10 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
            aria-label="Search input"
          />
          {searchTerm && (
            <button
                onClick={() => onSearchTermChange('')}
                className="absolute inset-y-0 right-0 flex items-center pr-3 group"
                aria-label="Clear search"
            >
                <IconX className="h-5 w-5 text-slate-400 group-hover:text-slate-600" />
            </button>
          )}
        </div>

        {totalMatches > 0 && (
          <div className="flex items-center gap-1 flex-shrink-0 bg-slate-100 rounded-md p-1">
            <span className="text-sm text-slate-600 font-medium w-16 text-center" aria-live="polite">
                {currentMatchIndex} of {totalMatches}
            </span>
            <button 
                onClick={onPrev} 
                className="p-1 rounded-md text-slate-500 hover:bg-slate-200 hover:text-slate-700"
                aria-label="Previous result"
            >
              <IconChevronUp className="h-5 w-5" />
            </button>
            <button 
                onClick={onNext} 
                className="p-1 rounded-md text-slate-500 hover:bg-slate-200 hover:text-slate-700"
                aria-label="Next result"
            >
              <IconChevronDown className="h-5 w-5" />
            </button>
          </div>
        )}
        <button
            onClick={onClose}
            className="p-2 rounded-md text-slate-500 hover:bg-slate-200 hover:text-slate-700"
            aria-label="Close search"
        >
            <IconX className="h-5 w-5" />
        </button>
      </div>
    </div>
  );
};
