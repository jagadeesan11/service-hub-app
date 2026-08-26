/**
 * Recommended dimensions for a service photo.
 *
 * The hero on the service page renders at full screen width by 230pt. On the
 * largest phones at 3x that is roughly 1290x690 physical pixels, so 1600x900
 * covers every device with margin. Anything larger cannot render sharper —
 * Storage serves the file exactly as uploaded, with no resizing — it only
 * costs the customer mobile data.
 */
export const MAX_WIDTH = 1600;
export const MAX_HEIGHT = 900;

/** What the re-encode aims for. The bucket rejects anything over 2 MB. */
export const TARGET_BYTES = 300 * 1024;
export const HARD_LIMIT_BYTES = 2 * 1024 * 1024;

/**
 * Refused before any processing starts. Decoding a very large file into a
 * canvas allocates width × height × 4 bytes — a 100-megapixel photo is about
 * 400 MB of memory — so the browser tab can hang or crash before reaching any
 * error handling. Better to say no immediately, with the number.
 */
export const MAX_SOURCE_BYTES = 25 * 1024 * 1024;

export const ACCEPTED_TYPES = ['image/jpeg', 'image/png', 'image/webp'];

/** Human-readable names for the accepted types, for error copy. */
export const ACCEPTED_LABEL = 'JPEG, PNG or WebP';

/**
 * The image is shown at two different shapes — the service hero at roughly
 * 1.6-1.9:1 and the category card at 2.1-2.6:1 — and both crop to fill. An
 * image far outside that band loses a lot to the crop, so the caller warns
 * rather than silently mangling it.
 */
export const SAFE_RATIO_MIN = 1.4;
export const SAFE_RATIO_MAX = 2.7;

export interface PreparedImage {
  file: File;
  width: number;
  height: number;
  originalBytes: number;
  bytes: number;
  /** Set when the shape will lose noticeable content to the cover-crop. */
  ratioWarning?: string;
}

function loadImage(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('That file could not be read as an image.'));
    };
    img.src = url;
  });
}

function toBlob(canvas: HTMLCanvasElement, quality: number): Promise<Blob | null> {
  return new Promise((resolve) => canvas.toBlob(resolve, 'image/jpeg', quality));
}

/**
 * Downscales and re-encodes a chosen file so it lands within the recommended
 * size without the person uploading having to prepare anything.
 *
 * Aspect ratio is preserved — the image is fitted inside 1600x900 rather than
 * cropped to it. Cropping someone's photo without showing them the result is
 * worse than letting the app's own cover-crop handle it at render time.
 */
export async function prepareImage(file: File): Promise<PreparedImage> {
  if (!ACCEPTED_TYPES.includes(file.type)) {
    throw new Error(
      `${file.name} is ${file.type || 'an unknown type'}. Allowed: ${ACCEPTED_LABEL}.`,
    );
  }

  // Every refusal names the limit AND what was actually supplied, so it is
  // obvious by how much the file misses and what to do about it.
  if (file.size > MAX_SOURCE_BYTES) {
    throw new Error(
      `${file.name} is ${formatBytes(file.size)}. The largest file that can be processed is ` +
        `${formatBytes(MAX_SOURCE_BYTES)} — resize it first, ideally to ${MAX_WIDTH}×${MAX_HEIGHT}.`,
    );
  }

  const img = await loadImage(file);
  const ratio = img.width / img.height;

  // Fit inside the box; never scale a small image up, which only adds bytes.
  const scale = Math.min(MAX_WIDTH / img.width, MAX_HEIGHT / img.height, 1);
  const width = Math.round(img.width * scale);
  const height = Math.round(img.height * scale);

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Could not process the image in this browser.');
  ctx.drawImage(img, 0, 0, width, height);

  // Step the quality down until it fits, rather than guessing one value: a
  // flat photo and a detailed one compress very differently.
  let blob: Blob | null = null;
  for (const quality of [0.82, 0.72, 0.62, 0.5]) {
    blob = await toBlob(canvas, quality);
    if (blob && blob.size <= TARGET_BYTES) break;
  }
  if (!blob) throw new Error('Could not process the image in this browser.');

  if (blob.size > HARD_LIMIT_BYTES) {
    throw new Error(
      `${file.name} is still ${formatBytes(blob.size)} after compression, over the ` +
        `${formatBytes(HARD_LIMIT_BYTES)} limit. Try a simpler or smaller image.`,
    );
  }

  const name = file.name.replace(/\.[^.]+$/, '') + '.jpg';

  return {
    file: new File([blob], name, { type: 'image/jpeg' }),
    width,
    height,
    originalBytes: file.size,
    bytes: blob.size,
    ratioWarning:
      ratio < SAFE_RATIO_MIN || ratio > SAFE_RATIO_MAX
        ? `${file.name} is ${ratio.toFixed(2)}:1. The app crops to fill, so a lot of this one will be cut off — around 16:9 works best.`
        : undefined,
  };
}

export function formatBytes(bytes: number): string {
  return bytes >= 1024 * 1024
    ? `${(bytes / 1024 / 1024).toFixed(1)} MB`
    : `${Math.round(bytes / 1024)} KB`;
}
