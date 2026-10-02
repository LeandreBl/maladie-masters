import { randomInt } from "node:crypto";

/** No 0/O, 1/I/L: the code is read on one screen and typed on another. */
const ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
export const LINK_CODE_LENGTH = 8;
export const LINK_CODE_TTL_MS = 10 * 60_000;

/** A fresh code, stored without separator: `K7PQ3MZA`. */
export function generateLinkCode(): string {
  let code = "";
  for (let index = 0; index < LINK_CODE_LENGTH; index += 1) {
    code += ALPHABET[randomInt(0, ALPHABET.length)];
  }
  return code;
}

/** Shown as `K7PQ-3MZA`, easier to copy by eye. */
export function formatLinkCode(code: string): string {
  return `${code.slice(0, 4)}-${code.slice(4)}`;
}

/**
 * What the player typed, back to the stored form: case, spaces and the dash
 * do not matter. Null when it cannot be a code, to skip the lookup.
 */
export function normalizeLinkCode(input: unknown): string | null {
  if (typeof input !== "string") return null;
  const code = input.toUpperCase().replace(/[^A-Z0-9]/g, "");
  return code.length === LINK_CODE_LENGTH && [...code].every((char) => ALPHABET.includes(char))
    ? code
    : null;
}
