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
      className="fixed inset-0 z-50 flex items-center justify-center bg-[var(--overlay)]"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby="tafsir-title"
    >
      <div
        className="relative w-full max-w-2xl bg-[var(--card)] rounded-lg shadow-xl m-4"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between p-4 border-b border-[var(--border)] rounded-t">
          <h3 className="text-xl font-semibold text-[var(--card-foreground)]" id="tafsir-title">
            Tafsir for Verse {surah}:{ayah}
          </h3>
          <button
            type="button"
            className="text-[var(--muted-foreground)] bg-transparent hover:bg-[var(--accent)] hover:text-[var(--accent-foreground)] rounded-lg text-sm p-1.5 ml-auto inline-flex items-center"
            onClick={onClose}
            aria-label="Close modal"
          >
            <IconX className="w-5 h-5" />
          </button>
        </div>
        <div className="p-6 space-y-6 max-h-[70vh] overflow-y-auto">
          {isLoading && !content.arabic ? (
            <div className="flex flex-col items-center justify-center text-[var(--muted-foreground)] min-h-[200px]">
                <IconLoader className="h-8 w-8 animate-spin mb-2" />
                <p>Loading Tafsir...</p>
            </div>
          ) : error ? (
            <div className="text-center text-[var(--destructive)] min-h-[200px] flex flex-col justify-center">
                <p><strong>Error</strong></p>
                <p>{error}</p>
            </div>
          ) : (
            <div className="space-y-6">
              <div>
                <h4 className="font-semibold text-[var(--card-foreground)] mb-2 text-right arabic-text">التفسير الميسر (Arabic)</h4>
                <p dir="rtl" className="arabic-text text-lg leading-loose text-[var(--foreground)]">
                  {content.arabic}
                </p>
              </div>
              <hr className="border-[var(--border)]" />
              <div>
                <h4 className="font-semibold text-[var(--card-foreground)] mb-2">English Translation</h4>
                <div className="text-base leading-relaxed text-[var(--muted-foreground)] min-h-[24px]">
                  {isLoading && content.arabic ? (
                    <div className="flex items-center space-x-2">
                        <div className="w-2 h-2 bg-[var(--muted-foreground)] rounded-full animate-pulse [animation-delay:-0.3s]"></div>
                        <div className="w-2 h-2 bg-[var(--muted-foreground)] rounded-full animate-pulse [animation-delay:-0.15s]"></div>
                        <div className="w-2 h-2 bg-[var(--muted-foreground)] rounded-full animate-pulse"></div>
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