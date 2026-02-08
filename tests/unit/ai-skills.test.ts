import { describe, it, expect } from "vitest";
import { SKILLS, getSkill, getSkillsForRole } from "@/lib/ai/skills/index";
import { SKILL_MODEL_MAP, AI_MODELS } from "@/lib/ai/models";

// ---------------------------------------------------------------------------
// Constants used across multiple test groups
// ---------------------------------------------------------------------------

const EXPECTED_SKILL_NAMES = [
  "patient-intake",
  "smart-scheduler",
  "treatment-advisor",
  "billing-agent",
  "inventory-manager",
  "lab-coordinator",
  "clinic-analyst",
  "whatsapp-receptionist",
] as const;

/** Expected role → allowed-skill-names mapping (derived from the actual skill files) */
const EXPECTED_ROLE_SKILLS: Record<string, string[]> = {
  ADMIN: [
    "patient-intake",
    "smart-scheduler",
    "treatment-advisor",
    "billing-agent",
    "inventory-manager",
    "lab-coordinator",
    "clinic-analyst",
    "whatsapp-receptionist",
  ],
  RECEPTIONIST: ["patient-intake", "smart-scheduler", "whatsapp-receptionist"],
  DOCTOR: ["treatment-advisor", "lab-coordinator", "clinic-analyst"],
  ACCOUNTANT: ["billing-agent", "clinic-analyst"],
  LAB_TECH: ["lab-coordinator"],
};

/** Expected skill name → model tier mapping */
const EXPECTED_TIERS: Record<string, string> = {
  "patient-intake": "default",
  "smart-scheduler": "scheduling",
  "treatment-advisor": "clinical",
  "billing-agent": "billing",
  "inventory-manager": "insights",
  "lab-coordinator": "default",
  "clinic-analyst": "reports",
  "whatsapp-receptionist": "default",
};

// Sentinel values used in systemPrompt assertions
const TEST_HOSPITAL_NAME = "Test Dental Clinic";
const TEST_CONTEXT_STRING = "Patient: John Doe, Age: 35, Next appointment: 2025-06-01";

// ---------------------------------------------------------------------------
// 1. SKILLS registry — count
// ---------------------------------------------------------------------------

describe("SKILLS registry", () => {
  it("contains exactly 8 entries", () => {
    expect(Object.keys(SKILLS)).toHaveLength(8);
  });

  it("contains all expected skill names as keys", () => {
    for (const name of EXPECTED_SKILL_NAMES) {
      expect(SKILLS).toHaveProperty(name);
    }
  });

  it("contains no unexpected skill names", () => {
    const actualKeys = Object.keys(SKILLS).sort();
    const expectedKeys = [...EXPECTED_SKILL_NAMES].sort();
    expect(actualKeys).toEqual(expectedKeys);
  });
});

// ---------------------------------------------------------------------------
// 2. Each skill has required properties
// ---------------------------------------------------------------------------

describe("Skill shape validation", () => {
  describe.each(EXPECTED_SKILL_NAMES)("skill '%s'", (skillName) => {
    const skill = SKILLS[skillName];

    it("has a non-empty `name` string", () => {
      expect(typeof skill.name).toBe("string");
      expect(skill.name.length).toBeGreaterThan(0);
    });

    it("has `name` equal to its registry key", () => {
      expect(skill.name).toBe(skillName);
    });

    it("has a non-empty `displayName` string", () => {
      expect(typeof skill.displayName).toBe("string");
      expect(skill.displayName.length).toBeGreaterThan(0);
    });

    it("has a non-empty `description` string", () => {
      expect(typeof skill.description).toBe("string");
      expect(skill.description.length).toBeGreaterThan(0);
    });

    it("has a non-empty `allowedRoles` array", () => {
      expect(Array.isArray(skill.allowedRoles)).toBe(true);
      expect(skill.allowedRoles.length).toBeGreaterThan(0);
    });

    it("has every entry in `allowedRoles` as a non-empty string", () => {
      for (const role of skill.allowedRoles) {
        expect(typeof role).toBe("string");
        expect(role.length).toBeGreaterThan(0);
      }
    });

    it("has a non-empty `modelTier` string", () => {
      expect(typeof skill.modelTier).toBe("string");
      expect(skill.modelTier.length).toBeGreaterThan(0);
    });

    it("has `systemPrompt` as a function", () => {
      expect(typeof skill.systemPrompt).toBe("function");
    });
  });
});

// ---------------------------------------------------------------------------
// 3. getSkill returns correct skill for each known name
// ---------------------------------------------------------------------------

describe("getSkill", () => {
  it.each(EXPECTED_SKILL_NAMES)(
    "returns the correct skill for '%s'",
    (skillName) => {
      const skill = getSkill(skillName);
      expect(skill).toBeDefined();
      expect(skill!.name).toBe(skillName);
      // Ensure it is the exact same object from the SKILLS registry
      expect(skill).toBe(SKILLS[skillName]);
    },
  );

  // 4. getSkill returns undefined for unknown skill names
  it("returns undefined for an unknown skill name", () => {
    expect(getSkill("nonexistent-skill")).toBeUndefined();
  });

  it("returns undefined for an empty string", () => {
    expect(getSkill("")).toBeUndefined();
  });

  it("returns undefined for a name with different casing", () => {
    expect(getSkill("Patient-Intake")).toBeUndefined();
    expect(getSkill("PATIENT-INTAKE")).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// 5–10. getSkillsForRole
// ---------------------------------------------------------------------------

describe("getSkillsForRole", () => {
  // 5. ADMIN gets all 8 skills
  it('returns all 8 skills for "ADMIN"', () => {
    const skills = getSkillsForRole("ADMIN");
    expect(skills).toHaveLength(8);
    const names = skills.map((s) => s.name).sort();
    expect(names).toEqual([...EXPECTED_SKILL_NAMES].sort());
  });

  // 6. DOCTOR gets treatment-advisor, lab-coordinator, clinic-analyst
  it('returns treatment-advisor, lab-coordinator, and clinic-analyst for "DOCTOR"', () => {
    const skills = getSkillsForRole("DOCTOR");
    const names = skills.map((s) => s.name).sort();
    expect(names).toEqual(
      [...EXPECTED_ROLE_SKILLS.DOCTOR].sort(),
    );
  });

  // 7. RECEPTIONIST gets patient-intake, smart-scheduler, whatsapp-receptionist
  it('returns patient-intake, smart-scheduler, and whatsapp-receptionist for "RECEPTIONIST"', () => {
    const skills = getSkillsForRole("RECEPTIONIST");
    const names = skills.map((s) => s.name).sort();
    expect(names).toEqual(
      [...EXPECTED_ROLE_SKILLS.RECEPTIONIST].sort(),
    );
  });

  // 8. ACCOUNTANT gets billing-agent and clinic-analyst
  it('returns billing-agent and clinic-analyst for "ACCOUNTANT"', () => {
    const skills = getSkillsForRole("ACCOUNTANT");
    const names = skills.map((s) => s.name).sort();
    expect(names).toEqual(
      [...EXPECTED_ROLE_SKILLS.ACCOUNTANT].sort(),
    );
  });

  // 9. LAB_TECH gets lab-coordinator
  it('returns only lab-coordinator for "LAB_TECH"', () => {
    const skills = getSkillsForRole("LAB_TECH");
    expect(skills).toHaveLength(1);
    expect(skills[0].name).toBe("lab-coordinator");
  });

  // 10. Unknown role gets empty array
  it('returns an empty array for "UNKNOWN_ROLE"', () => {
    const skills = getSkillsForRole("UNKNOWN_ROLE");
    expect(skills).toEqual([]);
  });

  it("returns an empty array for an empty string role", () => {
    const skills = getSkillsForRole("");
    expect(skills).toEqual([]);
  });

  // Every returned skill actually lists the queried role
  it.each(Object.keys(EXPECTED_ROLE_SKILLS))(
    'every skill returned for "%s" includes that role in allowedRoles',
    (role) => {
      const skills = getSkillsForRole(role);
      for (const skill of skills) {
        expect(skill.allowedRoles).toContain(role);
      }
    },
  );
});

// ---------------------------------------------------------------------------
// 11–12. systemPrompt behaviour
// ---------------------------------------------------------------------------

describe("systemPrompt", () => {
  // 11. Each skill's systemPrompt returns a string containing the hospital name
  describe.each(EXPECTED_SKILL_NAMES)(
    "skill '%s' systemPrompt",
    (skillName) => {
      const skill = SKILLS[skillName];
      const output = skill.systemPrompt(TEST_HOSPITAL_NAME, TEST_CONTEXT_STRING);

      it("returns a string", () => {
        expect(typeof output).toBe("string");
      });

      it("is non-empty", () => {
        expect(output.length).toBeGreaterThan(0);
      });

      it("contains the hospital name", () => {
        expect(output).toContain(TEST_HOSPITAL_NAME);
      });

      // 12. Each skill's systemPrompt returns a string containing the context string
      it("contains the context string", () => {
        expect(output).toContain(TEST_CONTEXT_STRING);
      });
    },
  );

  // Edge-case: empty inputs still produce a string
  it("returns a string even when hospital name and context are empty", () => {
    for (const name of EXPECTED_SKILL_NAMES) {
      const output = SKILLS[name].systemPrompt("", "");
      expect(typeof output).toBe("string");
      expect(output.length).toBeGreaterThan(0);
    }
  });

  // Edge-case: special characters in inputs are included verbatim
  it("includes special characters from inputs verbatim", () => {
    const specialHospital = "Dr. O'Brien & Partners <Dental>";
    const specialContext = 'Allergies: "Penicillin", Status: active & stable';
    for (const name of EXPECTED_SKILL_NAMES) {
      const output = SKILLS[name].systemPrompt(specialHospital, specialContext);
      expect(output).toContain(specialHospital);
      expect(output).toContain(specialContext);
    }
  });
});

// ---------------------------------------------------------------------------
// 13. Model tier validation — each skill's modelTier matches SKILL_MODEL_MAP
// ---------------------------------------------------------------------------

describe("model tier consistency", () => {
  it.each(EXPECTED_SKILL_NAMES)(
    "skill '%s' modelTier matches SKILL_MODEL_MAP",
    (skillName) => {
      const skill = SKILLS[skillName];
      expect(skill.modelTier).toBe(SKILL_MODEL_MAP[skillName]);
    },
  );

  it.each(EXPECTED_SKILL_NAMES)(
    "skill '%s' modelTier matches expected tier constant",
    (skillName) => {
      expect(SKILLS[skillName].modelTier).toBe(EXPECTED_TIERS[skillName]);
    },
  );

  it.each(EXPECTED_SKILL_NAMES)(
    "skill '%s' modelTier is a valid key in AI_MODELS",
    (skillName) => {
      const tier = SKILLS[skillName].modelTier;
      expect(AI_MODELS).toHaveProperty(tier);
    },
  );
});

// ---------------------------------------------------------------------------
// Bonus: every ADMIN role check — ADMIN appears in allowedRoles for every skill
// ---------------------------------------------------------------------------

describe("ADMIN access", () => {
  it.each(EXPECTED_SKILL_NAMES)(
    'skill "%s" includes ADMIN in allowedRoles',
    (skillName) => {
      expect(SKILLS[skillName].allowedRoles).toContain("ADMIN");
    },
  );
});
