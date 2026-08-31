/**
 * Editing a service from the shop floor.
 *
 * Pure, so the rules can be tested without a device. Only the fields worth
 * changing between customers live here — name, blurb, price, how long it takes,
 * whether it is bookable. Photos, categories and add-on structure stay on the
 * web panel; they are desk work and a phone is the wrong tool for them.
 */

export interface ServiceDraft {
  name: string;
  description: string;
  /** Kept as typed text, not a number: a half-typed "12." is a valid thing to
   *  be holding mid-edit, and coercing early makes the field fight the user. */
  basePrice: string;
  durationMinutes: string;
  isActive: boolean;
}

export interface EditableService {
  name: string;
  description: string | null;
  base_price: number;
  duration_minutes: number | null;
  is_active: boolean;
}

export const NAME_MAX = 80;
export const DESCRIPTION_MAX = 500;

export function draftFrom(service: EditableService): ServiceDraft {
  return {
    name: service.name,
    description: service.description ?? '',
    basePrice: String(service.base_price ?? 0),
    durationMinutes: service.duration_minutes === null ? '' : String(service.duration_minutes),
    isActive: service.is_active,
  };
}

/** The first problem with a draft, or null when it is fit to save. */
export function validateDraft(draft: ServiceDraft): string | null {
  const name = draft.name.trim();
  if (!name) return 'Give the service a name.';
  if (name.length > NAME_MAX) return `Keep the name under ${NAME_MAX} characters.`;
  if (draft.description.length > DESCRIPTION_MAX) {
    return `Keep the description under ${DESCRIPTION_MAX} characters.`;
  }

  const price = Number(draft.basePrice.trim());
  if (draft.basePrice.trim() === '' || !Number.isFinite(price)) {
    return 'Enter a price as a number.';
  }
  if (price < 0) return 'A price cannot be negative.';

  const duration = draft.durationMinutes.trim();
  if (duration !== '') {
    const minutes = Number(duration);
    if (!Number.isFinite(minutes) || !Number.isInteger(minutes)) {
      return 'Enter the duration in whole minutes.';
    }
    if (minutes <= 0) return 'A duration has to be more than zero minutes.';
  }

  return null;
}

/**
 * The patch to send, with the draft's text coerced back to real values.
 *
 * Only call this on a draft that has passed validateDraft — it assumes the
 * numbers parse.
 */
export function patchFrom(draft: ServiceDraft): EditableService {
  const duration = draft.durationMinutes.trim();
  return {
    name: draft.name.trim(),
    // Empty means "no description", which is null in the column rather than an
    // empty string; the two would otherwise render differently downstream.
    description: draft.description.trim() === '' ? null : draft.description.trim(),
    base_price: Number(draft.basePrice.trim()),
    duration_minutes: duration === '' ? null : Number(duration),
    is_active: draft.isActive,
  };
}

/** Whether anything actually changed, so Save can stay quiet when it has
 *  nothing to do. */
export function hasChanges(draft: ServiceDraft, service: EditableService): boolean {
  const next = patchFrom(draft);
  return (
    next.name !== service.name ||
    next.description !== (service.description ?? null) ||
    next.base_price !== Number(service.base_price) ||
    next.duration_minutes !== service.duration_minutes ||
    next.is_active !== service.is_active
  );
}
