import Svg, { Circle, Path } from 'react-native-svg';

import { ICON_VIEWBOX, SERVICE_ICONS } from '@/constants/service-icons';
import { useTheme } from '@/hooks/use-theme';

/**
 * Renders a service or category icon from its stored key.
 *
 * Returns null for an unknown or missing key rather than a broken-image box,
 * so callers can fall back to something that still looks deliberate — a
 * brand-new vertical has no artwork until someone picks one in the admin.
 */
export function ServiceIcon({
  name,
  size = 24,
  color,
}: {
  name: string | null | undefined;
  size?: number;
  color?: string;
}) {
  const theme = useTheme();
  const shape = name ? SERVICE_ICONS[name] : undefined;
  if (!shape) return null;

  const stroke = color ?? theme.primary;
  // Stroke width is in viewBox units, which already scale with the rendered
  // size -- so a constant value keeps the weight visually identical at every
  // size. Deriving it from `size` scaled it twice and turned large icons into
  // filled blobs. The small bump under 20px is optical compensation only.
  const width = size < 20 ? 1.9 : 1.6;

  return (
    <Svg
      width={size}
      height={size}
      viewBox={`0 0 ${ICON_VIEWBOX} ${ICON_VIEWBOX}`}
      fill="none"
      accessibilityLabel={shape.label}
    >
      {shape.paths?.map((d) => (
        <Path
          key={d}
          d={d}
          stroke={stroke}
          strokeWidth={width}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      ))}
      {shape.dashedPaths?.map((d) => (
        <Path
          key={d}
          d={d}
          stroke={stroke}
          strokeWidth={width}
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeDasharray={`${width * 1.8},${width * 1.5}`}
          opacity={0.7}
        />
      ))}
      {shape.heavyPaths?.map((d) => (
        <Path
          key={`heavy-${d}`}
          d={d}
          stroke={stroke}
          strokeWidth={width * 2.1}
          strokeLinecap="round"
        />
      ))}
      {shape.circles?.map((c) => (
        <Circle
          key={`${c.cx}-${c.cy}-${c.r}`}
          cx={c.cx}
          cy={c.cy}
          r={c.r}
          stroke={stroke}
          strokeWidth={width}
        />
      ))}
    </Svg>
  );
}
