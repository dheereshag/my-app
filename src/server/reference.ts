/** Human-readable booking references. The alphabet drops look-alikes (0/O, 1/I/L). */

const ALPHABET = "23456789ABCDEFGHJKMNPQRSTUVWXYZ";
const REFERENCE_LENGTH = 8;

export function createBookingReference(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(REFERENCE_LENGTH));
  const code = Array.from(bytes, (byte) => ALPHABET.charAt(byte % ALPHABET.length)).join("");
  return `SU26-${code}`;
}
