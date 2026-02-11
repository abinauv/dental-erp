/**
 * AI Model configuration for OpenRouter.
 * Maps task types to the optimal model + parameters.
 */

export interface ModelConfig {
  model: string
  maxTokens: number
  temperature: number
}

export const AI_MODELS: Record<string, ModelConfig> = {
  default: { model: "google/gemini-2.5-pro", maxTokens: 4096, temperature: 0.7 },
  clinical: { model: "anthropic/claude-opus-4.5", maxTokens: 8192, temperature: 0.2 },
  reports: { model: "google/gemini-2.5-pro", maxTokens: 8192, temperature: 0.3 },
  query: { model: "google/gemini-2.5-pro", maxTokens: 4096, temperature: 0.1 },
  scheduling: { model: "google/gemini-2.5-pro", maxTokens: 2048, temperature: 0.3 },
  billing: { model: "google/gemini-2.5-pro", maxTokens: 4096, temperature: 0.1 },
  insights: { model: "google/gemini-2.5-pro", maxTokens: 4096, temperature: 0.3 },
  command: { model: "google/gemini-2.5-pro", maxTokens: 2048, temperature: 0.1 },
}

/** Skill name → model tier */
export const SKILL_MODEL_MAP: Record<string, string> = {
  "patient-intake": "default",
  "smart-scheduler": "scheduling",
  "treatment-advisor": "clinical",
  "billing-agent": "billing",
  "inventory-manager": "insights",
  "lab-coordinator": "default",
  "clinic-analyst": "reports",
  "whatsapp-receptionist": "default",
  "no-show-predictor": "insights",
  "inventory-forecaster": "insights",
  "cashflow-forecaster": "billing",
  "patient-segmentation": "insights",
  "claim-analyzer": "billing",
  "consent-generator": "clinical",
}

export function getModelForSkill(skillName: string): ModelConfig {
  return AI_MODELS[SKILL_MODEL_MAP[skillName] || "default"]
}

export function getModelByTier(tier: string): ModelConfig {
  return AI_MODELS[tier] || AI_MODELS.default
}
