/** All lengths in the document model are millimetres. */
export type Mm = number;

export type UnitSystem = 'imperial' | 'metric';

export const MM_PER_INCH = 25.4;

export const inches = (n: number): Mm => n * MM_PER_INCH;
export const feet = (n: number): Mm => n * 12 * MM_PER_INCH;
export const toInches = (mm: Mm): number => mm / MM_PER_INCH;
/** Three.js scene units are metres. */
export const toMetres = (mm: Mm): number => mm / 1000;

function gcd(a: number, b: number): number {
  return b === 0 ? a : gcd(b, a % b);
}

/** Formats a length as feet and inches rounded to the nearest 1/16", e.g. `3' 6 1/2"`. */
export function formatImperial(mm: Mm): string {
  const sign = mm < 0 ? '-' : '';
  const sixteenths = Math.round((Math.abs(mm) / MM_PER_INCH) * 16);
  const ft = Math.floor(sixteenths / (12 * 16));
  const rem = sixteenths - ft * 12 * 16;
  const whole = Math.floor(rem / 16);
  const frac = rem % 16;
  let inchPart = `${whole}`;
  if (frac) {
    const d = gcd(frac, 16);
    inchPart += ` ${frac / d}/${16 / d}`;
  }
  return ft ? `${sign}${ft}' ${inchPart}"` : `${sign}${inchPart}"`;
}

export function formatMetric(mm: Mm): string {
  return Math.abs(mm) >= 1000 ? `${(mm / 1000).toFixed(3).replace(/\.?0+$/, '')} m` : `${Math.round(mm)} mm`;
}

export function formatLength(mm: Mm, system: UnitSystem): string {
  return system === 'imperial' ? formatImperial(mm) : formatMetric(mm);
}

function parseNumber(s: string): number {
  // "6 1/2", "1/2", "6.5"
  const parts = s.trim().split(/\s+/);
  let total = 0;
  for (const p of parts) {
    const frac = p.match(/^(\d+)\/(\d+)$/);
    if (frac) total += Number(frac[1]) / Number(frac[2]);
    else total += Number(p);
  }
  return total;
}

/**
 * Parses user-typed lengths: `3' 6"`, `3ft 6 1/2in`, `42"`, `42`, `1067mm`, `1.2m`, `90cm`.
 * Bare numbers are read in the given unit system (inches or millimetres). Returns null if unparseable.
 */
export function parseLength(input: string, system: UnitSystem = 'imperial'): Mm | null {
  const s = input.trim().toLowerCase().replace(/[″”]/g, '"').replace(/[′’]/g, "'");
  if (!s) return null;

  const metric = s.match(/^(-?[\d.]+)\s*(mm|cm|m)$/);
  if (metric) {
    const n = Number(metric[1]);
    const factor = metric[2] === 'm' ? 1000 : metric[2] === 'cm' ? 10 : 1;
    return Number.isFinite(n) ? n * factor : null;
  }

  const imperial = s.match(/^(?:(-?[\d.]+)\s*(?:'|ft|feet|foot))?\s*(?:([\d./ ]+?)\s*(?:"|in|inch|inches))?$/);
  if (imperial && (imperial[1] || imperial[2])) {
    const ft = imperial[1] ? Number(imperial[1]) : 0;
    const inch = imperial[2] ? parseNumber(imperial[2]) : 0;
    const total = feet(ft) + inches(inch);
    return Number.isFinite(total) ? total : null;
  }

  if (/^-?[\d./ ]+$/.test(s)) {
    const n = parseNumber(s);
    if (!Number.isFinite(n)) return null;
    return system === 'imperial' ? inches(n) : n;
  }
  return null;
}
