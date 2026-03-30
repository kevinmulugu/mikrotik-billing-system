'use client';

import { useTheme } from 'next-themes';
import { Sun, Moon, Monitor } from 'lucide-react';
import { Button } from '@/components/ui/button';

const themes = [
  { value: 'light', icon: Sun, label: 'Light' },
  { value: 'dark', icon: Moon, label: 'Dark' },
  { value: 'system', icon: Monitor, label: 'System' },
] as const;

export function ThemeToggle({ collapsed = false }: { collapsed?: boolean }) {
  const { theme, setTheme } = useTheme();

  if (collapsed) {
    // Cycle through themes when collapsed (icon-only)
    const currentIndex = themes.findIndex((t) => t.value === theme);
    const current = themes[currentIndex === -1 ? 2 : currentIndex]!;
    const next = themes[(themes.indexOf(current) + 1) % themes.length]!;
    const Icon = current.icon;
    return (
      <Button
        variant="ghost"
        size="icon"
        className="h-8 w-8"
        onClick={() => setTheme(next.value)}
        title={`Theme: ${current.label} — click for ${next.label}`}
      >
        <Icon className="h-4 w-4" />
      </Button>
    );
  }

  return (
    <div className="flex items-center gap-1 rounded-md border bg-background p-1">
      {themes.map(({ value, icon: Icon, label }) => (
        <button
          key={value}
          onClick={() => setTheme(value)}
          title={label}
          className={`flex flex-1 items-center justify-center gap-1.5 rounded px-2 py-1 text-xs font-medium transition-colors ${
            theme === value
              ? 'bg-sidebar-primary text-sidebar-primary-foreground'
              : 'text-sidebar-foreground/60 hover:text-sidebar-foreground'
          }`}
        >
          <Icon className="h-3.5 w-3.5 shrink-0" />
          <span>{label}</span>
        </button>
      ))}
    </div>
  );
}
