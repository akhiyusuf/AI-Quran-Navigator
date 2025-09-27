
import React, { useRef, useEffect } from 'react';
import { IconCheck } from './Icons';

export type Theme = 
  | 'light-blue' | 'dark-blue'
  | 'light-green' | 'dark-green'
  | 'light-gold' | 'dark-gold'
  | 'light-pink' | 'dark-pink'
  | 'light-bw' | 'dark-bw';

interface ThemeSwitcherProps {
  currentTheme: Theme;
  onThemeChange: (theme: Theme) => void;
  onClose: () => void;
}

const themes: { name: string; themes: { id: Theme; label: string }[] }[] = [
  {
    name: "Blue",
    themes: [
      { id: "light-blue", label: "Light" },
      { id: "dark-blue", label: "Dark" },
    ],
  },
  {
    name: "Green",
    themes: [
      { id: "light-green", label: "Light" },
      { id: "dark-green", label: "Dark" },
    ],
  },
  {
    name: "Gold",
    themes: [
      { id: "light-gold", label: "Light" },
      { id: "dark-gold", label: "Dark" },
    ],
  },
  {
    name: "Pink",
    themes: [
      { id: "light-pink", label: "Light" },
      { id: "dark-pink", label: "Dark" },
    ],
  },
  {
    name: "B&W",
    themes: [
      { id: "light-bw", label: "Light" },
      { id: "dark-bw", label: "Dark" },
    ],
  },
];

export const ThemeSwitcher: React.FC<ThemeSwitcherProps> = ({ currentTheme, onThemeChange, onClose }) => {
    const switcherRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (switcherRef.current && !switcherRef.current.contains(event.target as Node)) {
                onClose();
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, [onClose]);

    const handleThemeSelect = (theme: Theme) => {
        onThemeChange(theme);
        onClose();
    };

  return (
    <div
      ref={switcherRef}
      className="absolute left-0 bottom-[calc(100%+0.5rem)] w-56 origin-bottom-left rounded-md bg-[var(--card)] shadow-lg ring-1 ring-black ring-opacity-5 z-50 p-2 max-h-[80vh] overflow-y-auto"
      role="menu"
    >
      {themes.map((group) => (
        <div key={group.name} className="mb-2 last:mb-0">
          <h4 className="px-2 py-1 text-xs font-semibold text-[var(--muted-foreground)]">{group.name}</h4>
          <div className="grid grid-cols-2 gap-2 mt-1">
            {group.themes.map((theme) => (
              <button
                key={theme.id}
                onClick={() => handleThemeSelect(theme.id)}
                className={`w-full flex items-center justify-between text-left p-2 text-sm rounded-md transition-colors ${
                  currentTheme === theme.id
                    ? 'bg-[var(--primary)] text-[var(--primary-foreground)]'
                    : 'hover:bg-[var(--accent)] text-[var(--foreground)]'
                }`}
              >
                <span>{theme.label}</span>
                {currentTheme === theme.id && <IconCheck className="h-4 w-4" />}
              </button>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
};
