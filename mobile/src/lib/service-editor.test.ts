import {
  draftFrom,
  hasChanges,
  patchFrom,
  validateDraft,
  type EditableService,
  type ServiceDraft,
} from '@/lib/service-editor';

const SERVICE: EditableService = {
  name: 'Ceramic Coating — 2 Years Warranty',
  description: 'Nine-layer coat, cured overnight.',
  base_price: 13500,
  duration_minutes: 240,
  is_active: true,
};

const clean = (over: Partial<ServiceDraft> = {}): ServiceDraft => ({
  ...draftFrom(SERVICE),
  ...over,
});

describe('draftFrom', () => {
  it('turns a service into editable text', () => {
    expect(draftFrom(SERVICE)).toEqual({
      name: 'Ceramic Coating — 2 Years Warranty',
      description: 'Nine-layer coat, cured overnight.',
      basePrice: '13500',
      durationMinutes: '240',
      isActive: true,
    });
  });

  it('renders a missing description and duration as empty fields, not "null"', () => {
    const draft = draftFrom({ ...SERVICE, description: null, duration_minutes: null });
    expect(draft.description).toBe('');
    expect(draft.durationMinutes).toBe('');
  });
});

describe('validateDraft', () => {
  it('accepts a clean draft', () => {
    expect(validateDraft(clean())).toBeNull();
  });

  it('refuses an empty or whitespace-only name', () => {
    expect(validateDraft(clean({ name: '' }))).toMatch(/name/i);
    expect(validateDraft(clean({ name: '   ' }))).toMatch(/name/i);
  });

  it('refuses a name longer than the column expects', () => {
    expect(validateDraft(clean({ name: 'x'.repeat(81) }))).toMatch(/80/);
  });

  it('refuses a price that is not a number', () => {
    expect(validateDraft(clean({ basePrice: '' }))).toMatch(/number/i);
    expect(validateDraft(clean({ basePrice: 'free' }))).toMatch(/number/i);
  });

  it('refuses a negative price', () => {
    expect(validateDraft(clean({ basePrice: '-1' }))).toMatch(/negative/i);
  });

  it('allows a price of zero — some services are included', () => {
    expect(validateDraft(clean({ basePrice: '0' }))).toBeNull();
  });

  it('allows an empty duration, meaning nobody has said', () => {
    expect(validateDraft(clean({ durationMinutes: '' }))).toBeNull();
  });

  it('refuses a fractional or zero duration', () => {
    expect(validateDraft(clean({ durationMinutes: '30.5' }))).toMatch(/whole minutes/i);
    expect(validateDraft(clean({ durationMinutes: '0' }))).toMatch(/more than zero/i);
  });
});

describe('patchFrom', () => {
  it('coerces the text back to real values', () => {
    expect(patchFrom(clean())).toEqual(SERVICE);
  });

  it('trims, and stores an empty description as null rather than ""', () => {
    const patch = patchFrom(clean({ name: '  Buff  ', description: '   ' }));
    expect(patch.name).toBe('Buff');
    expect(patch.description).toBeNull();
  });

  it('stores an empty duration as null', () => {
    expect(patchFrom(clean({ durationMinutes: '' })).duration_minutes).toBeNull();
  });
});

describe('hasChanges', () => {
  it('is false for an untouched draft', () => {
    expect(hasChanges(clean(), SERVICE)).toBe(false);
  });

  it('ignores whitespace the user only visited', () => {
    expect(hasChanges(clean({ name: '  Ceramic Coating — 2 Years Warranty  ' }), SERVICE)).toBe(
      false,
    );
  });

  it('notices each field that actually moved', () => {
    expect(hasChanges(clean({ name: 'Other' }), SERVICE)).toBe(true);
    expect(hasChanges(clean({ basePrice: '14000' }), SERVICE)).toBe(true);
    expect(hasChanges(clean({ durationMinutes: '180' }), SERVICE)).toBe(true);
    expect(hasChanges(clean({ isActive: false }), SERVICE)).toBe(true);
    expect(hasChanges(clean({ description: 'New blurb' }), SERVICE)).toBe(true);
  });

  it('does not report a change when a blank description was already null', () => {
    const noDesc = { ...SERVICE, description: null };
    expect(hasChanges(draftFrom(noDesc), noDesc)).toBe(false);
  });

  it('compares price numerically, so "13500.00" is not a change', () => {
    expect(hasChanges(clean({ basePrice: '13500.00' }), SERVICE)).toBe(false);
  });
});
