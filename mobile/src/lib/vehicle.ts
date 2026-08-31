/**
 * Reading a vehicle out of a customer asset's free-form attributes.
 *
 * The keys are `vehicle_make`, `vehicle_model` and `vehicle_size`. Two screens
 * had been reaching for `make` and `model`, which do not exist — so both came
 * back undefined and the label quietly fell through to the only key that did
 * match, printing the size where the vehicle should be. It looked like a
 * mapping bug rather than a missing field, because "SUV" is a plausible answer
 * to "which vehicle".
 *
 * Centralised here so the key names are written once.
 */

export type VehicleAttributes = Record<string, string> | null | undefined;

/** Sizes are stored lowercase; only this one is an initialism. */
const SIZE_LABELS: Record<string, string> = {
  suv: 'SUV',
  muv: 'MUV',
};

function titleCase(value: string): string {
  return value
    .split(/[\s_-]+/)
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(' ');
}

/**
 * "Maruti Suzuki Baleno". Make and model only — the size is a separate field
 * and repeating it here is what produced "Maruti Suzuki Baleno SUV" beside a
 * column already headed Size.
 */
export function vehicleLabel(attrs: VehicleAttributes): string | null {
  const parts = [attrs?.vehicle_make, attrs?.vehicle_model]
    .map((p) => p?.trim())
    .filter((p): p is string => Boolean(p));

  if (parts.length === 0) return null;
  // Makes are typed by hand and arrive as "tata" or "KIA". Left alone: an
  // owner who typed "KIA" should not be shown "Kia", and title-casing every
  // make would mangle the ones that are genuinely initialisms.
  return parts.join(' ');
}

/** "SUV", "Sedan", "Hatchback". Null when nobody recorded one. */
export function vehicleSize(attrs: VehicleAttributes): string | null {
  const raw = attrs?.vehicle_size?.trim();
  if (!raw) return null;
  return SIZE_LABELS[raw.toLowerCase()] ?? titleCase(raw);
}
