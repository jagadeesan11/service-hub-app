/**
 * Turning configured social details into things the app can open.
 *
 * Deliberately dependency-free: no React, no Supabase. These are pure string
 * transforms, they are the part most likely to be wrong, and keeping them
 * here means they can be tested without standing up the app.
 */

/**
 * wa.me link for a stored number, or null when there isn't one.
 *
 * wa.me wants bare digits — it silently fails on a leading "+", which looks
 * to a customer like the shop having no WhatsApp rather than a formatting slip.
 */
export function whatsappUrl(number: string | null | undefined): string | null {
  if (!number) return null;
  const digits = number.replace(/\D/g, '');
  return digits ? `https://wa.me/${digits}` : null;
}

/**
 * The handle to show for a profile URL: customers recognise "@motoceramic"
 * from the shop's own signage, not the full https address.
 */
export function instagramHandle(url: string | null | undefined): string | null {
  if (!url) return null;
  const handle = url
    .replace(/^https:\/\/([a-z0-9-]+\.)?instagram\.com\//i, '')
    .replace(/[/?#].*$/, '')
    .trim();
  return handle ? `@${handle}` : null;
}
