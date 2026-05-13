export type ValidationErrors = Record<string, string>;

export const REQUIRED = "Obavezno polje";
export const INVALID_EMAIL = "Neispravan email";
export const INVALID_YEAR = "Godište mora biti između 1990 i sljedeće godine";
export const MUST_BE_POSITIVE = "Mora biti veće od 0";
export const MUST_BE_NON_NEGATIVE = "Ne smije biti negativno";
export const REGISTRATION_TOO_SHORT = "Registracija je prekratka";

export function isFilled(value: unknown): boolean {
  if (value == null) return false;
  if (typeof value === "string") return value.trim() !== "";
  if (typeof value === "number") return isFinite(value);
  return true;
}

export function isValidEmail(value: string): boolean {
  if (!value) return true;
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());
}

export function isValidYear(value: number | string | undefined): boolean {
  const n = typeof value === "string" ? parseInt(value, 10) : value;
  if (n == null || !isFinite(n as number)) return false;
  const next = new Date().getFullYear() + 1;
  return (n as number) >= 1990 && (n as number) <= next;
}

export function isPositiveNumber(value: number | string | undefined): boolean {
  const n = typeof value === "string" ? parseFloat(value) : value;
  return n != null && isFinite(n as number) && (n as number) > 0;
}

export function isNonNegativeNumber(value: number | string | undefined | null): boolean {
  if (value === undefined || value === null || value === "") return true;
  const n = typeof value === "string" ? parseFloat(value) : value;
  return isFinite(n as number) && (n as number) >= 0;
}

/** Minimal sanity check for a Bosnian-style plate (>= 4 alphanumerics after trimming separators). */
export function isValidRegistration(value: string): boolean {
  const stripped = value.replace(/[\s\-_]/g, "");
  return stripped.length >= 4;
}
