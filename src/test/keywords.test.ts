import { describe, it, expect } from "vitest";
import { calculateRelevance } from "@/lib/keywords";

const baseKeywords = {
  global: ["metal", "band", "gig", "record"],
  contextual: ["tour", "vinyl"],
  contextualSubs: new Set(["r/metalheads"]),
};

describe("calculateRelevance", () => {
  it("matches a global keyword and scores it", () => {
    const { score, matched } = calculateRelevance(
      "Best metal albums of 2024",
      "Looking for recommendations for heavy metal bands with great albums",
      baseKeywords
    );
    expect(matched).toContain("metal");
    expect(score).toBeGreaterThan(0);
  });

  it("rejects metal in a manufacturing context", () => {
    const { matched } = calculateRelevance(
      "Sheet metal fabrication tips",
      "We do sheet metal welding and steel fabrication for roofing projects",
      baseKeywords
    );
    expect(matched).not.toContain("metal");
  });

  it("boosts metal when music context is present", () => {
    const boosted = calculateRelevance(
      "Best metal bands for concerts",
      "Looking for metal bands with great live shows and festivals",
      baseKeywords
    );
    const neutral = calculateRelevance(
      "Metal is great",
      "I just really like metal",
      baseKeywords
    );
    expect(boosted.score).toBeGreaterThan(neutral.score);
  });

  it("rejects band in non-music context", () => {
    const { matched } = calculateRelevance(
      "Rubber band trick",
      "This rubber band resistance band elastic trick is amazing",
      baseKeywords
    );
    expect(matched).not.toContain("band");
  });

  it("boosts title matches", () => {
    const titleMatch = calculateRelevance(
      "Best metal bands ever",
      "Some generic body text",
      baseKeywords
    );
    const bodyOnly = calculateRelevance(
      "Some generic title",
      "Best metal bands ever — looking for recommendations on great shows",
      baseKeywords
    );
    expect(titleMatch.score).toBeGreaterThan(bodyOnly.score);
  });

  it("scores multi-word global keywords higher per-word", () => {
    const multiWord = calculateRelevance(
      "Looking for a metal band",
      "multi word phrase test",
      { ...baseKeywords, global: ["metal band"] }
    );
    expect(multiWord.matched).toContain("metal band");
    expect(multiWord.score).toBeGreaterThan(0);
  });

  it("matches contextual keywords only in contextual subs", () => {
    const inContextualSub = calculateRelevance(
      "vinyl collection",
      "I have a huge vinyl collection",
      baseKeywords,
      "r/metalheads"
    );
    const outOfSub = calculateRelevance(
      "vinyl collection",
      "I have a huge vinyl collection",
      baseKeywords,
      "r/cooking"
    );
    expect(inContextualSub.matched).toContain("vinyl");
    expect(outOfSub.matched).not.toContain("vinyl");
  });

  it("returns zero score and no matches when nothing matches", () => {
    const { score, matched } = calculateRelevance(
      "How to bake bread",
      "Sourdough starter tips and flour ratios",
      baseKeywords
    );
    expect(score).toBe(0);
    expect(matched).toHaveLength(0);
  });

  it("does not double-count a keyword already matched globally", () => {
    const { matched } = calculateRelevance(
      "metal vinyl",
      "metal vinyl",
      { ...baseKeywords, contextualSubs: new Set(["r/test"]) },
      "r/test"
    );
    const metalCount = matched.filter((m) => m === "metal").length;
    expect(metalCount).toBe(1);
  });
});
