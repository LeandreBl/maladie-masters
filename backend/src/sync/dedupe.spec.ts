import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { dedupeByArticle } from "./dedupe";

describe("dedupeByArticle", () => {
  const canonical: Record<string, string> = {
    Sadomasochisme: "BDSM",
    BDSM: "BDSM",
    Grippe: "Grippe",
  };

  it("keeps the item whose sitelink is the article itself", () => {
    const { kept, dropped } = dedupeByArticle(
      [
        { wikidataId: "Q1", pageTitle: "Sadomasochisme" },
        { wikidataId: "Q99", pageTitle: "BDSM" },
        { wikidataId: "Q5", pageTitle: "Grippe" },
      ],
      (entry) => canonical[entry.pageTitle] ?? entry.pageTitle,
    );
    assert.deepEqual(kept.map((entry) => entry.wikidataId), ["Q99", "Q5"]);
    assert.deepEqual(dropped.map((entry) => entry.wikidataId), ["Q1"]);
  });

  it("falls back to the lowest QID", () => {
    const { kept } = dedupeByArticle(
      [
        { wikidataId: "Q20", pageTitle: "Alias A" },
        { wikidataId: "Q3", pageTitle: "Alias B" },
      ],
      () => "Article",
    );
    assert.deepEqual(kept.map((entry) => entry.wikidataId), ["Q3"]);
  });
});
