import assert from "node:assert/strict";
import { generateKeyPairSync, sign } from "node:crypto";
import { describe, it } from "node:test";
import { discordPublicKey, isValidDiscordSignature } from "./discord-signature";

describe("isValidDiscordSignature", () => {
  const { publicKey, privateKey } = generateKeyPairSync("ed25519");
  // The raw key as the developer portal shows it: the last 32 bytes of the DER.
  const hex = publicKey.export({ format: "der", type: "spki" }).subarray(-32).toString("hex");
  const key = discordPublicKey(hex);
  const body = Buffer.from('{"type":1}');
  const timestamp = "1700000000";
  const signature = sign(null, Buffer.concat([Buffer.from(timestamp), body]), privateKey).toString("hex");

  it("accepts a genuine request", () => {
    assert.equal(isValidDiscordSignature(key, signature, timestamp, body), true);
  });

  it("refuses a tampered body or timestamp", () => {
    assert.equal(isValidDiscordSignature(key, signature, timestamp, Buffer.from('{"type":2}')), false);
    assert.equal(isValidDiscordSignature(key, signature, "1700000001", body), false);
  });

  it("refuses missing or malformed headers", () => {
    assert.equal(isValidDiscordSignature(key, undefined, timestamp, body), false);
    assert.equal(isValidDiscordSignature(key, "zz", timestamp, body), false);
  });
});
