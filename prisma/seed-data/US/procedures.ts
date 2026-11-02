import { ProcedureCategory } from '@prisma/client'

/**
 * US dental procedure catalogue — representative ADA CDT-coded set with USD base
 * prices. Selected when the clinic country is US. Not exhaustive; covers each
 * ProcedureCategory so a US clinic seeds a usable catalogue.
 */
export const procedures = [
  // DIAGNOSTIC
  {
    code: 'D0120',
    name: 'Periodic Oral Evaluation',
    category: ProcedureCategory.DIAGNOSTIC,
    basePrice: 65,
    duration: 15,
    description: 'Periodic oral evaluation of an established patient',
  },
  {
    code: 'D0150',
    name: 'Comprehensive Oral Evaluation',
    category: ProcedureCategory.DIAGNOSTIC,
    basePrice: 110,
    duration: 30,
    description: 'Comprehensive oral evaluation of a new or established patient',
  },
  {
    code: 'D0210',
    name: 'Intraoral Complete Series (X-rays)',
    category: ProcedureCategory.DIAGNOSTIC,
    basePrice: 140,
    duration: 20,
    description: 'Complete intraoral radiographic series',
  },
  {
    code: 'D0330',
    name: 'Panoramic Radiograph',
    category: ProcedureCategory.DIAGNOSTIC,
    basePrice: 130,
    duration: 10,
    description: 'Panoramic radiographic image',
  },
  {
    code: 'D0274',
    name: 'Bitewings — Four Films',
    category: ProcedureCategory.DIAGNOSTIC,
    basePrice: 75,
    duration: 10,
    description: 'Four bitewing radiographs',
  },

  // PREVENTIVE
  {
    code: 'D1110',
    name: 'Prophylaxis — Adult (Cleaning)',
    category: ProcedureCategory.PREVENTIVE,
    basePrice: 110,
    duration: 45,
    description: 'Removal of plaque, calculus and stains — adult',
    postInstructions: 'Maintain regular brushing and flossing.',
  },
  {
    code: 'D1206',
    name: 'Topical Fluoride Varnish',
    category: ProcedureCategory.PREVENTIVE,
    basePrice: 45,
    duration: 15,
    description: 'Topical application of fluoride varnish',
  },
  {
    code: 'D1351',
    name: 'Sealant — Per Tooth',
    category: ProcedureCategory.PREVENTIVE,
    basePrice: 60,
    duration: 20,
    description: 'Mechanically and/or chemically prepared enamel sealant',
  },

  // RESTORATIVE
  {
    code: 'D2140',
    name: 'Amalgam — One Surface',
    category: ProcedureCategory.RESTORATIVE,
    basePrice: 150,
    duration: 30,
    description: 'Amalgam restoration, one surface, primary or permanent',
  },
  {
    code: 'D2391',
    name: 'Resin Composite — One Surface, Posterior',
    category: ProcedureCategory.RESTORATIVE,
    basePrice: 190,
    duration: 40,
    description: 'Resin-based composite, one surface, posterior',
  },
  {
    code: 'D2740',
    name: 'Crown — Porcelain/Ceramic',
    category: ProcedureCategory.RESTORATIVE,
    basePrice: 1200,
    duration: 90,
    description: 'Crown, porcelain/ceramic',
  },

  // ENDODONTIC
  {
    code: 'D3310',
    name: 'Root Canal — Anterior',
    category: ProcedureCategory.ENDODONTIC,
    basePrice: 800,
    duration: 60,
    description: 'Endodontic therapy, anterior tooth (excluding final restoration)',
  },
  {
    code: 'D3330',
    name: 'Root Canal — Molar',
    category: ProcedureCategory.ENDODONTIC,
    basePrice: 1200,
    duration: 90,
    description: 'Endodontic therapy, molar tooth (excluding final restoration)',
  },
  {
    code: 'D3220',
    name: 'Therapeutic Pulpotomy',
    category: ProcedureCategory.ENDODONTIC,
    basePrice: 200,
    duration: 45,
    description: 'Therapeutic pulpotomy (excluding final restoration)',
  },

  // PERIODONTIC
  {
    code: 'D4341',
    name: 'Scaling and Root Planing — Per Quadrant',
    category: ProcedureCategory.PERIODONTIC,
    basePrice: 280,
    duration: 60,
    description: 'Periodontal scaling and root planing, four or more teeth per quadrant',
  },
  {
    code: 'D4210',
    name: 'Gingivectomy — Per Quadrant',
    category: ProcedureCategory.PERIODONTIC,
    basePrice: 450,
    duration: 60,
    description: 'Gingivectomy or gingivoplasty, four or more teeth per quadrant',
  },
  {
    code: 'D4263',
    name: 'Bone Replacement Graft — First Site',
    category: ProcedureCategory.PERIODONTIC,
    basePrice: 600,
    duration: 75,
    description: 'Bone replacement graft, first site in quadrant',
  },

  // PROSTHODONTIC
  {
    code: 'D5110',
    name: 'Complete Denture — Maxillary',
    category: ProcedureCategory.PROSTHODONTIC,
    basePrice: 1800,
    duration: 90,
    description: 'Complete denture, maxillary',
  },
  {
    code: 'D6010',
    name: 'Endosteal Implant Placement',
    category: ProcedureCategory.PROSTHODONTIC,
    basePrice: 2200,
    duration: 120,
    description: 'Surgical placement of implant body, endosteal implant',
  },
  {
    code: 'D6240',
    name: 'Pontic — Porcelain Fused to Metal',
    category: ProcedureCategory.PROSTHODONTIC,
    basePrice: 1100,
    duration: 90,
    description: 'Pontic, porcelain fused to high-noble metal',
  },

  // ORTHODONTIC
  {
    code: 'D8080',
    name: 'Comprehensive Orthodontic Treatment — Adolescent',
    category: ProcedureCategory.ORTHODONTIC,
    basePrice: 5500,
    duration: 60,
    description: 'Comprehensive orthodontic treatment of the adolescent dentition',
  },

  // ORAL_SURGERY
  {
    code: 'D7140',
    name: 'Extraction — Erupted Tooth',
    category: ProcedureCategory.ORAL_SURGERY,
    basePrice: 200,
    duration: 30,
    description: 'Extraction, erupted tooth or exposed root',
  },
  {
    code: 'D7210',
    name: 'Surgical Extraction — Erupted Tooth',
    category: ProcedureCategory.ORAL_SURGERY,
    basePrice: 350,
    duration: 45,
    description: 'Surgical removal of erupted tooth requiring elevation of flap',
  },
  {
    code: 'D7240',
    name: 'Removal of Impacted Tooth — Completely Bony',
    category: ProcedureCategory.ORAL_SURGERY,
    basePrice: 500,
    duration: 60,
    description: 'Removal of impacted tooth, completely bony',
  },

  // COSMETIC
  {
    code: 'D9972',
    name: 'External Bleaching — Per Arch',
    category: ProcedureCategory.COSMETIC,
    basePrice: 300,
    duration: 60,
    description: 'External bleaching, per arch, performed in office',
  },
  {
    code: 'D2962',
    name: 'Porcelain Veneer',
    category: ProcedureCategory.COSMETIC,
    basePrice: 1000,
    duration: 90,
    description: 'Labial veneer, porcelain, laboratory fabricated',
  },

  // EMERGENCY
  {
    code: 'D9110',
    name: 'Palliative Treatment of Dental Pain',
    category: ProcedureCategory.EMERGENCY,
    basePrice: 120,
    duration: 20,
    description: 'Palliative treatment of dental pain, minor procedure',
  },
  {
    code: 'D2940',
    name: 'Protective Restoration',
    category: ProcedureCategory.EMERGENCY,
    basePrice: 160,
    duration: 30,
    description: 'Protective restoration (sedative filling)',
  },
]
