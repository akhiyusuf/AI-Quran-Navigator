import React, { useEffect, useRef, useMemo, forwardRef, useImperativeHandle, useState } from 'react';
import type { Surah, VerseLocation, Ayah } from '../types';
import { IconInfo, IconBookmark, IconArrowLeft, IconComment, IconChevronsRight } from './Icons';

export interface QuranViewerRef {
  scrollToVerse: (verse: VerseLocation) => void;
}

interface QuranViewerProps {
  quranData: Surah[];
  targetVerses: VerseLocation[];
  onShowTafsir: (surah: number, ayah: number) => void;
  bookmarks: VerseLocation[];
  onToggleBookmark: (verse: VerseLocation) => void;
  onBackToChat: () => void;
  onCollapse?: () => void;
}

const getVerseRangeString = (ayahs: number[]): string => {
    if (ayahs.length === 0) return "";
    if (ayahs.length === 1) return `Verse ${ayahs[0]}`;

    const sortedAyahs = [...ayahs].sort((a, b) => a - b);
    
    let isContiguous = true;
    for (let i = 1; i < sortedAyahs.length; i++) {
        if (sortedAyahs[i] !== sortedAyahs[i - 1] + 1) {
            isContiguous = false;
            break;
        }
    }

    if (isContiguous) {
        return `Verses ${sortedAyahs[0]} - ${sortedAyahs[sortedAyahs.length - 1]}`;
    } else {
        return `${ayahs.length} selected verses`;
    }
};

const Verse: React.FC<{
    surah: Surah;
    verse: Ayah;
    isBookmarked: boolean;
    isHighlighted: boolean;
    onShowTafsir: (surah: number, ayah: number) => void;
    onToggleBookmark: (verse: VerseLocation) => void;
    setRef: (el: HTMLDivElement | null) => void;
}> = ({ surah, verse, isBookmarked, isHighlighted, onShowTafsir, onToggleBookmark, setRef }) => {
    const verseLocation = { surah: surah.id, ayah: verse.id };
    return (
        <div
            ref={setRef}
            className={`p-4 rounded-lg transition-all duration-500 ${
                isHighlighted ? 'bg-[var(--primary-soft)] border-[var(--primary)] border-l-4' : 'bg-[var(--card)] border-transparent border-l-4'
            }`}
            >
                <div className="flex justify-between items-start mb-4">
                    <div className="flex items-center gap-2">
                        <span className="text-sm font-semibold text-[var(--primary-soft-foreground)] bg-[var(--primary-soft)] px-3 py-1 rounded-full">{surah.id}:{verse.id}</span>
                        <button
                            onClick={() => onShowTafsir(surah.id, verse.id)}
                            className="text-[var(--muted-foreground)] hover:text-[var(--primary)] transition-colors p-1 rounded-full"
                            aria-label={`Show Tafsir for Surah ${surah.id}, Verse ${verse.id}`}
                        >
                            <IconInfo className="h-5 w-5" />
                        </button>
                        <button
                            onClick={() => onToggleBookmark(verseLocation)}
                            className={`transition-colors p-1 rounded-full ${isBookmarked ? 'text-[var(--primary)]' : 'text-[var(--muted-foreground)] hover:text-[var(--primary)]'}`}
                            aria-label={`${isBookmarked ? 'Remove bookmark' : 'Add bookmark'} for Surah ${surah.id}, Verse ${verse.id}`}
                        >
                            <IconBookmark className={`h-5 w-5 ${isBookmarked ? 'fill-current' : ''}`} />
                        </button>
                    </div>
                    <p dir="rtl" className="arabic-text text-3xl text-right text-[var(--foreground)] leading-loose">
                    {verse.text}
                    </p>
                </div>
                <p className="text-[var(--muted-foreground)] leading-relaxed text-left">{verse.translation}</p>
        </div>
    );
};

const SurahHeader: React.FC<{ surah: Surah; isSticky?: boolean; onBack?: () => void; verseRangeString?: string; showBackButton?: boolean; onCollapse?: () => void; }> = ({ surah, isSticky = false, onBack, verseRangeString, showBackButton, onCollapse }) => (
    <header className={`p-4 border-b border-[var(--border)] bg-[var(--card)] flex justify-between items-center ${isSticky ? 'sticky top-0 z-10' : 'flex-shrink-0'}`}>
        <div className="flex items-center gap-2">
            {onBack && showBackButton && (
                <button 
                    onClick={onBack}
                    className="lg:hidden p-2 -ml-2 rounded-full text-[var(--muted-foreground)] hover:bg-[var(--accent)]"
                    aria-label="Back to chat"
                >
                    <IconArrowLeft className="h-6 w-6" />
                </button>
            )}
            {onCollapse && showBackButton && (
                <button onClick={onCollapse} className="hidden lg:flex p-2 -ml-2 rounded-full text-[var(--muted-foreground)] hover:bg-[var(--accent)]" title="Collapse Viewer">
                    <IconChevronsRight className="h-5 w-5" />
                </button>
            )}
            <div>
                <h2 className="text-2xl font-bold text-[var(--foreground)]">{surah.id}. {surah.transliteration}</h2>
                {verseRangeString ? (
                    <p className="text-[var(--muted-foreground)]">{verseRangeString}</p>
                ) : (
                    <p className="text-[var(--muted-foreground)]">"{surah.translation}" - {surah.total_verses} Verses</p>
                )}
            </div>
        </div>
        <div className="flex items-center gap-3">
          <h2 className="text-4xl arabic-text font-semibold text-[var(--foreground)]">{surah.name}</h2>
        </div>
    </header>
);

const VerseTray: React.FC<{ verses: VerseLocation[], onVerseClick: (verse: VerseLocation) => void }> = ({ verses, onVerseClick }) => {
    if (verses.length === 0) {
        return null;
    }

    const sortedVerses = [...verses].sort((a, b) => {
        if (a.surah !== b.surah) return a.surah - b.surah;
        return a.ayah - b.ayah;
    });
    
    return (
        <div className="hidden lg:block absolute bottom-0 left-0 right-0 z-20 bg-[var(--card)] border-t border-[var(--border)] p-2 shadow-lg">
            <div className="flex items-center gap-2 overflow-x-auto pb-2">
                <span className="text-sm font-semibold text-[var(--muted-foreground)] px-2 flex-shrink-0">Cited Verses:</span>
                {sortedVerses.map((verse, index) => (
                    <button
                        key={`${verse.surah}:${verse.ayah}:${index}`}
                        onClick={() => onVerseClick(verse)}
                        className="flex-shrink-0 px-3 py-1.5 text-sm font-medium bg-[var(--primary)] text-[var(--primary-foreground)] rounded-full hover:bg-[var(--primary-hover)] transition-colors whitespace-nowrap"
                    >
                        {verse.surah}:{verse.ayah}
                    </button>
                ))}
            </div>
        </div>
    );
}

// Helper function to group verses. Moved outside the component to prevent re-creation on every render.
const groupVerses = (verses: VerseLocation[]): VerseLocation[][] => {
    if (!verses || verses.length === 0) return [];

    const sortedVerses = [...verses].sort((a, b) => {
        if (a.surah !== b.surah) return a.surah - b.surah;
        return a.ayah - b.ayah;
    });
    
    const groups: VerseLocation[][] = [];
    if (sortedVerses.length === 0) return groups;

    let currentGroup: VerseLocation[] = [sortedVerses[0]];
    // Only group verses if they are consecutive. A gap of even 1 verse creates a new group.
    const GROUP_GAP_THRESHOLD = 1; 

    for (let i = 1; i < sortedVerses.length; i++) {
        const prev = sortedVerses[i - 1];
        const current = sortedVerses[i];

        if (current.surah === prev.surah && (current.ayah - prev.ayah) <= GROUP_GAP_THRESHOLD) {
            currentGroup.push(current);
        } else {
            groups.push(currentGroup);
            currentGroup = [current];
        }
    }
    groups.push(currentGroup);
    return groups;
};


export const QuranViewer = forwardRef<QuranViewerRef, QuranViewerProps>(({ quranData, targetVerses, onShowTafsir, bookmarks, onToggleBookmark, onBackToChat, onCollapse }, ref) => {
  const verseRefs = useRef<Map<string, HTMLDivElement | null>>(new Map());
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const groupRefs = useRef<Map<string, HTMLDivElement | null>>(new Map());
  const [activeGroupKeyInView, setActiveGroupKeyInView] = useState<string | null>(null);

  const verseGroups = useMemo(() => groupVerses(targetVerses), [targetVerses]);

  useEffect(() => {
    const container = scrollContainerRef.current;
    if (!container) return;

    if (verseGroups.length <= 1) {
        if (verseGroups.length === 1) {
            const surahId = verseGroups[0][0].surah;
            setActiveGroupKeyInView(`${surahId}-0`);
        } else {
            setActiveGroupKeyInView(null);
        }
        return;
    }

    const handleScroll = () => {
        const scrollPosition = container.scrollTop;
        let lastVisibleGroupKey: string | null = null;

        // Default to the first group when at the very top.
        if (verseGroups.length > 0) {
            const firstGroup = verseGroups[0];
            lastVisibleGroupKey = `${firstGroup[0].surah}-0`;
        }

        verseGroups.forEach((group, index) => {
            const surahId = group[0].surah;
            const groupKey = `${surahId}-${index}`;
            const groupEl = groupRefs.current.get(groupKey);
            
            // Add a 1px offset to handle floating point rounding issues.
            // This ensures the header is considered "active" as soon as it touches the top.
            if (groupEl && groupEl.offsetTop <= scrollPosition + 1) {
                lastVisibleGroupKey = groupKey;
            }
        });

        setActiveGroupKeyInView(lastVisibleGroupKey);
    };

    container.addEventListener('scroll', handleScroll, { passive: true });
    handleScroll(); // Initial check

    return () => container.removeEventListener('scroll', handleScroll);
  }, [verseGroups]);


  const shouldShowFullSurah = useMemo(() => {
    // Only show full surah if there is exactly one group of verses.
    if (verseGroups.length !== 1) {
        return false;
    }
    const group = verseGroups[0];
    const SPACING_THRESHOLD = 20;

    // Don't show full surah for just a single verse.
    if (group.length <= 1) {
        return false;
    }

    const ayahsInGroup = group.map(v => v.ayah).sort((a, b) => a - b);
    const minAyah = ayahsInGroup[0];
    const maxAyah = ayahsInGroup[ayahsInGroup.length - 1];

    // If the span of selected verses is small, show the whole surah for context.
    return (maxAyah - minAyah) < SPACING_THRESHOLD;
  }, [verseGroups]);

  const doScroll = (verseLocation: VerseLocation) => {
    const verseKey = `${verseLocation.surah}:${verseLocation.ayah}`;
    const verseElement = verseRefs.current.get(verseKey);
    const scrollContainer = scrollContainerRef.current;

    if (verseElement && scrollContainer) {
        // Find the header associated with this verse.
        const groupElement = verseElement.closest(`[data-surah-group-id]`);
        let headerHeight = 0;
        
        // In grouped view, the sticky header is inside the scroll container.
        // We must subtract its height from the target scroll position.
        if (groupElement) {
            const headerElement = groupElement.querySelector('header');
            if (headerElement) {
                headerHeight = headerElement.offsetHeight;
            }
        }
        
        // Calculate the verse's position relative to the scroll container,
        // which is more reliable than `offsetTop` if the offset parent is outside.
        const verseTopRelativeToContainer = verseElement.getBoundingClientRect().top - scrollContainer.getBoundingClientRect().top;
        const currentScrollTop = scrollContainer.scrollTop;
        
        const targetScrollTop = currentScrollTop + verseTopRelativeToContainer - headerHeight;

        scrollContainer.scrollTo({
            top: targetScrollTop,
            behavior: 'smooth'
        });
    }
  };

  useImperativeHandle(ref, () => ({
      scrollToVerse(verse: VerseLocation) {
          doScroll(verse);
      }
  }));
  
  const viewerContent = (() => {
    if (verseGroups.length === 0) {
        return (
            <div className="h-full flex flex-col">
              <header className="p-4 border-b border-[var(--border)] bg-[var(--card)] flex items-center gap-2 flex-shrink-0">
                  {onCollapse && (
                      <button onClick={onCollapse} className="hidden lg:flex p-2 -ml-2 rounded-full text-[var(--muted-foreground)] hover:bg-[var(--accent)]" title="Collapse Viewer">
                          <IconChevronsRight className="h-5 w-5" />
                      </button>
                  )}
                  <h2 className="text-2xl font-bold text-[var(--foreground)]">Quran Viewer</h2>
              </header>
              <div className="flex-grow flex flex-col items-center justify-center bg-[var(--background)] p-8 text-center">
                  <IconComment className="h-16 w-16 text-[var(--muted-foreground)] mb-4" />
                  <h2 className="text-2xl font-bold text-[var(--foreground)]">Quran Verse Viewer</h2>
                  <p className="mt-2 max-w-md text-[var(--muted-foreground)]">
                      Ask the AI about a topic or a specific verse. After the AI responds, click the 'Verses' button on its reply to view the cited Quranic passages here.
                  </p>
              </div>
            </div>
        );
    }

    const viewerPaddingBottom = targetVerses.length > 0 ? 'pb-8 lg:pb-24' : 'pb-8';

    // Renders the full surah with highlighted verses if they are close together.
    if (shouldShowFullSurah) {
        const surahId = verseGroups[0][0].surah;
        const surah = quranData.find(s => s.id === surahId);
        if (!surah) return <div className="flex-grow flex items-center justify-center bg-[var(--background)] p-4"><p className="text-[var(--muted-foreground)]">Could not load Surah {surahId}.</p></div>;

        return (
        <div className="flex-grow flex flex-col overflow-hidden h-full">
            <SurahHeader surah={surah} onBack={onBackToChat} showBackButton={true} onCollapse={onCollapse} />
            <div ref={scrollContainerRef} className="flex-grow overflow-y-auto bg-[var(--background)]">
            <div className={`max-w-4xl mx-auto space-y-4 px-6 md:px-8 pt-6 md:pt-8 ${viewerPaddingBottom}`}>
                {surah.verses.map(verse => {
                const isBookmarked = bookmarks.some(b => b.surah === surah.id && b.ayah === verse.id);
                const isHighlighted = targetVerses.some(v => v.surah === surah.id && v.ayah === verse.id);
                return (
                    <Verse
                    key={verse.id}
                    surah={surah}
                    verse={verse}
                    isBookmarked={isBookmarked}
                    isHighlighted={isHighlighted}
                    onShowTafsir={onShowTafsir}
                    onToggleBookmark={onToggleBookmark}
                    // FIX: Wrapped the expression in braces to ensure the ref callback returns `void`.
                    // The `Map.set` method returns the map instance, which caused a type error.
                    setRef={el => { verseRefs.current.set(`${surah.id}:${verse.id}`, el); }}
                    />
                );
                })}
            </div>
            </div>
            <VerseTray verses={targetVerses} onVerseClick={doScroll} />
        </div>
        );
    }

    // Renders individual verse groups, each with its own header.
    // This is used for verses from different surahs OR verses from the same surah that are far apart.
    return (
        <div className="h-full flex flex-col">
            <div ref={scrollContainerRef} className="flex-grow overflow-y-auto h-full">
            {verseGroups.map((group, index) => {
                const surahId = group[0].surah;
                const surah = quranData.find(s => s.id === surahId);
                if (!surah) return null;

                const groupKey = `${surah.id}-${index}`;
                const ayahsInGroup = group.map(v => v.ayah);
                const versesToDisplay = surah.verses.filter(v => ayahsInGroup.includes(v.id));
                const verseRangeString = getVerseRangeString(ayahsInGroup);
                const isThisGroupActive = activeGroupKeyInView === groupKey;

                return (
                <div key={groupKey} ref={el => groupRefs.current.set(groupKey, el)} data-surah-group-id={surah.id}>
                    <SurahHeader 
                    surah={surah} 
                    isSticky={true}
                    onBack={onBackToChat}
                    verseRangeString={verseRangeString}
                    showBackButton={isThisGroupActive}
                    onCollapse={onCollapse}
                    />
                    <div className={`bg-[var(--background)] ${index === verseGroups.length - 1 ? viewerPaddingBottom : 'pb-6 md:pb-8'}`}>
                    <div className="max-w-4xl mx-auto space-y-4 px-6 md:px-8 pt-6 md:pt-8">
                        {versesToDisplay.map(verse => {
                        const isBookmarked = bookmarks.some(b => b.surah === surah.id && b.ayah === verse.id);
                        return (
                            <Verse
                            key={verse.id}
                            surah={surah}
                            verse={verse}
                            isBookmarked={isBookmarked}
                            isHighlighted={true} // All displayed verses are targets
                            onShowTafsir={onShowTafsir}
                            onToggleBookmark={onToggleBookmark}
                            // FIX: Wrapped the expression in braces to ensure the ref callback returns `void`.
                            // The `Map.set` method returns the map instance, which caused a type error.
                            setRef={el => { verseRefs.current.set(`${surah.id}:${verse.id}`, el); }}
                            />
                        );
                        })}
                    </div>
                    </div>
                </div>
                );
            })}
            </div>
            <VerseTray verses={targetVerses} onVerseClick={doScroll} />
        </div>
    );
  })();

  return <>{viewerContent}</>;
});
