import {
  PrismaClient,
  Role,
  Gender,
  BloodGroup,
  ProcedureCategory,
  Plan,
  InvoiceStatus,
  SupplierStatus,
  InventoryItemType,
  StockTransactionType,
  StockAlertType,
  LabVendorStatus,
  LabOrderStatus,
  LabOrderPriority,
  LabWorkType,
  AppointmentStatus,
  AppointmentType,
} from '@prisma/client'
import bcrypt from 'bcryptjs'

const prisma = new PrismaClient()

// Kept in sync with tests/e2e/public-payment.spec.ts.
const E2E_PAYMENT_TOKEN = 'e2e-payment-link-token'

async function main() {
  console.log('Starting database seed...')

  // Create default hospital
  const hospital = await prisma.hospital.upsert({
    where: { slug: 'demo-dental-clinic' },
    update: {},
    create: {
      name: 'Demo Dental Clinic',
      slug: 'demo-dental-clinic',
      email: 'info@demo-dental.com',
      phone: '044-12345678',
      plan: Plan.PROFESSIONAL,
      isActive: true,
      onboardingCompleted: true,
      address: '123, Anna Nagar Main Road, Ayanavaram',
      city: 'Chennai',
      state: 'Tamil Nadu',
      pincode: '600023',
      tagline: 'Your Smile, Our Priority',
      website: 'www.example.com',
      gstNumber: '33AAACX1234X1ZX',
      registrationNo: 'TN-MED-2020-12345',
      workingHours: JSON.stringify({
        monday: { open: '09:00', close: '20:00' },
        tuesday: { open: '09:00', close: '20:00' },
        wednesday: { open: '09:00', close: '20:00' },
        thursday: { open: '09:00', close: '20:00' },
        friday: { open: '09:00', close: '20:00' },
        saturday: { open: '09:00', close: '14:00' },
        sunday: { open: null, close: null },
      }),
      upiId: 'clinic@upi',
      patientLimit: -1, // Unlimited for PROFESSIONAL
      staffLimit: -1,
      storageLimitMb: -1,
    },
  })

  console.log('Created hospital:', hospital.name)

  // Create admin user
  const hashedPassword = await bcrypt.hash('Admin@123', 10)

  const admin = await prisma.user.upsert({
    where: { email: 'admin@demo-dental.com' },
    update: {},
    create: {
      email: 'admin@demo-dental.com',
      name: 'Admin User',
      password: hashedPassword,
      role: Role.ADMIN,
      phone: '9876543210',
      hospitalId: hospital.id,
      isHospitalAdmin: true,
      staff: {
        create: {
          employeeId: 'EMP001',
          firstName: 'Admin',
          lastName: 'User',
          phone: '9876543210',
          email: 'admin@demo-dental.com',
          specialization: 'General Dentistry',
          licenseNumber: 'MCI123456',
          city: 'Chennai',
          state: 'Tamil Nadu',
          hospitalId: hospital.id,
        },
      },
    },
  })

  console.log('Created admin user:', admin.email)

  // Create doctor user
  const doctorPassword = await bcrypt.hash('Doctor@123', 10)
  const doctor = await prisma.user.upsert({
    where: { email: 'doctor@demo-dental.com' },
    update: {},
    create: {
      email: 'doctor@demo-dental.com',
      name: 'Dr. Priya',
      password: doctorPassword,
      role: Role.DOCTOR,
      phone: '9876543211',
      hospitalId: hospital.id,
      isHospitalAdmin: false,
      staff: {
        create: {
          employeeId: 'EMP002',
          firstName: 'Dr. Priya',
          lastName: 'Kumar',
          phone: '9876543211',
          email: 'doctor@demo-dental.com',
          specialization: 'Orthodontics',
          licenseNumber: 'MCI789012',
          city: 'Chennai',
          state: 'Tamil Nadu',
          hospitalId: hospital.id,
        },
      },
    },
  })

  console.log('Created doctor user:', doctor.email)

  // Create receptionist user
  const receptionistPassword = await bcrypt.hash('Reception@123', 10)
  const receptionist = await prisma.user.upsert({
    where: { email: 'reception@demo-dental.com' },
    update: {},
    create: {
      email: 'reception@demo-dental.com',
      name: 'Lakshmi S',
      password: receptionistPassword,
      role: Role.RECEPTIONIST,
      phone: '9876543212',
      hospitalId: hospital.id,
      isHospitalAdmin: false,
      staff: {
        create: {
          employeeId: 'EMP003',
          firstName: 'Lakshmi',
          lastName: 'S',
          phone: '9876543212',
          email: 'reception@demo-dental.com',
          city: 'Chennai',
          state: 'Tamil Nadu',
          hospitalId: hospital.id,
        },
      },
    },
  })

  console.log('Created receptionist user:', receptionist.email)

  // Create sample patients
  const patients = [
    {
      firstName: 'Rahul',
      lastName: 'Sharma',
      phone: '9876543301',
      gender: Gender.MALE,
      age: 35,
      bloodGroup: BloodGroup.O_POSITIVE,
    },
    {
      firstName: 'Priya',
      lastName: 'Kumar',
      phone: '9876543302',
      gender: Gender.FEMALE,
      age: 28,
      bloodGroup: BloodGroup.A_POSITIVE,
    },
    {
      firstName: 'Amit',
      lastName: 'Patel',
      phone: '9876543303',
      gender: Gender.MALE,
      age: 42,
      bloodGroup: BloodGroup.B_POSITIVE,
    },
    {
      firstName: 'Sneha',
      lastName: 'Reddy',
      phone: '9876543304',
      gender: Gender.FEMALE,
      age: 31,
      bloodGroup: BloodGroup.AB_POSITIVE,
    },
    {
      firstName: 'Vijay',
      lastName: 'Krishnan',
      phone: '9876543305',
      gender: Gender.MALE,
      age: 55,
      bloodGroup: BloodGroup.O_NEGATIVE,
    },
    {
      firstName: 'Ananya',
      lastName: 'Iyer',
      phone: '9876543306',
      gender: Gender.FEMALE,
      age: 25,
      bloodGroup: BloodGroup.A_NEGATIVE,
    },
    {
      firstName: 'Karthik',
      lastName: 'Murugan',
      phone: '9876543307',
      gender: Gender.MALE,
      age: 38,
      bloodGroup: BloodGroup.B_NEGATIVE,
    },
    {
      firstName: 'Divya',
      lastName: 'Nair',
      phone: '9876543308',
      gender: Gender.FEMALE,
      age: 45,
      bloodGroup: BloodGroup.AB_NEGATIVE,
    },
    {
      firstName: 'Suresh',
      lastName: 'Babu',
      phone: '9876543309',
      gender: Gender.MALE,
      age: 62,
      bloodGroup: BloodGroup.O_POSITIVE,
    },
    {
      firstName: 'Meera',
      lastName: 'Pillai',
      phone: '9876543310',
      gender: Gender.FEMALE,
      age: 33,
      bloodGroup: BloodGroup.A_POSITIVE,
    },
  ]

  for (let i = 0; i < patients.length; i++) {
    const patient = patients[i]
    const patientId = `PAT2024${String(i + 1).padStart(4, '0')}`

    await prisma.patient.upsert({
      where: {
        hospitalId_patientId: {
          hospitalId: hospital.id,
          patientId,
        },
      },
      update: {},
      create: {
        patientId,
        firstName: patient.firstName,
        lastName: patient.lastName,
        phone: patient.phone,
        gender: patient.gender,
        age: patient.age,
        bloodGroup: patient.bloodGroup,
        city: 'Chennai',
        state: 'Tamil Nadu',
        address: `${123 + i}, Anna Nagar Main Road`,
        pincode: '600040',
        hospitalId: hospital.id,
        medicalHistory: {
          create: {
            hasAllergies: i % 3 === 0,
            hasDiabetes: i % 4 === 0,
            hasHypertension: i % 5 === 0,
            smokingStatus: i % 6 === 0 ? 'FORMER' : 'NEVER',
            alcoholConsumption: i % 4 === 0 ? 'OCCASIONAL' : 'NEVER',
          },
        },
      },
    })
  }

  console.log('Created 10 sample patients')

  // Create procedures - Comprehensive dental procedures catalog
  const procedures = [
    // DIAGNOSTIC
    {
      code: 'DGN001',
      name: 'Consultation',
      category: ProcedureCategory.DIAGNOSTIC,
      basePrice: 300,
      duration: 15,
      description: 'Initial dental consultation and examination',
      preInstructions: 'Bring previous dental records if available',
      postInstructions: 'Follow recommended treatment plan',
    },
    {
      code: 'DGN002',
      name: 'Comprehensive Oral Examination',
      category: ProcedureCategory.DIAGNOSTIC,
      basePrice: 500,
      duration: 30,
      description: 'Complete oral examination including periodontal assessment',
    },
    {
      code: 'DGN003',
      name: 'Single X-Ray (IOPA)',
      category: ProcedureCategory.DIAGNOSTIC,
      basePrice: 200,
      duration: 5,
      description: 'Intraoral periapical radiograph',
    },
    {
      code: 'DGN004',
      name: 'Panoramic X-Ray (OPG)',
      category: ProcedureCategory.DIAGNOSTIC,
      basePrice: 500,
      duration: 10,
      description: 'Full mouth panoramic radiograph',
    },
    {
      code: 'DGN005',
      name: 'Bitewing X-Rays',
      category: ProcedureCategory.DIAGNOSTIC,
      basePrice: 400,
      duration: 10,
      description: 'Bitewing radiographs for caries detection',
    },
    {
      code: 'DGN006',
      name: 'CBCT Scan',
      category: ProcedureCategory.DIAGNOSTIC,
      basePrice: 3000,
      duration: 20,
      description: 'Cone beam computed tomography for 3D imaging',
    },

    // PREVENTIVE
    {
      code: 'PRV001',
      name: 'Dental Cleaning (Scaling)',
      category: ProcedureCategory.PREVENTIVE,
      basePrice: 1500,
      duration: 30,
      description: 'Professional teeth cleaning and scaling',
      postInstructions:
        'Avoid eating or drinking for 30 minutes. Sensitivity may occur for 24-48 hours.',
    },
    {
      code: 'PRV002',
      name: 'Deep Cleaning (Scaling & Root Planing)',
      category: ProcedureCategory.PREVENTIVE,
      basePrice: 3000,
      duration: 60,
      description: 'Deep cleaning below gum line',
      preInstructions: 'Local anesthesia may be required',
      postInstructions: 'Take prescribed medications. Avoid hard foods for 24 hours.',
    },
    {
      code: 'PRV003',
      name: 'Fluoride Treatment',
      category: ProcedureCategory.PREVENTIVE,
      basePrice: 500,
      duration: 15,
      description: 'Topical fluoride application for cavity prevention',
      postInstructions: 'Do not eat or drink for 30 minutes after treatment',
    },
    {
      code: 'PRV004',
      name: 'Pit and Fissure Sealant',
      category: ProcedureCategory.PREVENTIVE,
      basePrice: 800,
      duration: 20,
      description: 'Protective sealant application on tooth surfaces',
    },
    {
      code: 'PRV005',
      name: 'Sports Mouthguard',
      category: ProcedureCategory.PREVENTIVE,
      basePrice: 2500,
      duration: 30,
      description: 'Custom-made protective mouthguard for sports',
    },

    // RESTORATIVE
    {
      code: 'RST001',
      name: 'Composite Filling (Anterior)',
      category: ProcedureCategory.RESTORATIVE,
      basePrice: 1500,
      duration: 30,
      description: 'Tooth-colored filling for front teeth',
      postInstructions: 'Avoid eating on the treated side for 2 hours',
    },
    {
      code: 'RST002',
      name: 'Composite Filling (Posterior)',
      category: ProcedureCategory.RESTORATIVE,
      basePrice: 2000,
      duration: 45,
      description: 'Tooth-colored filling for back teeth',
      postInstructions: 'Avoid eating on the treated side for 2 hours',
    },
    {
      code: 'RST003',
      name: 'Amalgam Filling',
      category: ProcedureCategory.RESTORATIVE,
      basePrice: 1000,
      duration: 30,
      description: 'Silver amalgam filling',
    },
    {
      code: 'RST004',
      name: 'Glass Ionomer Filling',
      category: ProcedureCategory.RESTORATIVE,
      basePrice: 1200,
      duration: 30,
      description: 'Fluoride-releasing filling material',
    },
    {
      code: 'RST005',
      name: 'Core Build-up',
      category: ProcedureCategory.RESTORATIVE,
      basePrice: 2000,
      duration: 30,
      description: 'Foundation for crown placement',
    },
    {
      code: 'RST006',
      name: 'Inlay (Ceramic)',
      category: ProcedureCategory.RESTORATIVE,
      basePrice: 8000,
      duration: 60,
      description: 'Custom ceramic restoration',
    },
    {
      code: 'RST007',
      name: 'Onlay (Ceramic)',
      category: ProcedureCategory.RESTORATIVE,
      basePrice: 10000,
      duration: 60,
      description: 'Custom ceramic restoration covering cusps',
    },

    // ENDODONTIC
    {
      code: 'END001',
      name: 'Root Canal Treatment (Anterior)',
      category: ProcedureCategory.ENDODONTIC,
      basePrice: 5000,
      duration: 45,
      description: 'Root canal treatment for front teeth',
      preInstructions: 'Take prescribed antibiotics if any infection',
      postInstructions: 'Crown recommended within 2-4 weeks',
    },
    {
      code: 'END002',
      name: 'Root Canal Treatment (Premolar)',
      category: ProcedureCategory.ENDODONTIC,
      basePrice: 7000,
      duration: 60,
      description: 'Root canal treatment for premolar teeth',
    },
    {
      code: 'END003',
      name: 'Root Canal Treatment (Molar)',
      category: ProcedureCategory.ENDODONTIC,
      basePrice: 10000,
      duration: 90,
      description: 'Root canal treatment for molar teeth',
    },
    {
      code: 'END004',
      name: 'Re-Root Canal Treatment',
      category: ProcedureCategory.ENDODONTIC,
      basePrice: 12000,
      duration: 90,
      description: 'Retreatment of failed root canal',
    },
    {
      code: 'END005',
      name: 'Pulp Capping',
      category: ProcedureCategory.ENDODONTIC,
      basePrice: 1500,
      duration: 30,
      description: 'Treatment to preserve tooth vitality',
    },
    {
      code: 'END006',
      name: 'Pulpotomy',
      category: ProcedureCategory.ENDODONTIC,
      basePrice: 2000,
      duration: 30,
      description: 'Partial pulp removal',
    },
    {
      code: 'END007',
      name: 'Apicoectomy',
      category: ProcedureCategory.ENDODONTIC,
      basePrice: 8000,
      duration: 60,
      description: 'Surgical root end resection',
    },

    // PERIODONTIC
    {
      code: 'PER001',
      name: 'Periodontal Scaling',
      category: ProcedureCategory.PERIODONTIC,
      basePrice: 3000,
      duration: 45,
      description: 'Scaling for periodontal disease',
    },
    {
      code: 'PER002',
      name: 'Curettage',
      category: ProcedureCategory.PERIODONTIC,
      basePrice: 2000,
      duration: 30,
      description: 'Gum tissue cleaning',
    },
    {
      code: 'PER003',
      name: 'Flap Surgery',
      category: ProcedureCategory.PERIODONTIC,
      basePrice: 8000,
      duration: 90,
      description: 'Surgical treatment for advanced gum disease',
    },
    {
      code: 'PER004',
      name: 'Bone Grafting',
      category: ProcedureCategory.PERIODONTIC,
      basePrice: 15000,
      duration: 60,
      description: 'Bone augmentation procedure',
    },
    {
      code: 'PER005',
      name: 'Gum Grafting',
      category: ProcedureCategory.PERIODONTIC,
      basePrice: 10000,
      duration: 60,
      description: 'Soft tissue grafting for gum recession',
    },
    {
      code: 'PER006',
      name: 'Crown Lengthening',
      category: ProcedureCategory.PERIODONTIC,
      basePrice: 6000,
      duration: 45,
      description: 'Exposure of more tooth structure',
    },
    {
      code: 'PER007',
      name: 'Gingivectomy',
      category: ProcedureCategory.PERIODONTIC,
      basePrice: 4000,
      duration: 30,
      description: 'Surgical removal of gum tissue',
    },

    // PROSTHODONTIC
    {
      code: 'PRS001',
      name: 'Metal Crown',
      category: ProcedureCategory.PROSTHODONTIC,
      basePrice: 5000,
      duration: 45,
      description: 'Full metal crown',
      postInstructions: 'Avoid sticky foods. Maintain good oral hygiene.',
    },
    {
      code: 'PRS002',
      name: 'PFM Crown',
      category: ProcedureCategory.PROSTHODONTIC,
      basePrice: 8000,
      duration: 45,
      description: 'Porcelain fused to metal crown',
    },
    {
      code: 'PRS003',
      name: 'Ceramic Crown',
      category: ProcedureCategory.PROSTHODONTIC,
      basePrice: 12000,
      duration: 45,
      description: 'All-ceramic crown',
    },
    {
      code: 'PRS004',
      name: 'Zirconia Crown',
      category: ProcedureCategory.PROSTHODONTIC,
      basePrice: 15000,
      duration: 45,
      description: 'Zirconia crown for optimal strength and aesthetics',
    },
    {
      code: 'PRS005',
      name: 'Dental Bridge (per unit)',
      category: ProcedureCategory.PROSTHODONTIC,
      basePrice: 10000,
      duration: 60,
      description: 'Fixed dental bridge per tooth unit',
    },
    {
      code: 'PRS006',
      name: 'Complete Denture (Upper)',
      category: ProcedureCategory.PROSTHODONTIC,
      basePrice: 15000,
      duration: 60,
      description: 'Full upper denture',
    },
    {
      code: 'PRS007',
      name: 'Complete Denture (Lower)',
      category: ProcedureCategory.PROSTHODONTIC,
      basePrice: 15000,
      duration: 60,
      description: 'Full lower denture',
    },
    {
      code: 'PRS008',
      name: 'Partial Denture (Acrylic)',
      category: ProcedureCategory.PROSTHODONTIC,
      basePrice: 8000,
      duration: 45,
      description: 'Removable partial denture',
    },
    {
      code: 'PRS009',
      name: 'Partial Denture (Cast Metal)',
      category: ProcedureCategory.PROSTHODONTIC,
      basePrice: 20000,
      duration: 60,
      description: 'Cast metal framework partial denture',
    },
    {
      code: 'PRS010',
      name: 'Flexible Denture',
      category: ProcedureCategory.PROSTHODONTIC,
      basePrice: 15000,
      duration: 45,
      description: 'Flexible partial denture',
    },
    {
      code: 'PRS011',
      name: 'Dental Implant',
      category: ProcedureCategory.PROSTHODONTIC,
      basePrice: 35000,
      duration: 90,
      description: 'Titanium dental implant placement',
      preInstructions: 'Complete medical evaluation required. Stop blood thinners as advised.',
      postInstructions: 'Follow post-surgical care instructions. Soft diet for 1 week.',
    },
    {
      code: 'PRS012',
      name: 'Implant Crown',
      category: ProcedureCategory.PROSTHODONTIC,
      basePrice: 20000,
      duration: 45,
      description: 'Crown on dental implant',
    },
    {
      code: 'PRS013',
      name: 'Implant Abutment',
      category: ProcedureCategory.PROSTHODONTIC,
      basePrice: 8000,
      duration: 30,
      description: 'Implant abutment connection',
    },

    // ORTHODONTIC
    {
      code: 'ORT001',
      name: 'Orthodontic Consultation',
      category: ProcedureCategory.ORTHODONTIC,
      basePrice: 500,
      duration: 30,
      description: 'Initial orthodontic evaluation',
    },
    {
      code: 'ORT002',
      name: 'Metal Braces (Full)',
      category: ProcedureCategory.ORTHODONTIC,
      basePrice: 45000,
      duration: 60,
      description: 'Conventional metal braces treatment',
    },
    {
      code: 'ORT003',
      name: 'Ceramic Braces (Full)',
      category: ProcedureCategory.ORTHODONTIC,
      basePrice: 60000,
      duration: 60,
      description: 'Tooth-colored ceramic braces',
    },
    {
      code: 'ORT004',
      name: 'Lingual Braces',
      category: ProcedureCategory.ORTHODONTIC,
      basePrice: 120000,
      duration: 90,
      description: 'Braces placed on inner tooth surface',
    },
    {
      code: 'ORT005',
      name: 'Clear Aligners',
      category: ProcedureCategory.ORTHODONTIC,
      basePrice: 150000,
      duration: 60,
      description: 'Invisible clear aligner treatment',
    },
    {
      code: 'ORT006',
      name: 'Orthodontic Adjustment',
      category: ProcedureCategory.ORTHODONTIC,
      basePrice: 1000,
      duration: 20,
      description: 'Regular braces adjustment visit',
    },
    {
      code: 'ORT007',
      name: 'Retainer (Removable)',
      category: ProcedureCategory.ORTHODONTIC,
      basePrice: 5000,
      duration: 30,
      description: 'Post-treatment removable retainer',
    },
    {
      code: 'ORT008',
      name: 'Retainer (Fixed)',
      category: ProcedureCategory.ORTHODONTIC,
      basePrice: 4000,
      duration: 30,
      description: 'Bonded lingual retainer',
    },
    {
      code: 'ORT009',
      name: 'Space Maintainer',
      category: ProcedureCategory.ORTHODONTIC,
      basePrice: 3000,
      duration: 30,
      description: 'Appliance to maintain space for permanent teeth',
    },

    // ORAL SURGERY
    {
      code: 'SRG001',
      name: 'Simple Extraction',
      category: ProcedureCategory.ORAL_SURGERY,
      basePrice: 1000,
      duration: 30,
      description: 'Non-surgical tooth extraction',
      postInstructions: 'Bite on gauze for 30 min. Avoid spitting. Soft diet for 24 hours.',
    },
    {
      code: 'SRG002',
      name: 'Surgical Extraction',
      category: ProcedureCategory.ORAL_SURGERY,
      basePrice: 3000,
      duration: 45,
      description: 'Surgical tooth removal',
    },
    {
      code: 'SRG003',
      name: 'Wisdom Tooth Extraction (Simple)',
      category: ProcedureCategory.ORAL_SURGERY,
      basePrice: 3000,
      duration: 45,
      description: 'Simple wisdom tooth removal',
    },
    {
      code: 'SRG004',
      name: 'Wisdom Tooth Extraction (Impacted)',
      category: ProcedureCategory.ORAL_SURGERY,
      basePrice: 8000,
      duration: 60,
      description: 'Surgical removal of impacted wisdom tooth',
    },
    {
      code: 'SRG005',
      name: 'Incision and Drainage',
      category: ProcedureCategory.ORAL_SURGERY,
      basePrice: 2000,
      duration: 30,
      description: 'Drainage of dental abscess',
    },
    {
      code: 'SRG006',
      name: 'Frenectomy',
      category: ProcedureCategory.ORAL_SURGERY,
      basePrice: 5000,
      duration: 30,
      description: 'Removal of frenum tissue',
    },
    {
      code: 'SRG007',
      name: 'Biopsy',
      category: ProcedureCategory.ORAL_SURGERY,
      basePrice: 3000,
      duration: 30,
      description: 'Tissue biopsy for pathological examination',
    },
    {
      code: 'SRG008',
      name: 'Cyst Removal',
      category: ProcedureCategory.ORAL_SURGERY,
      basePrice: 10000,
      duration: 60,
      description: 'Surgical removal of oral cyst',
    },

    // COSMETIC
    {
      code: 'COS001',
      name: 'Teeth Whitening (In-Office)',
      category: ProcedureCategory.COSMETIC,
      basePrice: 8000,
      duration: 60,
      description: 'Professional teeth whitening treatment',
      postInstructions: 'Avoid colored foods/drinks for 48 hours. Some sensitivity is normal.',
    },
    {
      code: 'COS002',
      name: 'Teeth Whitening (Take-Home)',
      category: ProcedureCategory.COSMETIC,
      basePrice: 5000,
      duration: 30,
      description: 'Custom take-home whitening kit',
    },
    {
      code: 'COS003',
      name: 'Porcelain Veneer',
      category: ProcedureCategory.COSMETIC,
      basePrice: 15000,
      duration: 45,
      description: 'Ceramic veneer for smile enhancement',
    },
    {
      code: 'COS004',
      name: 'Composite Veneer',
      category: ProcedureCategory.COSMETIC,
      basePrice: 5000,
      duration: 30,
      description: 'Direct composite veneer',
    },
    {
      code: 'COS005',
      name: 'Tooth Reshaping',
      category: ProcedureCategory.COSMETIC,
      basePrice: 1500,
      duration: 20,
      description: 'Enamel contouring for improved appearance',
    },
    {
      code: 'COS006',
      name: 'Dental Bonding',
      category: ProcedureCategory.COSMETIC,
      basePrice: 3000,
      duration: 30,
      description: 'Cosmetic bonding for minor repairs',
    },
    {
      code: 'COS007',
      name: 'Smile Makeover Consultation',
      category: ProcedureCategory.COSMETIC,
      basePrice: 1000,
      duration: 45,
      description: 'Comprehensive smile design consultation',
    },
    {
      code: 'COS008',
      name: 'Gum Contouring',
      category: ProcedureCategory.COSMETIC,
      basePrice: 6000,
      duration: 45,
      description: 'Gum reshaping for aesthetic improvement',
    },

    // EMERGENCY
    {
      code: 'EMR001',
      name: 'Emergency Consultation',
      category: ProcedureCategory.EMERGENCY,
      basePrice: 500,
      duration: 30,
      description: 'Urgent dental consultation',
    },
    {
      code: 'EMR002',
      name: 'Pain Relief Treatment',
      category: ProcedureCategory.EMERGENCY,
      basePrice: 1000,
      duration: 30,
      description: 'Emergency pain management',
    },
    {
      code: 'EMR003',
      name: 'Temporary Filling',
      category: ProcedureCategory.EMERGENCY,
      basePrice: 500,
      duration: 20,
      description: 'Temporary restoration',
    },
    {
      code: 'EMR004',
      name: 'Re-cementation of Crown',
      category: ProcedureCategory.EMERGENCY,
      basePrice: 500,
      duration: 15,
      description: 'Re-attachment of loose crown',
    },
    {
      code: 'EMR005',
      name: 'Tooth Reimplantation',
      category: ProcedureCategory.EMERGENCY,
      basePrice: 3000,
      duration: 45,
      description: 'Reimplantation of avulsed tooth',
    },
    {
      code: 'EMR006',
      name: 'Broken Tooth Repair',
      category: ProcedureCategory.EMERGENCY,
      basePrice: 2000,
      duration: 30,
      description: 'Emergency repair of fractured tooth',
    },
  ]

  for (const proc of procedures) {
    await prisma.procedure.upsert({
      where: {
        hospitalId_code: {
          hospitalId: hospital.id,
          code: proc.code,
        },
      },
      update: {},
      create: {
        code: proc.code,
        name: proc.name,
        category: proc.category,
        basePrice: proc.basePrice,
        defaultDuration: proc.duration,
        description: proc.description || `Standard ${proc.name.toLowerCase()} procedure`,
        preInstructions: proc.preInstructions || null,
        postInstructions: proc.postInstructions || null,
        hospitalId: hospital.id,
      },
    })
  }

  console.log('Created dental procedures catalog')

  // Create medications
  const medications = [
    {
      name: 'Amoxicillin 500mg',
      genericName: 'Amoxicillin',
      category: 'Antibiotic',
      form: 'Capsule',
      defaultDosage: '500mg',
      defaultFrequency: 'Three times daily',
      defaultDuration: '5 days',
    },
    {
      name: 'Ibuprofen 400mg',
      genericName: 'Ibuprofen',
      category: 'Pain Relief',
      form: 'Tablet',
      defaultDosage: '400mg',
      defaultFrequency: 'Three times daily',
      defaultDuration: '3 days',
    },
    {
      name: 'Paracetamol 500mg',
      genericName: 'Paracetamol',
      category: 'Pain Relief',
      form: 'Tablet',
      defaultDosage: '500mg',
      defaultFrequency: 'As needed (max 4/day)',
      defaultDuration: '3 days',
    },
    {
      name: 'Metronidazole 400mg',
      genericName: 'Metronidazole',
      category: 'Antibiotic',
      form: 'Tablet',
      defaultDosage: '400mg',
      defaultFrequency: 'Three times daily',
      defaultDuration: '5 days',
    },
    {
      name: 'Chlorhexidine Mouthwash',
      genericName: 'Chlorhexidine',
      category: 'Antiseptic',
      form: 'Liquid',
      defaultDosage: '10ml',
      defaultFrequency: 'Twice daily',
      defaultDuration: '7 days',
    },
    {
      name: 'Diclofenac 50mg',
      genericName: 'Diclofenac',
      category: 'Pain Relief',
      form: 'Tablet',
      defaultDosage: '50mg',
      defaultFrequency: 'Twice daily',
      defaultDuration: '3 days',
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
      name: 'Clindamycin 300mg',
      genericName: 'Clindamycin',
      category: 'Antibiotic',
      form: 'Capsule',
      defaultDosage: '300mg',
      defaultFrequency: 'Three times daily',
      defaultDuration: '7 days',
    },
  ]

  for (const med of medications) {
    const existing = await prisma.medication.findFirst({
      where: { hospitalId: hospital.id, name: med.name },
    })
    if (!existing) {
      await prisma.medication.create({
        data: {
          name: med.name,
          genericName: med.genericName,
          category: med.category,
          form: med.form,
          defaultDosage: med.defaultDosage,
          defaultFrequency: med.defaultFrequency,
          defaultDuration: med.defaultDuration,
          hospitalId: hospital.id,
        },
      })
    }
  }

  console.log('Created medications database')

  // Create inventory categories
  const categories = [
    { name: 'Dental Materials', description: 'Composites, cements, and filling materials' },
    { name: 'Instruments', description: 'Dental instruments and tools' },
    { name: 'Consumables', description: 'Disposable items and consumables' },
    { name: 'Medicines', description: 'Medications and pharmaceuticals' },
    { name: 'Equipment', description: 'Dental equipment and machines' },
  ]

  for (const cat of categories) {
    await prisma.inventoryCategory.upsert({
      where: {
        hospitalId_name: {
          hospitalId: hospital.id,
          name: cat.name,
        },
      },
      update: {},
      create: {
        name: cat.name,
        description: cat.description,
        hospitalId: hospital.id,
      },
    })
  }

  console.log('Created inventory categories')

  // ── Inventory: suppliers, items, batches, movements, alerts ───────────────
  //
  // The inventory and lab pages used to be seeded with nothing, so their e2e
  // specs could only ever assert an empty state. Everything below exists so
  // those specs can assert real rows: a low-stock item, an out-of-stock item,
  // a batch near expiry, stock movements, and an open alert.

  const materialsCategory = await prisma.inventoryCategory.findFirst({
    where: { hospitalId: hospital.id, name: 'Dental Materials' },
  })

  const suppliers = [
    {
      code: 'SUP001',
      name: 'Chennai Dental Depot',
      contactPerson: 'Ravi Menon',
      phone: '9840012345',
      email: 'sales@chennaidental.example',
      status: SupplierStatus.ACTIVE,
    },
    {
      code: 'SUP002',
      name: 'Southern Ortho Supplies',
      contactPerson: 'Latha Rao',
      phone: '9840067890',
      email: 'orders@southernortho.example',
      status: SupplierStatus.ACTIVE,
    },
    {
      code: 'SUP003',
      name: 'Legacy Instruments Co',
      contactPerson: 'Mohan Das',
      phone: '9840055555',
      status: SupplierStatus.BLOCKED,
    },
  ]

  for (const s of suppliers) {
    await prisma.supplier.upsert({
      where: { hospitalId_code: { hospitalId: hospital.id, code: s.code } },
      update: {},
      create: {
        hospitalId: hospital.id,
        city: 'Chennai',
        state: 'Tamil Nadu',
        paymentTerms: 'Net 30',
        creditLimit: 100000,
        ...s,
      },
    })
  }

  const primarySupplier = await prisma.supplier.findUnique({
    where: { hospitalId_code: { hospitalId: hospital.id, code: 'SUP001' } },
  })

  // currentStock is deliberately varied so the stock-status badges, the low
  // stock report and the alerts list all have something to show.
  const items = [
    {
      sku: 'ITM001',
      name: 'Composite Resin A2',
      itemType: InventoryItemType.DENTAL_MATERIAL,
      unit: 'syringe',
      currentStock: 40,
      minimumStock: 10,
      reorderLevel: 20,
      purchasePrice: 450,
      sellingPrice: 900,
      batchTracking: true,
      expiryTracking: true,
    },
    {
      sku: 'ITM002',
      name: 'Disposable Gloves (M)',
      itemType: InventoryItemType.CONSUMABLE,
      unit: 'box',
      currentStock: 6,
      minimumStock: 10,
      reorderLevel: 25,
      purchasePrice: 320,
      sellingPrice: 0,
    },
    {
      sku: 'ITM003',
      name: 'Lignocaine 2% Cartridge',
      itemType: InventoryItemType.MEDICINE,
      unit: 'cartridge',
      currentStock: 0,
      minimumStock: 20,
      reorderLevel: 50,
      purchasePrice: 25,
      batchTracking: true,
      expiryTracking: true,
    },
    {
      sku: 'ITM004',
      name: 'Extraction Forceps',
      itemType: InventoryItemType.INSTRUMENT,
      unit: 'piece',
      currentStock: 12,
      minimumStock: 4,
      reorderLevel: 6,
      purchasePrice: 1800,
    },
  ]

  for (const item of items) {
    await prisma.inventoryItem.upsert({
      where: { hospitalId_sku: { hospitalId: hospital.id, sku: item.sku } },
      update: {},
      create: {
        hospitalId: hospital.id,
        categoryId: materialsCategory?.id ?? null,
        preferredSupplierId: primarySupplier?.id ?? null,
        storageLocation: 'Main Store',
        ...item,
      },
    })
  }

  const composite = await prisma.inventoryItem.findUnique({
    where: { hospitalId_sku: { hospitalId: hospital.id, sku: 'ITM001' } },
  })
  const gloves = await prisma.inventoryItem.findUnique({
    where: { hospitalId_sku: { hospitalId: hospital.id, sku: 'ITM002' } },
  })
  const anaesthetic = await prisma.inventoryItem.findUnique({
    where: { hospitalId_sku: { hospitalId: hospital.id, sku: 'ITM003' } },
  })

  if (composite && gloves && anaesthetic) {
    const inTwentyDays = new Date()
    inTwentyDays.setDate(inTwentyDays.getDate() + 20)

    // One batch inside the 30-day window the expiring report defaults to.
    const existingBatch = await prisma.inventoryBatch.findFirst({
      where: { itemId: composite.id, batchNumber: 'BATCH-2026-01' },
    })
    if (!existingBatch) {
      await prisma.inventoryBatch.create({
        data: {
          hospitalId: hospital.id,
          itemId: composite.id,
          batchNumber: 'BATCH-2026-01',
          quantity: 40,
          remainingQty: 18,
          purchasePrice: 450,
          expiryDate: inTwentyDays,
          supplierId: primarySupplier?.id ?? null,
        },
      })
    }

    const thirtyDaysAgo = new Date()
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)

    const movements = [
      { item: composite, type: StockTransactionType.PURCHASE, qty: 40, prev: 0, next: 40 },
      { item: composite, type: StockTransactionType.CONSUMPTION, qty: 5, prev: 40, next: 35 },
      { item: gloves, type: StockTransactionType.PURCHASE, qty: 20, prev: 0, next: 20 },
      { item: gloves, type: StockTransactionType.CONSUMPTION, qty: 14, prev: 20, next: 6 },
      { item: anaesthetic, type: StockTransactionType.CONSUMPTION, qty: 30, prev: 30, next: 0 },
    ]

    const movementCount = await prisma.stockTransaction.count({
      where: { hospitalId: hospital.id },
    })

    if (movementCount === 0) {
      for (const [i, m] of movements.entries()) {
        const when = new Date(thirtyDaysAgo)
        when.setDate(when.getDate() + i * 3)

        await prisma.stockTransaction.create({
          data: {
            hospitalId: hospital.id,
            itemId: m.item.id,
            type: m.type,
            quantity: m.qty,
            previousStock: m.prev,
            newStock: m.next,
            unitPrice: m.item.purchasePrice,
            totalPrice: Number(m.item.purchasePrice) * m.qty,
            transactionDate: when,
            supplierId:
              m.type === StockTransactionType.PURCHASE ? (primarySupplier?.id ?? null) : null,
            performedBy: admin.id,
          },
        })
      }
    }

    // Open, unacknowledged alerts matching the two depleted items.
    for (const [item, alertType] of [
      [gloves, StockAlertType.LOW_STOCK],
      [anaesthetic, StockAlertType.OUT_OF_STOCK],
    ] as const) {
      const open = await prisma.stockAlert.findFirst({
        where: { itemId: item.id, alertType, isAcknowledged: false },
      })
      if (!open) {
        await prisma.stockAlert.create({
          data: { hospitalId: hospital.id, itemId: item.id, alertType },
        })
      }
    }
  }

  console.log('Created suppliers, inventory items, batches, movements and alerts')

  // ── Lab work: vendors and orders ──────────────────────────────────────────

  const vendors = [
    {
      code: 'LAB001',
      name: 'Precision Dental Lab',
      contactPerson: 'Suresh Kumar',
      phone: '9840111222',
      email: 'work@precisionlab.example',
      specializations: 'Crowns, Bridges, Veneers',
      avgTurnaround: 5,
      rating: 4,
    },
    {
      code: 'LAB002',
      name: 'Ortho Craft Studio',
      contactPerson: 'Anita Joseph',
      phone: '9840333444',
      specializations: 'Aligners, Retainers',
      avgTurnaround: 8,
      rating: 5,
    },
  ]

  for (const v of vendors) {
    const existing = await prisma.labVendor.findFirst({
      where: { hospitalId: hospital.id, code: v.code },
    })
    if (!existing) {
      await prisma.labVendor.create({
        data: {
          hospitalId: hospital.id,
          city: 'Chennai',
          state: 'Tamil Nadu',
          status: LabVendorStatus.ACTIVE,
          ...v,
        },
      })
    }
  }

  const primaryVendor = await prisma.labVendor.findFirst({
    where: { hospitalId: hospital.id, code: 'LAB001' },
  })

  const seededPatients = await prisma.patient.findMany({
    where: { hospitalId: hospital.id },
    orderBy: { patientId: 'asc' },
    take: 12,
  })

  if (primaryVendor && seededPatients.length) {
    // A spread of statuses so the lab list's stat cards and status filter have
    // something to count.
    const labOrders = [
      { no: 'LO-2026-0001', status: LabOrderStatus.CREATED, workType: LabWorkType.CROWN },
      { no: 'LO-2026-0002', status: LabOrderStatus.SENT_TO_LAB, workType: LabWorkType.BRIDGE },
      { no: 'LO-2026-0003', status: LabOrderStatus.IN_PROGRESS, workType: LabWorkType.DENTURE },
      { no: 'LO-2026-0004', status: LabOrderStatus.READY, workType: LabWorkType.VENEER },
      { no: 'LO-2026-0005', status: LabOrderStatus.FITTED, workType: LabWorkType.NIGHT_GUARD },
    ]

    for (const [i, o] of labOrders.entries()) {
      const patient = seededPatients[i % seededPatients.length]
      const orderDate = new Date()
      orderDate.setDate(orderDate.getDate() - (labOrders.length - i) * 4)

      const expectedDate = new Date(orderDate)
      expectedDate.setDate(expectedDate.getDate() + 7)

      await prisma.labOrder.upsert({
        where: {
          hospitalId_orderNumber: { hospitalId: hospital.id, orderNumber: o.no },
        },
        update: {},
        create: {
          hospitalId: hospital.id,
          orderNumber: o.no,
          patientId: patient.id,
          labVendorId: primaryVendor.id,
          workType: o.workType,
          status: o.status,
          priority: i === 0 ? LabOrderPriority.URGENT : LabOrderPriority.NORMAL,
          toothNumbers: '16,17',
          shadeGuide: 'A2',
          orderDate,
          expectedDate,
          estimatedCost: 6500,
          createdBy: admin.id,
          history: {
            create: {
              statusFrom: null,
              statusTo: o.status,
              changedBy: admin.id,
              notes: 'Seeded lab order',
            },
          },
        },
      })
    }
  }

  console.log('Created lab vendors and lab orders')

  // ── Appointments ──────────────────────────────────────────────────────────
  //
  // The appointments list pages at 10 per request, so seed past that: it lets
  // the pagination spec assert the real pager instead of an empty state, and
  // gives the check-in and queue specs an appointment to open.

  // Appointment.doctorId points at Staff, not User, and the seed has never
  // created a Staff row — which is part of why it created no appointments.
  const doctorStaff = await prisma.staff.upsert({
    where: { userId: doctor.id },
    update: {},
    create: {
      hospitalId: hospital.id,
      userId: doctor.id,
      employeeId: 'EMP0001',
      firstName: 'Arun',
      lastName: 'Vijay',
      phone: '9876543211',
      email: 'doctor@demo-dental.com',
      qualification: 'BDS, MDS',
      specialization: 'Prosthodontics',
      licenseNumber: 'TN-DENT-2018-4471',
      city: 'Chennai',
      state: 'Tamil Nadu',
    },
  })

  console.log('Created doctor staff record')

  const appointmentCount = await prisma.appointment.count({
    where: { hospitalId: hospital.id },
  })

  if (appointmentCount === 0 && seededPatients.length) {
    const statuses = [
      AppointmentStatus.SCHEDULED,
      AppointmentStatus.CONFIRMED,
      AppointmentStatus.CHECKED_IN,
      AppointmentStatus.IN_PROGRESS,
      AppointmentStatus.COMPLETED,
    ]
    const types = [
      AppointmentType.CONSULTATION,
      AppointmentType.CHECK_UP,
      AppointmentType.PROCEDURE,
      AppointmentType.FOLLOW_UP,
    ]

    for (let i = 0; i < 14; i++) {
      const patient = seededPatients[i % seededPatients.length]
      const status = statuses[i % statuses.length]

      // Today for the first few so the queue page has something, then spread
      // across the coming days.
      const scheduledDate = new Date()
      scheduledDate.setHours(0, 0, 0, 0)
      if (i >= 5) scheduledDate.setDate(scheduledDate.getDate() + (i - 4))

      const hour = 9 + (i % 8)

      await prisma.appointment.create({
        data: {
          hospitalId: hospital.id,
          appointmentNo: `APT2026${String(i + 1).padStart(4, '0')}`,
          patientId: patient.id,
          doctorId: doctorStaff.id,
          scheduledDate,
          scheduledTime: `${String(hour).padStart(2, '0')}:00`,
          duration: 30,
          appointmentType: types[i % types.length],
          status,
          chiefComplaint: 'Routine dental complaint',
          checkedInAt:
            status === AppointmentStatus.CHECKED_IN || status === AppointmentStatus.IN_PROGRESS
              ? new Date()
              : null,
        },
      })
    }
  }

  console.log('Created appointments')

  // Invoice + payment link with a fixed token.
  //
  // tests/e2e/public-payment.spec.ts loads /pay/<token>. app/pay/[token] calls
  // notFound() for an unknown token, so without a seeded link every one of
  // those specs was asserting against Next's 404 page and could never pass.
  // The token is deterministic so the specs can hard-code it.
  const billedPatient = await prisma.patient.findUnique({
    where: {
      hospitalId_patientId: { hospitalId: hospital.id, patientId: 'PAT20240001' },
    },
  })

  if (billedPatient) {
    const invoice = await prisma.invoice.upsert({
      where: {
        hospitalId_invoiceNo: { hospitalId: hospital.id, invoiceNo: 'INV-E2E-0001' },
      },
      update: {},
      create: {
        hospitalId: hospital.id,
        patientId: billedPatient.id,
        invoiceNo: 'INV-E2E-0001',
        subtotal: 1000,
        taxableAmount: 1000,
        cgstAmount: 90,
        sgstAmount: 90,
        totalAmount: 1180,
        paidAmount: 0,
        balanceAmount: 1180,
        status: InvoiceStatus.PENDING,
      },
    })

    // Far-future expiry so the link does not rot into an "expired" state and
    // start failing the suite on some later date.
    const expiresAt = new Date()
    expiresAt.setFullYear(expiresAt.getFullYear() + 10)

    await prisma.paymentLink.upsert({
      where: { token: E2E_PAYMENT_TOKEN },
      update: { expiresAt, usedAt: null },
      create: {
        hospitalId: hospital.id,
        invoiceId: invoice.id,
        token: E2E_PAYMENT_TOKEN,
        amount: 1180,
        expiresAt,
      },
    })

    console.log('Created e2e invoice and payment link')
  }

  console.log('Database seed completed successfully!')
}

main()
  .catch((e) => {
    console.error('Error during seed:', e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
