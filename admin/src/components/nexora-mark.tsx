/**
 * The Nexora "N" — two uprights joined by a diagonal, matching the app icon.
 * Inline SVG rather than an image so it inherits currentColor and stays crisp.
 */
export function NexoraMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 100 100" aria-hidden className={className}>
      <rect x="18" y="16" width="17" height="68" fill="currentColor" />
      <rect x="65" y="16" width="17" height="68" fill="currentColor" />
      <polygon points="18,16 35,16 82,84 65,84" className="fill-primary" />
    </svg>
  );
}
