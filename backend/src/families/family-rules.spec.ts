import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  membership,
  parseQids,
  parseRules,
  toPostgresRegex,
  type FamilyDefinition,
} from "./family-rules";

const definition = (overrides: Partial<FamilyDefinition> = {}): FamilyDefinition => ({
  match: "any",
  rules: [
    { field: "name", pattern: "cancer" },
    { field: "icd10", pattern: "^C" },
    { field: "name", pattern: "bénin", exclude: true },
  ],
  includedCardIds: [],
  excludedCardIds: [],
  ...overrides,
});

describe("family rules", () => {
  it("takes a card matching any include rule", () => {
    assert.deepEqual(membership(definition(), { cardId: "a", hits: [false, true, false] }), {
      member: true,
      reason: "rules",
    });
    assert.equal(membership(definition(), { cardId: "a", hits: [false, false, false] }).member, false);
  });

  it("needs every include rule with `all`", () => {
    const all = definition({ match: "all" });
    assert.equal(membership(all, { cardId: "a", hits: [true, false, false] }).member, false);
    assert.equal(membership(all, { cardId: "a", hits: [true, true, false] }).member, true);
  });

  it("lets an exclude rule win over the include rules", () => {
    assert.deepEqual(membership(definition(), { cardId: "a", hits: [true, true, true] }), {
      member: false,
      reason: "excludedByRule",
    });
  });

  it("puts the admin's own picks above every rule", () => {
    const picked = definition({ includedCardIds: ["in"], excludedCardIds: ["out"] });
    assert.deepEqual(membership(picked, { cardId: "in", hits: [false, false, true] }), {
      member: true,
      reason: "manual",
    });
    assert.deepEqual(membership(picked, { cardId: "out", hits: [true, true, false] }), {
      member: false,
      reason: "manual",
    });
  });

  it("matches nothing without an include rule", () => {
    const onlyExclude = definition({ rules: [{ field: "name", pattern: "x", exclude: true }] });
    assert.equal(membership(onlyExclude, { cardId: "a", hits: [false] }).member, false);
  });

  it("turns the JavaScript word boundary into PostgreSQL's", () => {
    assert.equal(toPostgresRegex("\\bcancer\\b"), "\\ycancer\\y");
    assert.equal(toPostgresRegex("\\Bx"), "\\Yx");
    assert.equal(toPostgresRegex("a\\\\b"), "a\\\\b");
    assert.equal(toPostgresRegex("\\d+"), "\\d+");
  });

  it("reads lists of QIDs", () => {
    assert.deepEqual(parseQids("Q12078"), ["Q12078"]);
    assert.deepEqual(parseQids(" q12078, Q18556617 Q12078 "), ["Q12078", "Q18556617"]);
    assert.equal(parseQids("cancer"), null);
    assert.equal(parseQids(""), null);
  });

  it("drops what is not a rule from the stored JSON", () => {
    assert.deepEqual(
      parseRules([{ field: "name", pattern: "x" }, { field: "nope", pattern: "x" }, null, { field: "icd10" }]),
      [{ field: "name", pattern: "x", locale: null, exclude: false }],
    );
    assert.deepEqual(parseRules("oops"), []);
  });
});
