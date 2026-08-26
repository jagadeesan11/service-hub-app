import { ICON_VIEWBOX, SERVICE_ICONS } from '@/lib/service-icons';

/**
 * The same artwork the mobile app draws, rendered as inline SVG so it picks
 * up `currentColor` and stays crisp. Returns null for an unknown key — the
 * caller decides what an iconless row looks like.
 */
export function ServiceIcon({
  name,
  size = 20,
  className,
}: {
  name: string | null | undefined;
  size?: number;
  className?: string;
}) {
  const shape = name ? SERVICE_ICONS[name] : undefined;
  if (!shape) return null;

  // Stroke width is in viewBox units, which already scale with the rendered
  // size -- so a constant value keeps the weight visually identical at every
  // size. Deriving it from `size` scaled it twice and turned large icons into
  // filled blobs. The small bump under 20px is optical compensation only.
  const width = size < 20 ? 1.9 : 1.6;

  return (
    <svg
      width={size}
      height={size}
      viewBox={`0 0 ${ICON_VIEWBOX} ${ICON_VIEWBOX}`}
      fill="none"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      role="img"
      aria-label={shape.label}
    >
      {shape.paths?.map((d) => (
        <path key={d} d={d} strokeWidth={width} />
      ))}
      {shape.dashedPaths?.map((d) => (
        <path
          key={d}
          d={d}
          strokeWidth={width}
          strokeDasharray={`${width * 1.8},${width * 1.5}`}
          opacity={0.7}
        />
      ))}
      {shape.heavyPaths?.map((d) => (
        <path key={`heavy-${d}`} d={d} strokeWidth={width * 2.1} />
      ))}
      {shape.circles?.map((c) => (
        <circle key={`${c.cx}-${c.cy}-${c.r}`} cx={c.cx} cy={c.cy} r={c.r} strokeWidth={width} />
      ))}
    </svg>
  );
}
