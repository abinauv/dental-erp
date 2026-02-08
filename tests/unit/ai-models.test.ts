import { describe, it, expect } from "vitest";
import {
  AI_MODELS,
  SKILL_MODEL_MAP,
  getModelForSkill,
  getModelByTier,
  type ModelConfig,
} from "@/lib/ai/models";

// ---------------------------------------------------------------------------
// Constants used across multiple test groups
// ---------------------------------------------------------------------------

const EXPECTED_TIERS = [
  "default",
  "clinical",
  "reports",
  "query",
  "scheduling",
  "billing",
  "insights",
  "command",
] as const;

const EXPECTED_SKILLS = [
  "patient-intake",
  "smart-scheduler",
  "treatment-advisor",
  "billing-agent",
  "inventory-manager",
  "lab-coordinator",
  "clinic-analyst",
  "whatsapp-receptionist",
] as const;

// ---------------------------------------------------------------------------
// 1. AI_MODELS — tier coverage
// ---------------------------------------------------------------------------

describe("AI_MODELS", () => {
  it("contains exactly the 8 expected tiers", () => {
    const tierKeys = Object.keys(AI_MODELS);
    expect(tierKeys).toHaveLength(EXPECTED_TIERS.length);
    for (const tier of EXPECTED_TIERS) {
      expect(AI_MODELS).toHaveProperty(tier);
    }
  });

  // 2. Every ModelConfig has valid shape
  describe.each(EXPECTED_TIERS)("tier '%s'", (tier) => {
    const config: ModelConfig = AI_MODELS[tier];

    it("has a non-empty model string", () => {
      expect(typeof config.model).toBe("string");
      expect(config.model.length).toBeGreaterThan(0);
    });

    it("has maxTokens > 0", () => {
      expect(config.maxTokens).toBeGreaterThan(0);
    });

    it("has temperature between 0 and 1 (inclusive)", () => {
      expect(config.temperature).toBeGreaterThanOrEqual(0);
      expect(config.temperature).toBeLessThanOrEqual(1);
    });
  });

  // 3. Clinical tier specifics
  describe("clinical tier", () => {
    const clinical = AI_MODELS.clinical;

    it("uses an Anthropic Claude model", () => {
      expect(clinical.model).toMatch(/anthropic\/claude/);
    });

    it("has high maxTokens (>= 8192)", () => {
      expect(clinical.maxTokens).toBeGreaterThanOrEqual(8192);
    });

    it("has a low temperature (<= 0.3)", () => {
      expect(clinical.temperature).toBeLessThanOrEqual(0.3);
    });
  });
});

// ---------------------------------------------------------------------------
// 4. SKILL_MODEL_MAP — skill coverage
// ---------------------------------------------------------------------------

describe("SKILL_MODEL_MAP", () => {
  it("contains exactly the 8 expected skills", () => {
    const skillKeys = Object.keys(SKILL_MODEL_MAP);
    expect(skillKeys).toHaveLength(EXPECTED_SKILLS.length);
    for (const skill of EXPECTED_SKILLS) {
      expect(SKILL_MODEL_MAP).toHaveProperty(skill);
    }
  });

  it("maps every skill to a valid tier in AI_MODELS", () => {
    for (const skill of EXPECTED_SKILLS) {
      const tier = SKILL_MODEL_MAP[skill];
      expect(AI_MODELS).toHaveProperty(tier);
    }
  });
});

// ---------------------------------------------------------------------------
// 5 & 6. getModelForSkill
// ---------------------------------------------------------------------------

describe("getModelForSkill", () => {
  // 5. Returns the correct config for each known skill
  it.each([
    ["patient-intake", "default"],
    ["smart-scheduler", "scheduling"],
    ["treatment-advisor", "clinical"],
    ["billing-agent", "billing"],
    ["inventory-manager", "insights"],
    ["lab-coordinator", "default"],
    ["clinic-analyst", "reports"],
    ["whatsapp-receptionist", "default"],
  ] as const)("returns the '%s' skill mapped to the '%s' tier config", (skill, expectedTier) => {
    const result = getModelForSkill(skill);
    const expected = AI_MODELS[expectedTier];
    expect(result).toEqual(expected);
  });

  // 6. Falls back to default for unknown skills
  it("returns the default config for an unknown skill", () => {
    expect(getModelForSkill("nonexistent-skill")).toEqual(AI_MODELS.default);
  });

  it("returns the default config for an empty string skill", () => {
    expect(getModelForSkill("")).toEqual(AI_MODELS.default);
  });
});

// ---------------------------------------------------------------------------
// 7 & 8. getModelByTier
// ---------------------------------------------------------------------------

describe("getModelByTier", () => {
  // 7. Returns correct config for each known tier
  it.each(EXPECTED_TIERS)("returns the correct config for tier '%s'", (tier) => {
    const result = getModelByTier(tier);
    expect(result).toEqual(AI_MODELS[tier]);
  });

  // 8. Falls back to default for unknown tiers
  it("returns the default config for an unknown tier", () => {
    expect(getModelByTier("nonexistent-tier")).toEqual(AI_MODELS.default);
  });

  it("returns the default config for an empty string tier", () => {
    expect(getModelByTier("")).toEqual(AI_MODELS.default);
  });
});
