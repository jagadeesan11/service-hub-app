/**
 * Emits the shared icon artwork into both apps as TypeScript data.
 *
 * Mobile renders it with react-native-svg and admin with inline SVG, but the
 * geometry lives in exactly one place (scripts/service-icons.mjs) so a tweak
 * cannot land in one app and miss the other.
 *
 *   node scripts/generate-service-icons.mjs
 */
import { writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { SERVICE_ICONS } from './service-icons.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');

const BANNER = `/**
 * GENERATED FILE - do not edit.
 * Source: scripts/service-icons.mjs
 * Regenerate: node scripts/generate-service-icons.mjs
 */`;

const body = `
export interface IconCircle {
  cx: number;
  cy: number;
  r: number;
}

export interface ServiceIconShape {
  label: string;
  /** Normal-weight stroked paths. */
  paths?: string[];
  /** Drawn with a heavier stroke, for emphasis within the same icon. */
  heavyPaths?: string[];
  /** Dashed, for a layer that is meant to read as not-quite-there. */
  dashedPaths?: string[];
  circles?: IconCircle[];
}

export const SERVICE_ICONS: Record<string, ServiceIconShape> = ${JSON.stringify(
  SERVICE_ICONS,
  null,
  2,
)};

export type ServiceIconKey = keyof typeof SERVICE_ICONS;

/** Every key an admin may choose, with a human label for the picker. */
export const SERVICE_ICON_OPTIONS = Object.entries(SERVICE_ICONS).map(([key, shape]) => ({
  key,
  label: shape.label,
}));

/** 24x24 is the grid every path above was drawn on. */
export const ICON_VIEWBOX = 24;
`;

const targets = [
  join(ROOT, 'mobile', 'src', 'constants', 'service-icons.ts'),
  join(ROOT, 'admin', 'src', 'lib', 'service-icons.ts'),
];

for (const target of targets) {
  writeFileSync(target, `${BANNER}\n${body}`);
  console.log('wrote ' + target.replace(ROOT, '.'));
}

console.log(`\n${Object.keys(SERVICE_ICONS).length} icons: ${Object.keys(SERVICE_ICONS).join(', ')}`);
