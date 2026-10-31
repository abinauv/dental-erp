/**
 * US medication catalogue. Same clinical set as IN but with US generic naming
 * (Acetaminophen rather than Paracetamol, Naproxen rather than Diclofenac) and
 * US-common strengths. Selected when the clinic country is US.
 */
export const medications = [
  {
    name: 'Amoxicillin 500mg',
    genericName: 'Amoxicillin',
    category: 'Antibiotic',
    form: 'Capsule',
    defaultDosage: '500mg',
    defaultFrequency: 'Three times daily',
    defaultDuration: '7 days',
  },
  {
    name: 'Ibuprofen 400mg',
    genericName: 'Ibuprofen',
    category: 'Pain Relief',
    form: 'Tablet',
    defaultDosage: '400mg',
    defaultFrequency: 'Every 6 hours as needed',
    defaultDuration: '3 days',
  },
  {
    name: 'Acetaminophen 500mg',
    genericName: 'Acetaminophen',
    category: 'Pain Relief',
    form: 'Tablet',
    defaultDosage: '500mg',
    defaultFrequency: 'As needed (max 3g/day)',
    defaultDuration: '3 days',
  },
  {
    name: 'Metronidazole 500mg',
    genericName: 'Metronidazole',
    category: 'Antibiotic',
    form: 'Tablet',
    defaultDosage: '500mg',
    defaultFrequency: 'Three times daily',
    defaultDuration: '7 days',
  },
  {
    name: 'Chlorhexidine Gluconate Rinse',
    genericName: 'Chlorhexidine',
    category: 'Antiseptic',
    form: 'Liquid',
    defaultDosage: '15ml',
    defaultFrequency: 'Twice daily',
    defaultDuration: '7 days',
  },
  {
    name: 'Clindamycin 300mg',
    genericName: 'Clindamycin',
    category: 'Antibiotic',
    form: 'Capsule',
    defaultDosage: '300mg',
    defaultFrequency: 'Four times daily',
    defaultDuration: '7 days',
  },
  {
    name: 'Omeprazole 20mg',
    genericName: 'Omeprazole',
    category: 'Antacid',
    form: 'Capsule',
    defaultDosage: '20mg',
    defaultFrequency: 'Once daily (before breakfast)',
    defaultDuration: '5 days',
  },
  {
    name: 'Naproxen 500mg',
    genericName: 'Naproxen',
    category: 'Pain Relief',
    form: 'Tablet',
    defaultDosage: '500mg',
    defaultFrequency: 'Twice daily',
    defaultDuration: '5 days',
  },
]
