import { createPublicKey, verify, type KeyObject } from "node:crypto";

/** DER header of an Ed25519 SubjectPublicKeyInfo: the raw 32-byte key follows. */
const ED25519_SPKI_PREFIX = Buffer.from("302a300506032b6570032100", "hex");

/** Discord gives the public key as 64 hex characters: Node wants a key object. */
export function discordPublicKey(hex: string): KeyObject {
  return createPublicKey({
    key: Buffer.concat([ED25519_SPKI_PREFIX, Buffer.from(hex, "hex")]),
    format: "der",
    type: "spki",
  });
}

/**
 * Checks an interaction the way Discord requires: an Ed25519 signature of
 * the timestamp followed by the raw body, exactly as received. Discord sends
 * forged requests now and then and disables the endpoint if one is accepted.
 */
export function isValidDiscordSignature(
  key: KeyObject,
  signature: unknown,
  timestamp: unknown,
  body: Buffer,
): boolean {
  if (typeof signature !== "string" || typeof timestamp !== "string") return false;
  if (!/^[0-9a-f]{128}$/i.test(signature)) return false;
  try {
    return verify(
      null,
      Buffer.concat([Buffer.from(timestamp, "utf8"), body]),
      key,
      Buffer.from(signature, "hex"),
    );
  } catch {
    return false;
  }
}
