import { useState, useMemo, useCallback, useEffect } from 'react';

// Represents one found occurrence of the search term.
export interface Match<K> {
  itemId: K; // The ID of the item where the match was found.
  occurrenceInItem: number; // 0-based index of this match within its parent item's text.
  globalIndex: number; // 0-based index of this match in the grand scheme of all matches.
}

// The hook's return type.
export interface SearchResult<K> {
  matches: Match<K>[];
  activeMatch: Match<K> | null;
  totalMatches: number;
  goToNext: () => void;
  goToPrev: () => void;
}

// A new, more powerful useSearch hook for word-by-word navigation.
export const useSearch = <T, K>(
  data: T[],
  searchTerm: string,
  // Function to get all searchable text from an item as a single string.
  textSelector: (item: T) => string,
  idSelector: (item: T) => K
): SearchResult<K> => {
  const [activeMatchIndex, setActiveMatchIndex] = useState(0);

  const matches = useMemo((): Match<K>[] => {
    const term = searchTerm.trim().toLowerCase();
    if (!term) {
      return [];
    }
    
    const allMatches: Match<K>[] = [];
    const safeTerm = term.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&');
    const regex = new RegExp(safeTerm, 'gi');

    data.forEach(item => {
      const text = textSelector(item)?.toLowerCase() ?? '';
      const itemId = idSelector(item);
      
      let matchResult;
      let occurrenceInItem = 0;
      while ((matchResult = regex.exec(text)) !== null) {
        allMatches.push({
          itemId,
          occurrenceInItem,
          globalIndex: allMatches.length,
        });
        occurrenceInItem++;
      }
    });

    return allMatches;
  }, [data, searchTerm, textSelector, idSelector]);

  // Reset index when search term or data changes.
  useEffect(() => {
    setActiveMatchIndex(0);
  }, [searchTerm, data]);

  const totalMatches = matches.length;

  const goToNext = useCallback(() => {
    if (totalMatches > 0) {
      setActiveMatchIndex(prev => (prev + 1) % totalMatches);
    }
  }, [totalMatches]);

  const goToPrev = useCallback(() => {
    if (totalMatches > 0) {
      setActiveMatchIndex(prev => (prev - 1 + totalMatches) % totalMatches);
    }
  }, [totalMatches]);

  const activeMatch = totalMatches > 0 ? matches[activeMatchIndex] : null;

  return {
    matches,
    activeMatch,
    totalMatches,
    goToNext,
    goToPrev,
  };
};
