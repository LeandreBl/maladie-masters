import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { DISCORD_MESSAGES, escapeMarkdown, localeFromDiscord } from "./discord-messages";

describe("localeFromDiscord", () => {
  it("maps Discord locales to the game's", () => {
    assert.equal(localeFromDiscord("fr"), "fr");
    assert.equal(localeFromDiscord("zh-TW"), "zh");
    assert.equal(localeFromDiscord("en-GB"), "en");
  });

  it("tries each candidate, then falls back to English", () => {
    assert.equal(localeFromDiscord(undefined, "pt-BR", "fr"), "fr");
    assert.equal(localeFromDiscord("de"), "en");
  });
});

describe("escapeMarkdown", () => {
  it("neutralizes formatting characters", () => {
    assert.equal(escapeMarkdown("**a**_b_||c||"), "\\*\\*a\\*\\*\\_b\\_\\|\\|c\\|\\|");
  });
});

describe("announce", () => {
  it("lists several legendaries", () => {
    assert.equal(
      DISCORD_MESSAGES.fr.announce("<@1>", ["A", "B", "C"], false),
      "🏆 <@1> vient de tirer 3 cartes **légendaires** : A, B et C !",
    );
  });
});
