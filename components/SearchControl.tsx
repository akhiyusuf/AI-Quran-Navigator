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
    <div className="flex-shrink-0 bg-[var(--muted)] py-1">
      <div className="flex items-center gap-2">
        <div className="relative flex-grow">
          <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
            <IconSearch className="h-4 w-4 text-[var(--muted-foreground)]" />
          </div>
          <input
            ref={inputRef}
            type="text"
            placeholder="Search history..."
            value={searchTerm}
            onChange={(e) => onSearchTermChange(e.target.value)}
            onKeyDown={handleKeyDown}
            className="block w-full rounded-md border-[var(--input)] bg-[var(--card)] text-[var(--card-foreground)] py-1.5 pl-9 pr-10 shadow-sm focus:border-[var(--ring)] focus:ring-[var(--ring)] sm:text-sm"
            aria-label="Search input"
          />
          {searchTerm && (
            <div className="absolute inset-y-0 right-0 flex items-center pr-1">
              {totalMatches > 0 && (
                <div className="flex items-center gap-0.5 flex-shrink-0">
                  <span className="text-xs text-[var(--muted-foreground)] font-medium w-14 text-center" aria-live="polite">
                      {currentMatchIndex} of {totalMatches}
                  </span>
                  <button 
                      onClick={onPrev} 
                      className="p-1 rounded-md text-[var(--muted-foreground)] hover:bg-[var(--accent)] hover:text-[var(--accent-foreground)]"
                      aria-label="Previous result"
                  >
                    <IconChevronUp className="h-4 w-4" />
                  </button>
                  <button 
                      onClick={onNext} 
                      className="p-1 rounded-md text-[var(--muted-foreground)] hover:bg-[var(--accent)] hover:text-[var(--accent-foreground)]"
                      aria-label="Next result"
                  >
                    <IconChevronDown className="h-4 w-4" />
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};