/**
 * Regenerates every launcher/splash asset from one source of truth: the same
 * Nexora "N" geometry the admin panel renders inline (see nexora-mark.tsx).
 *
 * Run it whenever the brand palette changes:
 *   node scripts/generate-icons.mjs
 *
 * Needs `sharp`, which is not a dependency of either workspace. It is
 * resolved from whichever one already has it.
 *
 * Store rules this encodes, so they are not rediscovered by rejection:
 *  - icon.png must be fully opaque with square corners; the stores apply their
 *    own mask, and a pre-rounded icon gets double-rounded.
 *  - The Android adaptive foreground is cropped hard. Only the central ~61% of
 *    the canvas survives a circular mask, so the mark is drawn well inside it.
 *  - The monochrome layer must be a single flat colour on transparency;
 *    Android recolours it for themed icons and ignores whatever hue is there.
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');

// ESM import() ignores NODE_PATH, so resolve through CJS require, which does
// walk node_modules from the paths we give it.
const require = createRequire(import.meta.url);
let sharp;
for (const base of [ROOT, join(ROOT, 'admin'), join(ROOT, 'mobile')]) {
  try {
    sharp = require(require.resolve('sharp', { paths: [base] }));
    break;
  } catch {
    /* try the next workspace */
  }
}
if (!sharp) {
  console.error('sharp not found in any workspace. Install it:\n  npm i -D sharp');
  process.exit(1);
}

const OUT = join(ROOT, 'mobile', 'assets', 'images');

// Graphite + ice cyan. Kept in step with mobile/src/constants/theme.ts.
const GROUND = '#0A1A20';
const UPRIGHT = '#E9EEF3';
const DIAGONAL = '#3ED8E8';

/**
 * The mark, on a 100x100 viewBox. Content occupies y 16..84, i.e. 68% of the
 * box — that ratio is what the `fraction` maths below depends on.
 */
function mark({ upright, diagonal }) {
  return `
    <rect x="18" y="16" width="17" height="68" fill="${upright}" />
    <rect x="65" y="16" width="17" height="68" fill="${upright}" />
    <polygon points="18,16 35,16 82,84 65,84" fill="${diagonal}" />`;
}

const CONTENT_RATIO = 0.68;

/**
 * @param size      canvas edge in px
 * @param fraction  how much of the canvas the *mark* should occupy
 * @param ground    background fill, or null for transparency
 */
function svg({ size, fraction, ground, upright, diagonal }) {
  const box = (fraction * size) / CONTENT_RATIO;
  const offset = (size - box) / 2;
  return Buffer.from(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
      ${ground ? `<rect width="${size}" height="${size}" fill="${ground}" />` : ''}
      <g transform="translate(${offset} ${offset}) scale(${box / 100})">
        ${mark({ upright, diagonal })}
      </g>
    </svg>`,
  );
}

const ASSETS = [
  {
    file: 'icon.png',
    note: 'iOS + store listing. Opaque, square corners.',
    svg: svg({ size: 1024, fraction: 0.62, ground: GROUND, upright: UPRIGHT, diagonal: DIAGONAL }),
    flatten: GROUND,
  },
  {
    file: 'android-icon-background.png',
    note: 'Adaptive background layer: flat ground.',
    svg: Buffer.from(
      `<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="1024"><rect width="1024" height="1024" fill="${GROUND}" /></svg>`,
    ),
    flatten: GROUND,
  },
  {
    file: 'android-icon-foreground.png',
    note: 'Adaptive foreground. Small enough to survive a circular mask.',
    svg: svg({ size: 1024, fraction: 0.54, ground: null, upright: UPRIGHT, diagonal: DIAGONAL }),
  },
  {
    file: 'android-icon-monochrome.png',
    note: 'Themed-icon layer: one flat colour on transparency.',
    svg: svg({ size: 1024, fraction: 0.54, ground: null, upright: '#FFFFFF', diagonal: '#FFFFFF' }),
  },
  {
    file: 'splash-icon.png',
    note: 'Splash mark. Ground comes from app.json, so this is transparent.',
    svg: svg({ size: 1024, fraction: 0.62, ground: null, upright: UPRIGHT, diagonal: DIAGONAL }),
  },
  {
    file: 'favicon.png',
    note: 'Web favicon.',
    svg: svg({ size: 64, fraction: 0.66, ground: GROUND, upright: UPRIGHT, diagonal: DIAGONAL }),
    flatten: GROUND,
  },
];

mkdirSync(OUT, { recursive: true });

for (const asset of ASSETS) {
  let img = sharp(asset.svg);
  if (asset.flatten) img = img.flatten({ background: asset.flatten });
  const buf = await img.png().toBuffer();
  writeFileSync(join(OUT, asset.file), buf);

  const meta = await sharp(buf).metadata();
  console.log(
    `${asset.file.padEnd(30)} ${meta.width}x${meta.height}  alpha=${meta.hasAlpha}  ${asset.note}`,
  );
}

// admin panel favicon -------------------------------------------------------
// The admin shipped with Next.js's scaffold favicon, so its browser tab showed
// the Next logo rather than Nexora. Generated from the same mark as everything
// above so the tab, the launcher and the sidebar agree.

const ADMIN_APP = join(ROOT, 'admin', 'src', 'app');

// An SVG favicon stays crisp at every size and is what modern browsers prefer.
writeFileSync(
  join(ADMIN_APP, 'icon.svg'),
  svg({ size: 64, fraction: 0.66, ground: GROUND, upright: UPRIGHT, diagonal: DIAGONAL }),
);
console.log('\nadmin/src/app/icon.svg          64x64   SVG favicon');

/**
 * Build a real multi-size .ico. Safari's SVG-favicon support is patchy and
 * some tooling still asks for favicon.ico by path, so both are shipped.
 * The format is a small header plus one directory entry per image; PNG
 * payloads inside an ICO are understood by every browser still in use.
 */
async function buildIco(sizes) {
  // ensureAlpha + palette:false are load-bearing. Next.js parses this file at
  // build time and its ICO decoder rejects anything that is not 8-bit RGBA
  // ("The PNG is not in RGBA format!"), which takes the whole admin app down
  // with a 500. flatten() alone yields 3-channel RGB, and sharp will happily
  // emit a palette PNG for artwork this simple.
  const pngs = await Promise.all(
    sizes.map((size) =>
      sharp(svg({ size, fraction: 0.66, ground: GROUND, upright: UPRIGHT, diagonal: DIAGONAL }))
        .flatten({ background: GROUND })
        .ensureAlpha()
        .png({ palette: false, compressionLevel: 9 })
        .toBuffer(),
    ),
  );

  const header = Buffer.alloc(6);
  header.writeUInt16LE(0, 0); // reserved
  header.writeUInt16LE(1, 2); // 1 = icon
  header.writeUInt16LE(sizes.length, 4);

  let offset = 6 + sizes.length * 16;
  const entries = sizes.map((size, i) => {
    const e = Buffer.alloc(16);
    e.writeUInt8(size >= 256 ? 0 : size, 0); // 0 means 256
    e.writeUInt8(size >= 256 ? 0 : size, 1);
    e.writeUInt8(0, 2); // palette count
    e.writeUInt8(0, 3); // reserved
    e.writeUInt16LE(1, 4); // colour planes
    e.writeUInt16LE(32, 6); // bits per pixel
    e.writeUInt32LE(pngs[i].length, 8);
    e.writeUInt32LE(offset, 12);
    offset += pngs[i].length;
    return e;
  });

  return Buffer.concat([header, ...entries, ...pngs]);
}

const ico = await buildIco([16, 32, 48]);
writeFileSync(join(ADMIN_APP, 'favicon.ico'), ico);
console.log(`admin/src/app/favicon.ico       16/32/48  ${ico.length} bytes`);

console.log('\nDone. Rebuild the app for these to reach a device.');
