import React, { useEffect, useRef, useMemo } from 'react';
import type { Surah, VerseLocation, Ayah } from '../types';
import { IconInfo, IconBookmark, IconArrowLeft } from './Icons';

interface QuranViewerProps {
  quranData: Surah[];
  targetVerses: VerseLocation[];
  onShowTafsir: (surah: number, ayah: number) => void;
  bookmarks: VerseLocation[];
  onToggleBookmark: (verse: VerseLocation) => void;
  onBackToChat: () => void;
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
                isHighlighted ? 'bg-blue-100 border-blue-400 border-l-4' : 'bg-white border-transparent border-l-4'
            }`}
            >
                <div className="flex justify-between items-start mb-4">
                    <div className="flex items-center gap-2">
                        <span className="text-sm font-semibold text-blue-600 bg-blue-100 px-3 py-1 rounded-full">{surah.id}:{verse.id}</span>
                        <button
                            onClick={() => onShowTafsir(surah.id, verse.id)}
                            className="text-slate-400 hover:text-blue-600 transition-colors p-1 rounded-full"
                            aria-label={`Show Tafsir for Surah ${surah.id}, Verse ${verse.id}`}
                        >
                            <IconInfo className="h-5 w-5" />
                        </button>
                        <button
                            onClick={() => onToggleBookmark(verseLocation)}
                            className={`transition-colors p-1 rounded-full ${isBookmarked ? 'text-blue-600' : 'text-slate-400 hover:text-blue-600'}`}
                            aria-label={`${isBookmarked ? 'Remove bookmark' : 'Add bookmark'} for Surah ${surah.id}, Verse ${verse.id}`}
                        >
                            <IconBookmark className={`h-5 w-5 ${isBookmarked ? 'fill-current' : ''}`} />
                        </button>
                    </div>
                    <p dir="rtl" className="arabic-text text-3xl text-right text-slate-800 leading-loose">
                    {verse.text}
                    </p>
                </div>
                <p className="text-slate-600 leading-relaxed text-left">{verse.translation}</p>
        </div>
    );
};

const SurahHeader: React.FC<{ surah: Surah; isSticky?: boolean; onBack?: () => void; verseRangeString?: string; }> = ({ surah, isSticky = false, onBack, verseRangeString }) => (
    <header className={`p-4 border-b border-gray-200 bg-white flex justify-between items-center ${isSticky ? 'sticky top-0 z-10' : 'flex-shrink-0'}`}>
        <div className="flex items-center gap-2">
            {onBack && (
                <button 
                    onClick={onBack}
                    className="lg:hidden p-2 -ml-2 rounded-full text-slate-500 hover:bg-slate-100"
                    aria-label="Back to chat"
                >
                    <IconArrowLeft className="h-6 w-6" />
                </button>
            )}
            <div>
                <h2 className="text-2xl font-bold text-slate-800">{surah.id}. {surah.transliteration}</h2>
                {verseRangeString ? (
                    <p className="text-slate-500">{verseRangeString}</p>
                ) : (
                    <p className="text-slate-500">"{surah.translation}" - {surah.total_verses} Verses</p>
                )}
            </div>
        </div>
        <h2 className="text-4xl arabic-text font-semibold text-slate-700">{surah.name}</h2>
    </header>
);


export const QuranViewer: React.FC<QuranViewerProps> = ({ quranData, targetVerses, onShowTafsir, bookmarks, onToggleBookmark, onBackToChat }) => {
  const verseRefs = useRef<Map<string, HTMLDivElement | null>>(new Map());
  const scrollContainerRef = useRef<HTMLDivElement>(null);

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

  const verseGroups = useMemo(() => groupVerses(targetVerses), [targetVerses]);

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

  useEffect(() => {
    if (targetVerses.length > 0) {
      const firstVerse = targetVerses[0];
      const verseKey = `${firstVerse.surah}:${firstVerse.ayah}`;
      
      const scrollToElement = () => {
          const verseElement = verseRefs.current.get(verseKey);
          if (verseElement) {
              verseElement.scrollIntoView({
                behavior: 'smooth',
                block: 'center',
              });
          }
      };
      
      // Delay scrolling slightly to allow the view to render.
      const timeoutId = setTimeout(scrollToElement, 100);

      return () => {
          clearTimeout(timeoutId);
      };
    }
  }, [targetVerses]);
  
  if (verseGroups.length === 0) {
    return <div className="flex-grow flex items-center justify-center bg-slate-100 p-4"><p className="text-slate-500">Select a verse to display.</p></div>;
  }

  // Renders the full surah with highlighted verses if they are close together.
  if (shouldShowFullSurah) {
    const surahId = verseGroups[0][0].surah;
    const surah = quranData.find(s => s.id === surahId);
    if (!surah) return <div className="flex-grow flex items-center justify-center bg-slate-100 p-4"><p className="text-slate-500">Could not load Surah {surahId}.</p></div>;

    return (
      <div className="flex-grow flex flex-col overflow-hidden">
        <SurahHeader surah={surah} onBack={onBackToChat} />
        <div ref={scrollContainerRef} className="flex-grow overflow-y-auto p-6 md:p-8 bg-slate-50">
          <div className="max-w-4xl mx-auto space-y-4">
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
                  setRef={el => verseRefs.current.set(`${surah.id}:${verse.id}`, el)}
                />
              );
            })}
          </div>
        </div>
      </div>
    );
  }

  // Renders individual verse groups, each with its own header.
  // This is used for verses from different surahs OR verses from the same surah that are far apart.
  return (
    <div ref={scrollContainerRef} className="flex-grow overflow-y-auto h-full">
      {verseGroups.map((group, index) => {
        const surahId = group[0].surah;
        const surah = quranData.find(s => s.id === surahId);
        if (!surah) return null;

        const ayahsInGroup = group.map(v => v.ayah);
        const versesToDisplay = surah.verses.filter(v => ayahsInGroup.includes(v.id));
        const verseRangeString = getVerseRangeString(ayahsInGroup);

        return (
          <div key={`${surah.id}-${index}`}>
            <SurahHeader 
              surah={surah} 
              isSticky={true}
              // Only show the back button on the very first header
              onBack={index === 0 ? onBackToChat : undefined}
              verseRangeString={verseRangeString}
            />
            <div className="p-6 md:p-8 bg-slate-50">
              <div className="max-w-4xl mx-auto space-y-4">
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
                      setRef={el => verseRefs.current.set(`${surah.id}:${verse.id}`, el)}
                    />
                  );
                })}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
};