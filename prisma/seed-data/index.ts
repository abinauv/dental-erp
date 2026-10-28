import { procedures as inProcedures } from './IN/procedures'
import { medications as inMedications } from './IN/medications'
import { procedures as usProcedures } from './US/procedures'
import { medications as usMedications } from './US/medications'

export interface CountrySeedData {
  procedures: typeof inProcedures
  medications: typeof inMedications
}

const SEED_DATA: Record<string, CountrySeedData> = {
  IN: { procedures: inProcedures, medications: inMedications },
  US: { procedures: usProcedures, medications: usMedications },
}

/**
 * Per-country starter catalogue (procedures + medications) for seeding a clinic.
 * Unknown countries fall back to India, matching the app's default country.
 */
export function getSeedData(country: string | null | undefined): CountrySeedData {
  const code = (country || 'IN').toUpperCase()
  return SEED_DATA[code] ?? SEED_DATA.IN
}
