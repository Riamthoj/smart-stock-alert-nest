import { randomBytes } from 'node:crypto';

/**
 * UUIDv7 (RFC 9562): 48-bit unix-ms timestamp + randomness.
 * Time-ordered, so ORDER BY id == oldest first and the PK index stays compact.
 * Same id format as the FastAPI version (uuid.uuid7).
 */
export function uuidv7(): string {
  const bytes = randomBytes(16);
  let ms = Date.now();
  for (let i = 5; i >= 0; i--) {
    bytes[i] = ms % 256;
    ms = Math.floor(ms / 256);
  }
  bytes[6] = (bytes[6] & 0x0f) | 0x70; // version 7
  bytes[8] = (bytes[8] & 0x3f) | 0x80; // variant 10xx
  const hex = bytes.toString('hex');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}
