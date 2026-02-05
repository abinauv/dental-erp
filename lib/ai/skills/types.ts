/**
 * Skill type definition — each dental skill is a named prompt template
 * with role-based access and a target model tier.
 */

export interface Skill {
  name: string
  displayName: string
  description: string
  allowedRoles: string[]
  modelTier: string // key in AI_MODELS
  systemPrompt: (hospitalName: string, contextStr: string) => string
}
