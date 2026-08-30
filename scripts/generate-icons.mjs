/**
 * Regenerates every launcher/splash asset from one source of truth:
 * mobile/assets/brand/nexora-logo-source.png — the Nexora badge artwork.
 *
 * Run it whenever the logo changes:
 *   node scripts/generate-icons.mjs
 *
 * Needs `sharp`, which is resolved from whichever workspace already has it.
 *
 * Store rules this encodes, so they are not rediscovered by rejection:
 *  - icon.png must be fully opaque with square corners; the stores apply their
 *    own mask, and a pre-rounded icon gets double-rounded. The source badge IS
 *    pre-rounded, so it is zoomed past its own corner radius rather than
 *    padded with a flat colour, which would band against the gradient.
 *  - The Android adaptive foreground is cropped hard. Only the central ~61% of
 *    the canvas survives a circular mask — which would eat the "NEXORA"
 *    wordmark entirely. So the foreground carries the N alone, and the
 *    wordmark lives only where the whole badge is visible (icon, splash).
 *  - The monochrome layer must be a single flat colour on transparency;
 *    Android recolours it for themed icons and ignores whatever hue is there.
 */
import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');

// ESM import() ignores NODE_PATH, so resolve through CJS require, which does
// walk node_modules from the paths we give it.
const require = createRequire(import.meta.url);
let sharp;
for (const base of [ROOT, join(ROOT, 'mobile'), join(ROOT, 'admin')]) {
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

const SRC = join(ROOT, 'mobile', 'assets', 'brand', 'nexora-logo-source.png');
const OUT = join(ROOT, 'mobile', 'assets', 'images');
const ADMIN_APP = join(ROOT, 'admin', 'src', 'app');

/**
 * Where things sit inside the trimmed badge, as fractions of its box. Measured
 * off the artwork rather than guessed: the N occupies x 20.7–79.3%,
 * y 15.5–66.9%; the wordmark 71.5–81.3%; its underline 85.9–86.6%.
 */
const MARK = { left: 0.2, top: 0.148, width: 0.6, height: 0.528 };

/**
 * How much of a favicon the N fills. Favicons drop the wordmark entirely —
 * "NEXORA" is unreadable at 16px and only muddies the mark.
 */
const TILE_FRACTION = 0.74;

/**
 * Enough zoom to push the badge's own rounded corners outside a square crop.
 * A corner of radius r is cleared by an inset of r(1 - 1/sqrt2) ~= 0.293r; at
 * r ~= 18% of the edge that is ~5.3%, so 1.15 leaves margin. Verified after
 * generation by asserting icon.png has no alpha.
 */
const ICON_ZOOM = 1.15;

/** Luminance window that separates the bright N from the dark badge ground. */
const ALPHA_LO = 55;
const ALPHA_HI = 125;

/**
 * The monochrome layer keys on the brightest channel instead, at a hard step.
 * Luminance under-reads the ribbon's deep blue and magenta passages — they are
 * vivid but dark — so keying on luminance punched semi-transparent holes
 * through the middle of the N and Android rendered a grey, shaded smudge where
 * a themed icon wants one flat silhouette.
 */
const MONO_KEY = 132;

/**
 * Blur-then-threshold the keyed mask. This morphological smoothing is what
 * turns a key into a shape: it closes the pinholes left by the ribbon's folds
 * and shaves the stray wisps around the stroke ends. Raising it much past 4
 * starts rounding the N's corners off.
 */
const MONO_BLUR = 3;

/**
 * Encoding for the derived assets. Passing `effort` to sharp's PNG encoder
 * implicitly turns on palette quantisation — it is NOT lossless, whatever the
 * name suggests. It costs 256 colours and a faint dither visible only under
 * magnification, and takes this artwork from 1.5 MB to 240 KB a file. Worth it
 * for things rendered at 48–220px; these all ship inside every build.
 */
const PNG_DERIVED = { compressionLevel: 9, effort: 10 };

/**
 * icon.png keeps full colour. It is the master the stores re-encode every
 * launcher density from, and quantising a source that everything else is
 * derived from spends the same 256 colours twice.
 */
const PNG_MASTER = { compressionLevel: 9 };

const badge = await sharp(SRC).trim({ threshold: 10 }).png().toBuffer();
const { width: BW, height: BH } = await sharp(badge).metadata();

const px = (f, of) => Math.round(f * of);
const markRegion = {
  left: px(MARK.left, BW),
  top: px(MARK.top, BH),
  width: px(MARK.width, BW),
  height: px(MARK.height, BH),
};

/** The badge's own ground behind the mark, so the adaptive background layer
 *  matches the artwork instead of an unrelated brand constant. */
async function groundColour() {
  const { data, info } = await sharp(badge)
    .extract(markRegion)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  let r = 0;
  let g = 0;
  let b = 0;
  let n = 0;
  for (let i = 0; i < info.width * info.height; i += 1) {
    const s = i * info.channels;
    const lum = 0.2126 * data[s] + 0.7152 * data[s + 1] + 0.0722 * data[s + 2];
    if (data[s + 3] > 200 && lum < ALPHA_LO) {
      r += data[s];
      g += data[s + 1];
      b += data[s + 2];
      n += 1;
    }
  }
  const avg = (v) => Math.round(v / n);
  return { r: avg(r), g: avg(g), b: avg(b) };
}

const GROUND = await groundColour();
const GROUND_HEX =
  '#' + [GROUND.r, GROUND.g, GROUND.b].map((v) => v.toString(16).padStart(2, '0')).join('');

/**
 * The N lifted off its ground onto transparency. Alpha comes from luminance
 * rather than a hard key, so the stroke keeps its antialiased edge; the slight
 * blue fringe that leaves is invisible because the foreground is only ever
 * composited over the matching background layer.
 */
async function isolateMark({ flat = false } = {}) {
  const { data, info } = await sharp(badge)
    .extract(markRegion)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });

  const count = info.width * info.height;
  const out = Buffer.alloc(count * 4);
  const raw = { width: info.width, height: info.height, channels: 4 };

  if (flat) {
    const mask = Buffer.alloc(count);
    for (let i = 0; i < count; i += 1) {
      const s = i * info.channels;
      mask[i] = Math.max(data[s], data[s + 1], data[s + 2]) >= MONO_KEY ? 255 : 0;
    }
    const smoothed = await sharp(mask, {
      raw: { width: info.width, height: info.height, channels: 1 },
    })
      .blur(MONO_BLUR)
      .threshold(128)
      // sharp promotes a single-channel raw buffer to sRGB on output. Without
      // this the mask comes back three times as long, every index is off, and
      // the silhouette fills the whole crop.
      .toColourspace('b-w')
      .raw()
      .toBuffer();

    for (let i = 0; i < count; i += 1) {
      const d = i * 4;
      out[d] = 255;
      out[d + 1] = 255;
      out[d + 2] = 255;
      out[d + 3] = smoothed[i];
    }
    return sharp(out, { raw }).png().toBuffer();
  }

  for (let i = 0; i < count; i += 1) {
    const s = i * info.channels;
    const r = data[s];
    const g = data[s + 1];
    const b = data[s + 2];
    const lum = 0.2126 * r + 0.7152 * g + 0.0722 * b;
    let a = (lum - ALPHA_LO) / (ALPHA_HI - ALPHA_LO);
    a = a < 0 ? 0 : a > 1 ? 1 : a;
    a = a * a * (3 - 2 * a); // smoothstep, so the edge rolls off
    const d = i * 4;
    out[d] = r;
    out[d + 1] = g;
    out[d + 2] = b;
    out[d + 3] = Math.round(a * 255 * (data[s + 3] / 255));
  }
  return sharp(out, { raw }).png().toBuffer();
}

/** Centre something on a transparent square, at a given share of the canvas. */
async function onCanvas(input, { size, fraction }) {
  const box = Math.round(size * fraction);
  const scaled = await sharp(input)
    .resize(box, box, { fit: 'inside', background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .png()
    .toBuffer();
  const m = await sharp(scaled).metadata();
  return sharp({
    create: { width: size, height: size, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } },
  })
    .composite([
      {
        input: scaled,
        left: Math.round((size - m.width) / 2),
        top: Math.round((size - m.height) / 2),
      },
    ])
    .png()
    .toBuffer();
}

/**
 * Favicon tile: the N on flat ground. Built by compositing the isolated mark
 * rather than cropping a square out of the badge — the N is nearly as wide as
 * the space between the wordmark and the badge's rounded corners, so any square
 * crop that clears the wordmark also shaves the N's outer strokes.
 */
async function tile(size) {
  const mark = await onCanvas(markCutout, { size, fraction: TILE_FRACTION });
  return sharp(mark).flatten({ background: GROUND }).png().toBuffer();
}

/** The whole badge, zoomed past its rounded corners into an opaque square. */
async function squareIcon(size) {
  const big = Math.round(size * ICON_ZOOM);
  const inset = Math.round((big - size) / 2);
  return sharp(badge)
    .resize(big, big, { fit: 'cover', position: 'centre' })
    .extract({ left: inset, top: inset, width: size, height: size })
    .flatten({ background: GROUND })
    .png()
    .toBuffer();
}

// Cut once. The adaptive foreground and every favicon size share one cutout,
// so the launcher icon and the browser tab cannot drift apart.
const markCutout = await isolateMark();
const markSilhouette = await isolateMark({ flat: true });

mkdirSync(OUT, { recursive: true });

const flatGround = await sharp({
  create: { width: 1024, height: 1024, channels: 3, background: GROUND },
})
  .png()
  .toBuffer();

const assets = [
  ['icon.png', await squareIcon(1024), 'iOS + store listing. Opaque, square corners.'],
  ['android-icon-background.png', flatGround, `Adaptive background: flat ${GROUND_HEX}.`],
  [
    'android-icon-foreground.png',
    await onCanvas(markCutout, { size: 1024, fraction: 0.54 }),
    'Adaptive foreground: the N alone, inside the mask.',
  ],
  [
    'android-icon-monochrome.png',
    await onCanvas(markSilhouette, { size: 1024, fraction: 0.54 }),
    'Themed-icon layer: flat white on transparency.',
  ],
  [
    'splash-icon.png',
    await sharp(badge).resize(1024, 1024, { fit: 'inside' }).png().toBuffer(),
    'Splash badge, wordmark included. Ground comes from app.json.',
  ],
  ['favicon.png', await tile(64), 'Web favicon: the N, legible at 64px.'],
];

for (const [file, buf, note] of assets) {
  // Encoded once, here, rather than inside each helper: the intermediate
  // buffers feed one another, and quantising a buffer that a later step
  // derives from compounds the loss.
  const encoded = await sharp(buf)
    .png(file === 'icon.png' ? PNG_MASTER : PNG_DERIVED)
    .toBuffer();
  writeFileSync(join(OUT, file), encoded);

  const info = await sharp(encoded).metadata();
  const kb = `${Math.round(encoded.length / 1024)}KB`;
  console.log(
    `${file.padEnd(30)} ${info.width}x${info.height}  alpha=${info.hasAlpha}  ${kb.padStart(7)}  ${note}`,
  );
  if (file === 'icon.png' && info.hasAlpha) {
    console.error('  !! icon.png kept an alpha channel — stores reject transparent icons.');
    process.exitCode = 1;
  }
}

// The old flat-colour favicon, displaced when the new logo was dropped in.
rmSync(join(OUT, 'favicon_1.png'), { force: true });

// admin panel favicon -------------------------------------------------------
// Generated from the same artwork so the browser tab, the launcher and the
// sidebar agree. The previous icon.svg is removed: the source is a raster now,
// and Next.js prefers icon.svg over everything else if it is left behind.

rmSync(join(ADMIN_APP, 'icon.svg'), { force: true });
writeFileSync(join(ADMIN_APP, 'icon.png'), await sharp(await tile(256)).png(PNG_DERIVED).toBuffer());
console.log('\nadmin/src/app/icon.png          256x256  tab icon');

// The sidebar lockup: the same N tile as the tab icon, so the two agree.
//
// The N carries its own ground rather than sitting on transparency, because it
// is white and cyan and would vanish against the admin's light theme. It drops
// the wordmark for the opposite reason to the favicon's — not illegibility
// alone, but redundancy: this renders at 24–40px beside the word "Nexora".
const ADMIN_PUBLIC = join(ROOT, 'admin', 'public');
mkdirSync(ADMIN_PUBLIC, { recursive: true });
writeFileSync(
  join(ADMIN_PUBLIC, 'nexora-mark.png'),
  await sharp(await tile(256)).png(PNG_DERIVED).toBuffer(),
);
console.log('admin/public/nexora-mark.png    256x256  sidebar lockup');

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
    sizes.map(async (size) =>
      sharp(await tile(size)).ensureAlpha().png({ ...PNG_MASTER, palette: false }).toBuffer(),
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

console.log(`\nBadge ${BW}x${BH}, ground ${GROUND_HEX}.`);
console.log('Done. Rebuild the app for these to reach a device.');
