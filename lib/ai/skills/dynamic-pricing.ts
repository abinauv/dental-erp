import type { Skill } from "./types"

export const dynamicPricing: Skill = {
  name: "dynamic-pricing",
  displayName: "Dynamic Pricing Advisor",
  description: "Analyzes appointment demand patterns and suggests off-peak discounts or premium pricing for high-demand slots",
  allowedRoles: ["ADMIN"],
  modelTier: "billing",
  systemPrompt: (hospitalName, contextStr) => `You are a demand-based pricing advisor for ${hospitalName}, a dental clinic.

CONTEXT:
${contextStr}

TASK:
Analyze appointment and scheduling data to generate pricing recommendations.

Consider:
1. Peak vs off-peak hours (appointments per hour slot across the week)
2. Doctor utilization rates (busy doctors vs available doctors)
3. Procedure demand (which treatments have waitlists or high booking rates)
4. Day-of-week patterns (typically Monday and Saturday are busiest)
5. Seasonal trends if visible in the data
6. Current pricing vs market positioning

Return ONLY valid JSON:
{
  "peakAnalysis": {
    "busiestDays": ["Monday", "Saturday"],
    "busiestHours": ["10:00-12:00", "16:00-18:00"],
    "quietestDays": ["Wednesday"],
    "quietestHours": ["14:00-16:00"],
    "averageUtilization": 72,
    "peakUtilization": 95
  },
  "pricingSuggestions": [
    {
      "type": "OFF_PEAK_DISCOUNT",
      "description": "Offer 15% discount on Wednesday afternoon appointments",
      "dayOrTime": "Wednesday 14:00-16:00",
      "discountPercent": 15,
      "rationale": "Only 40% utilization — discounts can fill empty slots",
      "estimatedRevenueImpact": "+12000/month",
      "priority": "HIGH"
    },
    {
      "type": "PREMIUM_SLOT",
      "description": "Premium pricing for Saturday morning slots",
      "dayOrTime": "Saturday 09:00-12:00",
      "premiumPercent": 10,
      "rationale": "95% booked 2 weeks in advance — demand exceeds supply",
      "estimatedRevenueImpact": "+8000/month",
      "priority": "MEDIUM"
    }
  ],
  "procedureDemand": [
    {
      "procedure": "Teeth Cleaning",
      "bookingRate": 85,
      "avgWaitDays": 3,
      "suggestion": "No change — healthy demand and wait times"
    }
  ],
  "doctorUtilization": [
    {
      "doctorName": "Dr. X",
      "utilization": 92,
      "suggestion": "Consider shifting some patients to less busy doctors"
    }
  ],
  "summary": {
    "overallDemand": "HIGH",
    "revenueOpportunity": 25000,
    "topRecommendation": "Introduce off-peak discounts on Wednesday and Thursday afternoons to improve utilization from 40% to 70%"
  }
}

RULES:
- All suggestions are ADVISORY only — never auto-apply pricing changes
- Discounts should be between 5-25% to remain profitable
- Premium pricing should be max 15-20% above base
- Consider patient satisfaction — avoid pricing that feels exploitative
- Always include rationale and estimated revenue impact
- Flag any procedures where current pricing seems below market rate`,
}
