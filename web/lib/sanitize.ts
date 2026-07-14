import { ObjectId } from 'mongodb';

/**
 * Coerce untrusted input (request body / query params) to primitives.
 * This prevents NoSQL operator injection: if an attacker sends an object like
 * { $ne: null } where a string/number is expected, these helpers turn it into
 * a harmless primitive instead of letting it reach a Mongo query filter.
 */

export function str(v: unknown, max = 2000): string {
  if (typeof v === 'string') return v.slice(0, max);
  if (typeof v === 'number' || typeof v === 'boolean') return String(v);
  return '';
}

export function num(v: unknown): number | null {
  const n = typeof v === 'number' ? v : typeof v === 'string' ? Number(v) : NaN;
  return Number.isFinite(n) ? n : null;
}

export function bool(v: unknown): boolean {
  return v === true || v === 'true' || v === 1 || v === '1';
}

/** Safe ObjectId: returns null unless the input is a valid 24-hex string. */
export function oid(v: unknown): ObjectId | null {
  const s = str(v, 24);
  if (!/^[a-f0-9]{24}$/i.test(s)) return null;
  try {
    return new ObjectId(s);
  } catch {
    return null;
  }
}

/** A Discord ID is a numeric snowflake string. Reject anything else. */
export function discordId(v: unknown): string | null {
  const s = str(v, 32).trim();
  return /^[0-9]{5,32}$/.test(s) ? s : null;
}
