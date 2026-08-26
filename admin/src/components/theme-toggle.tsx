'use client';

import { Monitor, Moon, Sun } from 'lucide-react';
import { useTheme } from 'next-themes';
import { useSyncExternalStore } from 'react';

import { cn } from '@/lib/utils';

const noopSubscribe = () => () => {};

/**
 * True only after hydration. next-themes leaves `theme` undefined on the
 * server and on the first client render, so the control needs a re-render
 * once hydration completes or no segment ever shows as selected. Done with
 * useSyncExternalStore rather than setState-in-an-effect, which React now
 * flags as a cascading render.
 */
function useHydrated() {
  return useSyncExternalStore(
    noopSubscribe,
    () => true,
    () => false,
  );
}

const OPTIONS = [
  { value: 'light', label: 'Light', Icon: Sun },
  { value: 'dark', label: 'Dark', Icon: Moon },
  { value: 'system', label: 'System', Icon: Monitor },
] as const;

export function ThemeToggle() {
  const { theme, setTheme } = useTheme();
  const hydrated = useHydrated();

  return (
    <div
      role="radiogroup"
      aria-label="Colour theme"
      className="flex items-center gap-0.5 rounded-lg border border-sidebar-border bg-sidebar-accent/40 p-0.5"
    >
      {OPTIONS.map(({ value, label, Icon }) => {
        const active = hydrated && theme === value;
        return (
          <button
            key={value}
            type="button"
            role="radio"
            aria-checked={active}
            aria-label={label}
            title={label}
            onClick={() => setTheme(value)}
            className={cn(
              'flex flex-1 items-center justify-center rounded-md py-1.5 transition-colors',
              'focus-visible:ring-2 focus-visible:ring-sidebar-ring focus-visible:outline-none',
              active
                ? 'bg-card text-foreground shadow-sm'
                : 'text-muted-foreground hover:text-foreground',
            )}
          >
            <Icon className="size-3.5" />
          </button>
        );
      })}
    </div>
  );
}
