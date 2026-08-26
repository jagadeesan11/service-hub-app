/**
 * Searching the Users table.
 *
 * Pure and dependency-free so the matching rules can be tested directly —
 * they are the part that is easy to get subtly wrong, and a search that
 * quietly fails to find someone looks like the account not existing.
 */

/** Only the fields search reads; keeps this usable from tests and any caller. */
export interface SearchableUser {
  name: string | null;
  email: string | null;
  phone: string | null;
  login_email: string | null;
  login_phone: string | null;
}

const digitsOf = (value: string) => value.replace(/\D/g, '');

/**
 * Matches a user against a free-text query.
 *
 * Phone numbers are compared digits-only and from the right-hand end, because
 * nobody types the number the way it is stored: the account holds
 * "+919876543210" and the person searching types "98765 43210" off a job
 * sheet. Comparing raw strings finds neither.
 */
export function matchesUserQuery(user: SearchableUser, rawQuery: string): boolean {
  const query = rawQuery.trim().toLowerCase();
  if (!query) return true;

  // Phone numbers are deliberately NOT in this haystack. They are matched
  // digits-only below, behind a minimum length: leaving them here meant a
  // query of "9" was a substring of almost every stored number and matched
  // the whole table, which is worse than no result at all.
  const text = [user.name, user.email, user.login_email]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();
  if (text.includes(query)) return true;

  const queryDigits = digitsOf(query);
  if (queryDigits.length < 4) return false;

  return [user.phone, user.login_phone]
    .filter((v): v is string => Boolean(v))
    .some((value) => {
      const stored = digitsOf(value);
      // Suffix match: the stored number may carry a country code the searcher
      // did not type. "9876543210" must find "+919876543210".
      return stored.endsWith(queryDigits) || stored.includes(queryDigits);
    });
}
