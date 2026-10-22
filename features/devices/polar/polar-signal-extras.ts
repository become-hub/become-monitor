/**
 * Polar BLE PPI / HR notification extras stashed for Monitor UI and Ably ticks.
 * Pure helpers — no React / Ably / HRV domain imports.
 */

/** Latest PPI quality / contact fields kept for periodic Ably ticks. */
export type PolarPpiExtrasStash = {
  errorEstimate: number | null;
  blocker: boolean | null;
  skinContactStatus: boolean | null;
  skinContactSupported: boolean | null;
};

/** Latest BLE HR notification extras (often empty on 360/Loop with PPI active). */
export type PolarHrExtrasStash = {
  ppgQuality: number | null;
  correctedHr: number | null;
  rrAvailable: boolean | null;
  rrsMs: number[] | null;
  contactDetected: boolean | null;
  contactSupported: boolean | null;
};

export const EMPTY_POLAR_PPI_EXTRAS: PolarPpiExtrasStash = {
  errorEstimate: null,
  blocker: null,
  skinContactStatus: null,
  skinContactSupported: null,
};

export const EMPTY_POLAR_HR_EXTRAS: PolarHrExtrasStash = {
  ppgQuality: null,
  correctedHr: null,
  rrAvailable: null,
  rrsMs: null,
  contactDetected: null,
  contactSupported: null,
};

function positiveOrNull(value: number | null | undefined): number | null {
  return value != null && Number.isFinite(value) && value > 0 ? value : null;
}

function nonNegativeOrNull(value: number | null | undefined): number | null {
  return value != null && Number.isFinite(value) && value >= 0 ? value : null;
}

function boolOrNull(value: boolean | null | undefined): boolean | null {
  return typeof value === "boolean" ? value : null;
}

/**
 * Prefer PPI skin contact when the sample supports it; otherwise HR notification contact.
 */
export function resolvePolarContact(
  ppi: Pick<
    PolarPpiExtrasStash,
    "skinContactStatus" | "skinContactSupported"
  > | null | undefined,
  hr: Pick<PolarHrExtrasStash, "contactDetected" | "contactSupported"> | null | undefined
): {
  contactStatus: boolean | null;
  contactStatusSupported: boolean | null;
} {
  if (ppi?.skinContactSupported === true) {
    return {
      contactStatus: boolOrNull(ppi.skinContactStatus),
      contactStatusSupported: true,
    };
  }
  if (hr?.contactSupported === true) {
    return {
      contactStatus: boolOrNull(hr.contactDetected),
      contactStatusSupported: true,
    };
  }
  const supported =
    boolOrNull(ppi?.skinContactSupported) ?? boolOrNull(hr?.contactSupported);
  const status =
    boolOrNull(ppi?.skinContactStatus) ?? boolOrNull(hr?.contactDetected);
  return {
    contactStatus: status,
    contactStatusSupported: supported,
  };
}

export function stashPolarHrExtras(data: {
  ppgQuality?: number;
  correctedHr?: number;
  rrAvailable?: boolean;
  rrsMs?: number[];
  contactDetected?: boolean;
  contactSupported?: boolean;
}): PolarHrExtrasStash {
  return {
    ppgQuality: positiveOrNull(data.ppgQuality),
    correctedHr: positiveOrNull(data.correctedHr),
    rrAvailable: boolOrNull(data.rrAvailable),
    rrsMs:
      data.rrsMs != null && data.rrsMs.length > 0 ? [...data.rrsMs] : null,
    contactDetected: boolOrNull(data.contactDetected),
    contactSupported: boolOrNull(data.contactSupported),
  };
}

export function stashPolarPpiExtras(sample: {
  errorEstimate?: number;
  blocker?: boolean;
  skinContactStatus?: boolean;
  skinContactSupported?: boolean;
}): PolarPpiExtrasStash {
  return {
    errorEstimate: nonNegativeOrNull(sample.errorEstimate),
    blocker: boolOrNull(sample.blocker),
    skinContactStatus: boolOrNull(sample.skinContactStatus),
    skinContactSupported: boolOrNull(sample.skinContactSupported),
  };
}

/** Merge PPI + HR stashes into Ably extras (contact prefers PPI when supported). */
export function polarExtrasFromStash(
  ppi: PolarPpiExtrasStash | null | undefined,
  hr: PolarHrExtrasStash | null | undefined
): {
  contactStatus: boolean | null;
  contactStatusSupported: boolean | null;
  errorEstimate: number | null;
  blocker: boolean | null;
  ppgQuality: number | null;
  correctedHr: number | null;
  rrAvailable: boolean | null;
  rrsMs: number[] | null;
} {
  const contact = resolvePolarContact(ppi, hr);
  return {
    ...contact,
    errorEstimate: ppi?.errorEstimate ?? null,
    blocker: ppi?.blocker ?? null,
    ppgQuality: hr?.ppgQuality ?? null,
    correctedHr: hr?.correctedHr ?? null,
    rrAvailable: hr?.rrAvailable ?? null,
    rrsMs: hr?.rrsMs ?? null,
  };
}
