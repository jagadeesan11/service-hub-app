import Svg, { Path } from 'react-native-svg';

/**
 * Small line glyphs for the home quick actions.
 *
 * Drawn inline rather than added to constants/service-icons: those are
 * generated from scripts/service-icons.mjs and describe *services*. These are
 * UI furniture, and mixing them would mean regenerating the service icon set
 * every time a button changes.
 *
 * Stroke width is a constant in viewBox units, never derived from `size` —
 * deriving it double-scales the stroke and turns the glyph into a filled blob
 * at larger sizes.
 */
const STROKE = 1.8;

function Glyph({ size, color, d }: { size: number; color: string; d: string[] }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      {d.map((path) => (
        <Path
          key={path}
          d={path}
          stroke={color}
          strokeWidth={STROKE}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      ))}
    </Svg>
  );
}

export function CalendarIcon({ size = 20, color }: { size?: number; color: string }) {
  return (
    <Glyph
      size={size}
      color={color}
      d={[
        'M4 8a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v11a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V8Z',
        'M8 3v4',
        'M16 3v4',
        'M4 11h16',
      ]}
    />
  );
}

export function ChatIcon({ size = 20, color }: { size?: number; color: string }) {
  return (
    <Glyph
      size={size}
      color={color}
      d={['M20.5 12a8 8 0 0 1-11.7 7.1L4 20.5l1.4-4.8A8 8 0 1 1 20.5 12Z']}
    />
  );
}

export function PhoneIcon({ size = 20, color }: { size?: number; color: string }) {
  return (
    <Glyph
      size={size}
      color={color}
      d={[
        'M6.5 3.5h3l1.8 4.5-2.3 1.4a12.5 12.5 0 0 0 5.6 5.6l1.4-2.3 4.5 1.8v3a2 2 0 0 1-2.2 2A16.5 16.5 0 0 1 4.5 5.7a2 2 0 0 1 2-2.2Z',
      ]}
    />
  );
}

export function HelpIcon({ size = 20, color }: { size?: number; color: string }) {
  return (
    <Glyph
      size={size}
      color={color}
      d={[
        'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18Z',
        'M9.5 9.5a2.5 2.5 0 1 1 3.4 2.3c-.6.3-.9.8-.9 1.4v.6',
        'M12 17h.01',
      ]}
    />
  );
}
