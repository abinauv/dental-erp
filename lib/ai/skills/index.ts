import { patientIntake } from "./patient-intake"
import { smartScheduler } from "./smart-scheduler"
import { treatmentAdvisor } from "./treatment-advisor"
import { billingAgent } from "./billing-agent"
import { inventoryManager } from "./inventory-manager"
import { labCoordinator } from "./lab-coordinator"
import { clinicAnalyst } from "./clinic-analyst"
import { whatsappReceptionist } from "./whatsapp-receptionist"
import { noShowPredictor } from "./no-show-predictor"
import { inventoryForecaster } from "./inventory-forecaster"
import { cashflowForecaster } from "./cashflow-forecaster"
import { patientSegmentation } from "./patient-segmentation"
import { claimAnalyzer } from "./claim-analyzer"
import { consentGenerator } from "./consent-generator"
import type { Skill } from "./types"

export const SKILLS: Record<string, Skill> = {
  [patientIntake.name]: patientIntake,
  [smartScheduler.name]: smartScheduler,
  [treatmentAdvisor.name]: treatmentAdvisor,
  [billingAgent.name]: billingAgent,
  [inventoryManager.name]: inventoryManager,
  [labCoordinator.name]: labCoordinator,
  [clinicAnalyst.name]: clinicAnalyst,
  [whatsappReceptionist.name]: whatsappReceptionist,
  [noShowPredictor.name]: noShowPredictor,
  [inventoryForecaster.name]: inventoryForecaster,
  [cashflowForecaster.name]: cashflowForecaster,
  [patientSegmentation.name]: patientSegmentation,
  [claimAnalyzer.name]: claimAnalyzer,
  [consentGenerator.name]: consentGenerator,
}

export function getSkill(name: string): Skill | undefined {
  return SKILLS[name]
}

/** Skills the given role is allowed to invoke */
export function getSkillsForRole(role: string): Skill[] {
  return Object.values(SKILLS).filter((s) => s.allowedRoles.includes(role))
}

export type { Skill } from "./types"
