import React from 'react';
import { IconLoader, IconX } from './Icons';

interface TafsirModalProps {
  isOpen: boolean;
  onClose: () => void;
  surah?: number;
  ayah?: number;
  content: {
    english: string;
    arabic: string;
  };
  isLoading: boolean;
  error?: string;
}

export const TafsirModal: React.FC<TafsirModalProps> = ({
  isOpen,
  onClose,
  surah,
  ayah,
  content,
  isLoading,
  error,
}) => {
  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby="tafsir-title"
    >
      <div
        className="relative w-full max-w-2xl bg-white rounded-lg shadow-xl m-4"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between p-4 border-b rounded-t">
          <h3 className="text-xl font-semibold text-gray-900" id="tafsir-title">
            Tafsir for Verse {surah}:{ayah}
          </h3>
          <button
            type="button"
            className="text-gray-400 bg-transparent hover:bg-gray-200 hover:text-gray-900 rounded-lg text-sm p-1.5 ml-auto inline-flex items-center"
            onClick={onClose}
            aria-label="Close modal"
          >
            <IconX className="w-5 h-5" />
          </button>
        </div>
        <div className="p-6 space-y-6 max-h-[70vh] overflow-y-auto">
          {isLoading && !content.arabic ? (
            <div className="flex flex-col items-center justify-center text-slate-500 min-h-[200px]">
                <IconLoader className="h-8 w-8 animate-spin mb-2" />
                <p>Loading Tafsir...</p>
            </div>
          ) : error ? (
            <div className="text-center text-red-600 min-h-[200px] flex flex-col justify-center">
                <p><strong>Error</strong></p>
                <p>{error}</p>
            </div>
          ) : (
            <div className="space-y-6">
              <div>
                <h4 className="font-semibold text-gray-800 mb-2 text-right arabic-text">التفسير الميسر (Arabic)</h4>
                <p dir="rtl" className="arabic-text text-lg leading-loose text-slate-800">
                  {content.arabic}
                </p>
              </div>
              <hr />
              <div>
                <h4 className="font-semibold text-gray-800 mb-2">English Translation</h4>
                <div className="text-base leading-relaxed text-gray-600 min-h-[24px]">
                  {isLoading && content.arabic ? (
                    <div className="flex items-center space-x-2 text-slate-500">
                        <div className="w-2 h-2 bg-slate-400 rounded-full animate-pulse [animation-delay:-0.3s]"></div>
                        <div className="w-2 h-2 bg-slate-400 rounded-full animate-pulse [animation-delay:-0.15s]"></div>
                        <div className="w-2 h-2 bg-slate-400 rounded-full animate-pulse"></div>
                        <span>Translating...</span>
                    </div>
                  ) : (
                    <p>{content.english}</p>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
