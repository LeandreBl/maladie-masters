import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  formatLinkCode,
  generateLinkCode,
  LINK_CODE_LENGTH,
  normalizeLinkCode,
} from "./discord-link-code";

describe("discord link codes", () => {
  it("generates codes that survive their own normalization", () => {
    for (let index = 0; index < 50; index += 1) {
      const code = generateLinkCode();
      assert.equal(code.length, LINK_CODE_LENGTH);
      assert.equal(normalizeLinkCode(formatLinkCode(code)), code);
    }
  });

  it("ignores case, spaces and the dash", () => {
    assert.equal(normalizeLinkCode(" k7pq-3mza "), "K7PQ3MZA");
  });

  it("refuses what cannot be a code", () => {
    assert.equal(normalizeLinkCode("K7PQ3MZ"), null);
    assert.equal(normalizeLinkCode("K7PQ3MZO"), null);
    assert.equal(normalizeLinkCode(42), null);
  });
});
