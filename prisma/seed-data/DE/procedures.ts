import { ProcedureCategory } from '@prisma/client'

/**
 * Germany dental procedure catalogue — representative set with German names and
 * EUR base prices (indicative private-fee figures). Selected when the clinic
 * country is DE. Codes are internal (BEMA/GOZ mapping is a later refinement).
 */
export const procedures = [
  // DIAGNOSTIC
  {
    code: 'DE-DGN001',
    name: 'Beratung',
    category: ProcedureCategory.DIAGNOSTIC,
    basePrice: 30,
    duration: 15,
    description: 'Erstberatung und Untersuchung',
  },
  {
    code: 'DE-DGN002',
    name: 'Eingehende Untersuchung',
    category: ProcedureCategory.DIAGNOSTIC,
    basePrice: 45,
    duration: 30,
    description: 'Umfassende Untersuchung einschließlich Parodontalbefund',
  },
  {
    code: 'DE-DGN003',
    name: 'Einzelzahnröntgen',
    category: ProcedureCategory.DIAGNOSTIC,
    basePrice: 15,
    duration: 5,
    description: 'Intraorale Einzelaufnahme (Zahnfilm)',
  },
  {
    code: 'DE-DGN004',
    name: 'Panoramaaufnahme (OPG)',
    category: ProcedureCategory.DIAGNOSTIC,
    basePrice: 60,
    duration: 10,
    description: 'Panoramaschichtaufnahme des gesamten Gebisses',
  },

  // PREVENTIVE
  {
    code: 'DE-PRE001',
    name: 'Professionelle Zahnreinigung',
    category: ProcedureCategory.PREVENTIVE,
    basePrice: 90,
    duration: 45,
    description: 'Entfernung von Belägen, Zahnstein und Verfärbungen',
    postInstructions: 'Regelmäßige Mundhygiene beibehalten.',
  },
  {
    code: 'DE-PRE002',
    name: 'Fluoridierung',
    category: ProcedureCategory.PREVENTIVE,
    basePrice: 20,
    duration: 15,
    description: 'Lokale Fluoridapplikation',
  },
  {
    code: 'DE-PRE003',
    name: 'Fissurenversiegelung (pro Zahn)',
    category: ProcedureCategory.PREVENTIVE,
    basePrice: 35,
    duration: 20,
    description: 'Versiegelung der Kaufläche zur Kariesprophylaxe',
  },

  // RESTORATIVE
  {
    code: 'DE-RES001',
    name: 'Kompositfüllung (einflächig)',
    category: ProcedureCategory.RESTORATIVE,
    basePrice: 80,
    duration: 30,
    description: 'Zahnfarbene Kompositfüllung, eine Fläche',
  },
  {
    code: 'DE-RES002',
    name: 'Kompositfüllung (mehrflächig)',
    category: ProcedureCategory.RESTORATIVE,
    basePrice: 140,
    duration: 45,
    description: 'Zahnfarbene Kompositfüllung, mehrere Flächen',
  },
  {
    code: 'DE-RES003',
    name: 'Vollkeramikkrone',
    category: ProcedureCategory.RESTORATIVE,
    basePrice: 850,
    duration: 90,
    description: 'Krone aus Vollkeramik',
  },

  // ENDODONTIC
  {
    code: 'DE-END001',
    name: 'Wurzelkanalbehandlung (Frontzahn)',
    category: ProcedureCategory.ENDODONTIC,
    basePrice: 350,
    duration: 60,
    description: 'Endodontische Behandlung eines Frontzahns (ohne Füllung)',
  },
  {
    code: 'DE-END002',
    name: 'Wurzelkanalbehandlung (Molar)',
    category: ProcedureCategory.ENDODONTIC,
    basePrice: 650,
    duration: 90,
    description: 'Endodontische Behandlung eines Molaren (ohne Füllung)',
  },

  // PERIODONTIC
  {
    code: 'DE-PAR001',
    name: 'Scaling und Wurzelglättung (pro Quadrant)',
    category: ProcedureCategory.PERIODONTIC,
    basePrice: 120,
    duration: 60,
    description: 'Geschlossene Parodontalbehandlung je Quadrant',
  },
  {
    code: 'DE-PAR002',
    name: 'Gingivektomie (pro Quadrant)',
    category: ProcedureCategory.PERIODONTIC,
    basePrice: 200,
    duration: 60,
    description: 'Operative Entfernung von Zahnfleischgewebe je Quadrant',
  },

  // PROSTHODONTIC
  {
    code: 'DE-PRO001',
    name: 'Totalprothese (Oberkiefer)',
    category: ProcedureCategory.PROSTHODONTIC,
    basePrice: 950,
    duration: 90,
    description: 'Totalprothese für den Oberkiefer',
  },
  {
    code: 'DE-PRO002',
    name: 'Implantatinsertion',
    category: ProcedureCategory.PROSTHODONTIC,
    basePrice: 1800,
    duration: 120,
    description: 'Chirurgische Insertion eines enossalen Implantats',
  },

  // ORTHODONTIC
  {
    code: 'DE-KFO001',
    name: 'Kieferorthopädische Behandlung (Jugendliche)',
    category: ProcedureCategory.ORTHODONTIC,
    basePrice: 4500,
    duration: 60,
    description: 'Umfassende kieferorthopädische Behandlung im jugendlichen Gebiss',
  },

  // ORAL_SURGERY
  {
    code: 'DE-CHIR001',
    name: 'Zahnextraktion (einfach)',
    category: ProcedureCategory.ORAL_SURGERY,
    basePrice: 60,
    duration: 30,
    description: 'Entfernung eines durchgebrochenen Zahns',
  },
  {
    code: 'DE-CHIR002',
    name: 'Operative Entfernung (Weisheitszahn)',
    category: ProcedureCategory.ORAL_SURGERY,
    basePrice: 300,
    duration: 60,
    description: 'Operative Entfernung eines verlagerten Weisheitszahns',
  },

  // COSMETIC
  {
    code: 'DE-AES001',
    name: 'Zahnaufhellung (Bleaching, pro Kiefer)',
    category: ProcedureCategory.COSMETIC,
    basePrice: 250,
    duration: 60,
    description: 'Externes Bleaching je Kiefer',
  },
  {
    code: 'DE-AES002',
    name: 'Veneer (Keramik)',
    category: ProcedureCategory.COSMETIC,
    basePrice: 800,
    duration: 90,
    description: 'Keramikveneer, laborgefertigt',
  },

  // EMERGENCY
  {
    code: 'DE-NOT001',
    name: 'Schmerzbehandlung (Notfall)',
    category: ProcedureCategory.EMERGENCY,
    basePrice: 80,
    duration: 20,
    description: 'Palliative Schmerzbehandlung im Notfall',
  },
]
