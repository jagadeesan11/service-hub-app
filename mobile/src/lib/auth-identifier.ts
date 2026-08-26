/**
 * One field accepts either a phone number or an email address.
 *
 * Asking the customer to first pick "phone or email" and then type it is a
 * decision they shouldn't have to make — the shape of what they type already
 * says which it is.
 */
export type Identifier =
  | { kind: 'email'; email: string }
  | { kind: 'phone'; phone: string }
  | { kind: 'invalid' };

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

/**
 * Phone numbers are stored E.164 (+919876543210), which is what Supabase
 * requires. Customers here type a bare 10-digit number, so a missing country
 * code defaults to +91 rather than being rejected — this is a Pondicherry
 * business and demanding "+91" from someone who has never typed it is a
 * pointless failure. An explicit + always wins, so overseas numbers work.
 */
export function normalisePhone(raw: string): string | null {
  const cleaned = raw.replace(/[\s()-]/g, '');

  if (cleaned.startsWith('+')) {
    return /^\+[1-9]\d{7,14}$/.test(cleaned) ? cleaned : null;
  }
  // Local trunk prefix: 09876543210 -> +919876543210.
  const digits = cleaned.startsWith('0') ? cleaned.slice(1) : cleaned;
  if (/^\d{10}$/.test(digits)) return `+91${digits}`;
  return null;
}

export function parseIdentifier(raw: string): Identifier {
  const value = raw.trim();
  if (!value) return { kind: 'invalid' };

  if (value.includes('@')) {
    return EMAIL.test(value) ? { kind: 'email', email: value.toLowerCase() } : { kind: 'invalid' };
  }

  const phone = normalisePhone(value);
  return phone ? { kind: 'phone', phone } : { kind: 'invalid' };
}

/**
 * Supabase's messages are accurate and unhelpful; these are the ones customers
 * see. The `code` is checked before the text because Supabase's wording
 * changes between releases while the codes are stable.
 */
export function readableAuthError(error: { message: string; code?: string } | string): string {
  const message = typeof error === 'string' ? error : error.message;
  const code = typeof error === 'string' ? undefined : error.code;
  const m = message.toLowerCase();

  // Distinct from ordinary rate limiting: this is the mail sender refusing,
  // not the customer having tried too often. Telling them to wait a minute
  // would be a lie — the window is an hour.
  if (code === 'over_email_send_rate_limit' || m.includes('email rate limit')) {
    return 'We couldn\u2019t send your confirmation email just now. Please try again later, or get in touch and we\u2019ll set your account up for you.';
  }
  if (code === 'over_sms_send_rate_limit' || m.includes('sms rate limit')) {
    return 'We couldn\u2019t send a confirmation text just now. Please try again later, or get in touch and we\u2019ll set your account up for you.';
  }
  if (code === 'invalid_credentials' || m.includes('invalid login credentials')) {
    return 'That email or phone and password don\u2019t match. Check both, or reset your password.';
  }
  if (code === 'user_already_exists' || m.includes('already registered')) {
    return 'You already have an account with this. Try signing in instead.';
  }
  if (code === 'weak_password' || m.includes('password should be at least')) {
    return 'Passwords need to be at least 8 characters.';
  }
  if (code === 'email_not_confirmed' || m.includes('email not confirmed')) {
    return 'Check your inbox and confirm your email address, then sign in.';
  }
  if (code === 'phone_not_confirmed' || m.includes('phone not confirmed')) {
    return 'Confirm your phone number, then sign in.';
  }
  // Genuinely "you did that too often" — this one really is about a minute.
  if (code === 'over_request_rate_limit' || m.includes('too many')) {
    return 'Too many attempts. Wait a minute and try again.';
  }
  return message;
}
