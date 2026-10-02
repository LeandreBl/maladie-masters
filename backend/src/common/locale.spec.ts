import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  fallbackChain,
  localeFromAcceptLanguage,
  parseLocale,
  pickLocalized,
} from "./locale";

describe("parseLocale", () => {
  it("reads the primary subtag", () => {
    assert.equal(parseLocale("fr-FR"), "fr");
    assert.equal(parseLocale("zh-Hans-CN"), "zh");
    assert.equal(parseLocale("ZH_tw"), "zh");
    assert.equal(parseLocale("de"), null);
    assert.equal(parseLocale(undefined), null);
  });
});

describe("localeFromAcceptLanguage", () => {
  it("takes the best supported language by quality", () => {
    assert.equal(localeFromAcceptLanguage("de-DE,de;q=0.9,zh;q=0.8,en;q=0.7"), "zh");
    assert.equal(localeFromAcceptLanguage("en;q=0.5,fr"), "fr");
    assert.equal(localeFromAcceptLanguage("de,es"), null);
    assert.equal(localeFromAcceptLanguage(""), null);
  });
});

describe("fallbackChain", () => {
  it("falls back to English, then the rest", () => {
    assert.deepEqual(fallbackChain("zh"), ["zh", "en", "fr"]);
    assert.deepEqual(fallbackChain("en"), ["en", "fr", "zh"]);
  });
});

describe("pickLocalized", () => {
  const rows = [
    { locale: "fr", name: "Grippe" },
    { locale: "en", name: "Influenza" },
  ];

  it("serves the language asked for when there is one", () => {
    assert.equal(pickLocalized(rows, "fr")?.name, "Grippe");
  });

  it("falls back to English", () => {
    assert.equal(pickLocalized(rows, "zh")?.name, "Influenza");
  });

  it("falls back to whatever exists without English", () => {
    assert.equal(pickLocalized([{ locale: "fr", name: "Grippe" }], "zh")?.name, "Grippe");
  });
});
