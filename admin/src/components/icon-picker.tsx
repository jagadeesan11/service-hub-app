'use client';

import { ServiceIcon } from '@/components/service-icon';
import { Label } from '@/components/ui/label';
import { SERVICE_ICON_OPTIONS } from '@/lib/service-icons';
import { cn } from '@/lib/utils';

/**
 * Pick artwork from the set the apps actually ship.
 *
 * Deliberately not a text input. This field used to be free text, and the one
 * value anybody typed ("car") rendered nothing at all, because no screen read
 * it — a typo and a correct answer looked identical. Showing the real icons
 * means the choice is verified by looking at it.
 */
export function IconPicker({
  value,
  onChange,
  label = 'Icon',
  description,
}: {
  value: string | null;
  onChange: (value: string | null) => void;
  label?: string;
  description?: string;
}) {
  return (
    <div>
      <Label className="mb-1.5">{label}</Label>
      {description && <p className="mb-2 text-xs text-muted-foreground">{description}</p>}

      <div className="flex flex-wrap gap-2">
        {/* An explicit "None" beats clearing a field to mean the same thing. */}
        <button
          type="button"
          onClick={() => onChange(null)}
          aria-pressed={value === null}
          className={cn(
            'flex h-20 w-24 flex-col items-center justify-center gap-1.5 rounded-lg border text-xs transition-colors',
            'focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none',
            value === null
              ? 'border-primary bg-primary/8 text-foreground'
              : 'border-border text-muted-foreground hover:border-muted-foreground/40',
          )}
        >
          <span className="grid size-6 place-items-center text-base opacity-50">&mdash;</span>
          None
        </button>

        {SERVICE_ICON_OPTIONS.map(({ key, label: iconLabel }) => {
          const selected = value === key;
          return (
            <button
              key={key}
              type="button"
              onClick={() => onChange(key)}
              aria-pressed={selected}
              title={iconLabel}
              className={cn(
                'flex h-20 w-24 flex-col items-center justify-center gap-1.5 rounded-lg border px-1 text-xs transition-colors',
                'focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none',
                selected
                  ? 'border-primary bg-primary/8 text-foreground'
                  : 'border-border text-muted-foreground hover:border-muted-foreground/40',
              )}
            >
              <ServiceIcon name={key} size={26} className={selected ? 'text-primary' : ''} />
              <span className="line-clamp-2 text-center leading-tight">{iconLabel}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
