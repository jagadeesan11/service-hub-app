'use client';

import { useRef, useState } from 'react';

import {
  ACCEPTED_LABEL,
  ACCEPTED_TYPES,
  HARD_LIMIT_BYTES,
  MAX_HEIGHT,
  MAX_SOURCE_BYTES,
  MAX_WIDTH,
  formatBytes,
  prepareImage,
} from '@/lib/prepare-image';
import { createClient } from '@/lib/supabase/client';

export interface ServiceImage {
  path: string;
  url: string;
}

const BUCKET = 'service-images';
const PUBLIC_URL_MARKER = `/object/public/${BUCKET}/`;

export function imagesFromUrls(urls: string[]): ServiceImage[] {
  return urls.map((url) => {
    const idx = url.indexOf(PUBLIC_URL_MARKER);
    const path = idx === -1 ? url : url.slice(idx + PUBLIC_URL_MARKER.length);
    return { path, url };
  });
}

export function ServiceImageUploader({
  folderId,
  images,
  onChange,
}: {
  folderId: string;
  images: ServiceImage[];
  onChange: (images: ServiceImage[]) => void;
}) {
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notes, setNotes] = useState<string[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  async function handleFilesSelected(event: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(event.target.files ?? []);
    event.target.value = '';
    if (files.length === 0) return;

    setIsUploading(true);
    setError(null);
    setNotes([]);
    const supabase = createClient();
    const uploaded: ServiceImage[] = [];
    const messages: string[] = [];

    for (const original of files) {
      let prepared;
      try {
        // Resized and re-encoded in the browser before it ever leaves. A phone
        // photo is 8-12 MB and Storage serves whatever it is given, so without
        // this every customer downloads the full thing over mobile data.
        prepared = await prepareImage(original);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Could not process that image.');
        continue;
      }

      const safeName = prepared.file.name.replace(/[^a-zA-Z0-9.\-_]/g, '_');
      const path = `${folderId}/${crypto.randomUUID()}-${safeName}`;
      const { error: uploadError } = await supabase.storage
        .from(BUCKET)
        .upload(path, prepared.file, { contentType: prepared.file.type });

      if (uploadError) {
        // Storage answers "Payload too large" / "invalid_mime_type" with no
        // numbers in it. The person uploading needs the figure, not the code.
        const raw = uploadError.message;
        const friendly = /payload too large|exceeded the maximum/i.test(raw)
          ? `${original.name} was rejected: the server limit is ${formatBytes(HARD_LIMIT_BYTES)} per image.`
          : /mime type|invalid_mime/i.test(raw)
            ? `${original.name} was rejected: only ${ACCEPTED_LABEL} are allowed.`
            : raw;
        setError(friendly);
        continue;
      }

      const { data } = supabase.storage.from(BUCKET).getPublicUrl(path);
      uploaded.push({ path, url: data.publicUrl });

      if (prepared.ratioWarning) messages.push(prepared.ratioWarning);
      if (prepared.originalBytes > prepared.bytes * 1.2) {
        messages.push(
          `${original.name}: resized to ${prepared.width}×${prepared.height}, ` +
            `${formatBytes(prepared.originalBytes)} → ${formatBytes(prepared.bytes)}.`,
        );
      }
    }

    onChange([...images, ...uploaded]);
    setNotes(messages);
    setIsUploading(false);
  }

  async function handleRemove(image: ServiceImage) {
    const previous = images;
    onChange(images.filter((i) => i.path !== image.path));

    const supabase = createClient();
    const { error: removeError } = await supabase.storage.from(BUCKET).remove([image.path]);
    if (removeError) {
      onChange(previous);
      setError(removeError.message);
    }
  }

  return (
    <div>
      <p className="mb-2 text-xs text-muted-foreground">
        Best at {MAX_WIDTH}×{MAX_HEIGHT} (16:9), {ACCEPTED_LABEL}. Bigger photos are resized here
        automatically — up to {formatBytes(MAX_SOURCE_BYTES)} per file, and never more than{' '}
        {formatBytes(HARD_LIMIT_BYTES)} once uploaded. Keep the subject centred: the app crops the
        top and bottom on list cards.
      </p>

      {error && <p className="mb-2 text-sm text-destructive">{error}</p>}
      {notes.length > 0 && (
        <ul className="mb-2 space-y-0.5">
          {notes.map((n) => (
            <li key={n} className="text-xs text-muted-foreground">
              {n}
            </li>
          ))}
        </ul>
      )}

      <div className="grid grid-cols-4 gap-3">
        {images.map((image) => (
          <div
            key={image.path}
            className="group relative aspect-square overflow-hidden rounded-lg border border-border"
          >
            {/* eslint-disable-next-line @next/next/no-img-element -- remote Supabase Storage URL, not a build-time asset */}
            <img src={image.url} alt="" className="h-full w-full object-cover" />
            <button
              type="button"
              onClick={() => handleRemove(image)}
              className="absolute top-1 right-1 rounded-full bg-black/60 px-1.5 py-0.5 text-xs text-white opacity-0 transition-opacity group-hover:opacity-100"
            >
              Remove
            </button>
          </div>
        ))}

        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          disabled={isUploading}
          className="flex aspect-square items-center justify-center rounded-lg border border-dashed border-neutral-300 text-sm text-muted-foreground hover:border-neutral-400 disabled:opacity-50 dark:border-neutral-700"
        >
          {isUploading ? 'Uploading...' : '+ Add'}
        </button>
      </div>

      <input
        ref={fileInputRef}
        type="file"
        accept={ACCEPTED_TYPES.join(',')}
        multiple
        className="hidden"
        onChange={handleFilesSelected}
      />
    </div>
  );
}
