import React from 'react';
import type { VerseLocation, Surah } from '../types';
import { IconBookmark, IconTrash } from './Icons';

interface BookmarksPanelProps {
  bookmarks: VerseLocation[];
  quranData: Surah[];
  onBookmarkClick: (verse: VerseLocation) => void;
  onRemoveBookmark: (verse: VerseLocation) => void;
}

export const BookmarksPanel: React.FC<BookmarksPanelProps> = ({ bookmarks, quranData, onBookmarkClick, onRemoveBookmark }) => {
  if (bookmarks.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-center text-slate-500 p-4 bg-white">
        <IconBookmark className="h-12 w-12 mb-4" />
        <h3 className="font-semibold text-slate-700">No Bookmarks Yet</h3>
        <p className="text-sm">Click the bookmark icon next to a verse to save it here.</p>
      </div>
    );
  }

  const getSurahName = (surahNumber: number) => {
    return quranData.find(s => s.id === surahNumber)?.transliteration || 'Unknown Surah';
  };

  return (
    <div className="h-full flex-grow overflow-y-auto bg-white">
      <ul className="divide-y divide-gray-200">
        {bookmarks.map((bookmark, index) => (
          <li key={index} className="group flex items-center justify-between hover:bg-slate-50 transition-colors duration-150">
            <button
              onClick={() => onBookmarkClick(bookmark)}
              className="text-left w-full px-4 py-3"
            >
              <p className="font-semibold text-slate-800">{getSurahName(bookmark.surah)}</p>
              <p className="text-sm text-slate-500">Verse {bookmark.ayah}</p>
            </button>
            <button
              onClick={() => onRemoveBookmark(bookmark)}
              className="mr-4 ml-2 p-2 rounded-full text-slate-400 hover:bg-red-100 hover:text-red-600 opacity-0 group-hover:opacity-100 transition-all duration-200"
              aria-label={`Remove bookmark for verse ${bookmark.surah}:${bookmark.ayah}`}
            >
              <IconTrash className="h-5 w-5" />
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
};