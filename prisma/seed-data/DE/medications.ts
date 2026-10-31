/**
 * Germany medication catalogue. Generic naming and strengths as commonly
 * prescribed in Germany; dosage/frequency text in German for a de-DE clinic.
 * Selected when the clinic country is DE. The category/form values stay in the
 * app's English data vocabulary so filters and form maps keep working.
 */
export const medications = [
  {
    name: 'Amoxicillin 1000mg',
    genericName: 'Amoxicillin',
    category: 'Antibiotic',
    form: 'Tablet',
    defaultDosage: '1000mg',
    defaultFrequency: 'Dreimal täglich',
    defaultDuration: '5 Tage',
  },
  {
    name: 'Ibuprofen 600mg',
    genericName: 'Ibuprofen',
    category: 'Pain Relief',
    form: 'Tablet',
    defaultDosage: '600mg',
    defaultFrequency: 'Dreimal täglich',
    defaultDuration: '3 Tage',
  },
  {
    name: 'Paracetamol 500mg',
    genericName: 'Paracetamol',
    category: 'Pain Relief',
    form: 'Tablet',
    defaultDosage: '500mg',
    defaultFrequency: 'Bei Bedarf (max. 4/Tag)',
    defaultDuration: '3 Tage',
  },
  {
    name: 'Metronidazol 400mg',
    genericName: 'Metronidazol',
    category: 'Antibiotic',
    form: 'Tablet',
    defaultDosage: '400mg',
    defaultFrequency: 'Dreimal täglich',
    defaultDuration: '7 Tage',
  },
  {
    name: 'Chlorhexidin-Mundspülung 0,2%',
    genericName: 'Chlorhexidin',
    category: 'Antiseptic',
    form: 'Liquid',
    defaultDosage: '10ml',
    defaultFrequency: 'Zweimal täglich',
    defaultDuration: '7 Tage',
  },
  {
    name: 'Clindamycin 600mg',
    genericName: 'Clindamycin',
    category: 'Antibiotic',
    form: 'Tablet',
    defaultDosage: '600mg',
    defaultFrequency: 'Dreimal täglich',
    defaultDuration: '7 Tage',
  },
  {
    name: 'Pantoprazol 20mg',
    genericName: 'Pantoprazol',
    category: 'Antacid',
    form: 'Tablet',
    defaultDosage: '20mg',
    defaultFrequency: 'Einmal täglich (vor dem Frühstück)',
    defaultDuration: '5 Tage',
  },
  {
    name: 'Diclofenac 50mg',
    genericName: 'Diclofenac',
    category: 'Pain Relief',
    form: 'Tablet',
    defaultDosage: '50mg',
    defaultFrequency: 'Zweimal täglich',
    defaultDuration: '3 Tage',
  },
]
