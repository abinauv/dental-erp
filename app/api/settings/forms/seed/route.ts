import { NextResponse } from "next/server"
import prisma from "@/lib/prisma"
import { requireAuthAndRole } from "@/lib/api-helpers"

const DEFAULT_TEMPLATES = [
  {
    name: "General Dental Consent",
    description: "Standard consent form for dental procedures. Must be signed before any treatment.",
    type: "CONSENT" as const,
    fields: [
      {
        id: "heading_consent",
        type: "heading",
        label: "Consent for Dental Treatment",
        description: "Please read carefully and sign below to acknowledge your understanding and consent.",
      },
      {
        id: "para_intro",
        type: "paragraph",
        label: "I hereby authorize the dentist and their clinical staff to perform dental procedures as discussed and agreed upon during my consultation. I understand that dentistry is not an exact science and that no guarantees have been made to me regarding the outcome of any treatment.",
      },
      {
        id: "patient_name",
        type: "text",
        label: "Patient Full Name",
        required: true,
        placeholder: "Enter your full name",
      },
      {
        id: "heading_risks",
        type: "heading",
        label: "Risks & Acknowledgements",
      },
      {
        id: "acknowledge_risks",
        type: "checkbox",
        label: "I acknowledge that dental procedures may involve risks including, but not limited to: pain, swelling, infection, bleeding, allergic reactions, numbness, damage to adjacent teeth or restorations, and jaw joint problems.",
        required: true,
      },
      {
        id: "acknowledge_anesthesia",
        type: "checkbox",
        label: "I understand that local anesthesia may be administered and carries its own risks including prolonged numbness, allergic reactions, and (rarely) injury to nerves.",
        required: true,
      },
      {
        id: "acknowledge_alternatives",
        type: "checkbox",
        label: "I have been informed of alternative treatment options (including no treatment) and understand the consequences of each.",
        required: true,
      },
      {
        id: "acknowledge_payment",
        type: "checkbox",
        label: "I understand that I am responsible for the cost of treatment as discussed, and that insurance coverage (if applicable) is subject to the terms of my policy.",
        required: true,
      },
      {
        id: "heading_medical",
        type: "heading",
        label: "Medical Disclosure",
      },
      {
        id: "medical_conditions",
        type: "textarea",
        label: "Please list any current medical conditions, medications, or allergies",
        placeholder: "e.g., Diabetes, Blood pressure medication, Penicillin allergy",
        required: false,
      },
      {
        id: "pregnant",
        type: "radio",
        label: "Are you pregnant or suspect you might be?",
        options: ["No", "Yes", "Not applicable"],
        required: true,
      },
      {
        id: "signature_consent",
        type: "signature",
        label: "Patient/Guardian Signature",
        required: true,
        description: "By signing below, I confirm that I have read and understood this consent form and agree to the proposed dental treatment.",
      },
    ],
  },
  {
    name: "Extraction / Surgical Consent",
    description: "Specific consent form for tooth extractions and minor oral surgery procedures.",
    type: "CONSENT" as const,
    fields: [
      {
        id: "heading_extraction",
        type: "heading",
        label: "Consent for Tooth Extraction / Oral Surgery",
        description: "This consent is required before any extraction or surgical procedure.",
      },
      {
        id: "patient_name",
        type: "text",
        label: "Patient Full Name",
        required: true,
      },
      {
        id: "procedure_description",
        type: "textarea",
        label: "Procedure Description (filled by doctor)",
        placeholder: "e.g., Surgical extraction of impacted lower third molar (#38)",
        required: true,
      },
      {
        id: "tooth_numbers",
        type: "text",
        label: "Tooth Number(s)",
        placeholder: "e.g., 38, 48",
        required: true,
      },
      {
        id: "heading_risks",
        type: "heading",
        label: "Specific Risks of This Procedure",
      },
      {
        id: "para_risks",
        type: "paragraph",
        label: "I have been informed that the following risks are associated with tooth extraction / oral surgery:\n\n• Pain, swelling, and bruising after the procedure\n• Bleeding that may continue for several hours\n• Dry socket (alveolar osteitis)\n• Infection requiring antibiotics\n• Damage to adjacent teeth or restorations\n• Sinus involvement (for upper teeth)\n• Temporary or permanent numbness of lip, tongue, or chin (nerve damage)\n• Jaw fracture (rare)\n• Incomplete removal of tooth roots (if removal risks greater damage)",
      },
      {
        id: "acknowledge_risks",
        type: "checkbox",
        label: "I understand the above risks and wish to proceed with the procedure.",
        required: true,
      },
      {
        id: "acknowledge_instructions",
        type: "checkbox",
        label: "I have received and understand the post-operative care instructions.",
        required: true,
      },
      {
        id: "acknowledge_followup",
        type: "checkbox",
        label: "I understand that I should contact the clinic immediately if I experience excessive bleeding, severe pain, fever, or any unusual symptoms.",
        required: true,
      },
      {
        id: "allergies",
        type: "textarea",
        label: "Known Allergies",
        placeholder: "List any drug or material allergies",
      },
      {
        id: "blood_thinners",
        type: "radio",
        label: "Are you taking blood thinning medication (Aspirin, Warfarin, etc.)?",
        options: ["No", "Yes"],
        required: true,
      },
      {
        id: "signature_extraction",
        type: "signature",
        label: "Patient/Guardian Signature",
        required: true,
        description: "I hereby consent to the extraction/surgical procedure described above.",
      },
    ],
  },
  {
    name: "Patient Registration / Intake Form",
    description: "New patient intake form to collect personal, medical, and dental history information.",
    type: "INTAKE" as const,
    fields: [
      {
        id: "heading_personal",
        type: "heading",
        label: "Personal Information",
      },
      {
        id: "full_name",
        type: "text",
        label: "Full Name",
        required: true,
        placeholder: "Enter your full name",
      },
      {
        id: "date_of_birth",
        type: "date",
        label: "Date of Birth",
        required: true,
      },
      {
        id: "gender",
        type: "radio",
        label: "Gender",
        options: ["Male", "Female", "Other", "Prefer not to say"],
        required: true,
      },
      {
        id: "phone",
        type: "text",
        label: "Phone Number",
        required: true,
        placeholder: "10-digit mobile number",
      },
      {
        id: "email",
        type: "text",
        label: "Email Address",
        placeholder: "your@email.com",
      },
      {
        id: "address",
        type: "textarea",
        label: "Full Address",
        placeholder: "Street, area, city, pincode",
        required: true,
      },
      {
        id: "emergency_name",
        type: "text",
        label: "Emergency Contact Name",
        required: true,
      },
      {
        id: "emergency_phone",
        type: "text",
        label: "Emergency Contact Phone",
        required: true,
      },
      {
        id: "emergency_relation",
        type: "select",
        label: "Relationship to Emergency Contact",
        options: ["Spouse", "Parent", "Child", "Sibling", "Friend", "Other"],
        required: true,
      },
      {
        id: "heading_medical",
        type: "heading",
        label: "Medical History",
      },
      {
        id: "conditions",
        type: "checkbox",
        label: "Do you have any of the following conditions? (Select all that apply)",
        options: [
          "Diabetes",
          "Hypertension / High Blood Pressure",
          "Heart Disease",
          "Asthma / Respiratory Issues",
          "Thyroid Problems",
          "Bleeding Disorder",
          "Hepatitis (B/C)",
          "HIV/AIDS",
          "Epilepsy / Seizures",
          "Kidney Disease",
          "None of the above",
        ],
      },
      {
        id: "current_medications",
        type: "textarea",
        label: "Current Medications",
        placeholder: "List all medications you are currently taking, including dosage",
      },
      {
        id: "allergies",
        type: "textarea",
        label: "Known Allergies",
        placeholder: "Drug allergies, latex allergy, food allergies, etc.",
      },
      {
        id: "pregnant",
        type: "radio",
        label: "Are you currently pregnant or nursing?",
        options: ["No", "Yes", "Not applicable"],
      },
      {
        id: "heading_dental",
        type: "heading",
        label: "Dental History",
      },
      {
        id: "last_dental_visit",
        type: "select",
        label: "When was your last dental visit?",
        options: [
          "Within the last 6 months",
          "6-12 months ago",
          "1-2 years ago",
          "More than 2 years ago",
          "Never visited a dentist",
        ],
      },
      {
        id: "dental_complaints",
        type: "checkbox",
        label: "Current dental concerns (select all that apply)",
        options: [
          "Tooth pain / sensitivity",
          "Bleeding gums",
          "Bad breath",
          "Broken / chipped tooth",
          "Missing teeth",
          "Teeth grinding (bruxism)",
          "Jaw pain / TMJ issues",
          "Cosmetic improvement",
          "Routine check-up / cleaning",
        ],
      },
      {
        id: "chief_complaint",
        type: "textarea",
        label: "Please describe your main dental concern",
        placeholder: "Tell us what brings you to the clinic today...",
        required: true,
      },
      {
        id: "referral_source",
        type: "select",
        label: "How did you hear about us?",
        options: [
          "Google Search",
          "Social Media",
          "Friend / Family Referral",
          "Walk-in",
          "Another Doctor",
          "Other",
        ],
      },
      {
        id: "signature_intake",
        type: "signature",
        label: "Patient Signature",
        required: true,
        description: "I confirm that the information provided above is accurate and complete to the best of my knowledge.",
      },
    ],
  },
]

// POST: Seed default form templates for the hospital
export async function POST() {
  const { error, hospitalId } = await requireAuthAndRole(["ADMIN"])
  if (error || !hospitalId) {
    return error || NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  try {
    // Check if defaults already exist
    const existingDefaults = await prisma.formTemplate.count({
      where: { hospitalId, isDefault: true },
    })

    if (existingDefaults > 0) {
      return NextResponse.json(
        { message: "Default templates already exist", count: existingDefaults },
        { status: 200 }
      )
    }

    const created = await prisma.$transaction(
      DEFAULT_TEMPLATES.map((template) =>
        prisma.formTemplate.create({
          data: {
            hospitalId,
            name: template.name,
            description: template.description,
            type: template.type,
            fields: template.fields as any,
            isDefault: true,
            isActive: true,
          },
        })
      )
    )

    return NextResponse.json({
      message: `Created ${created.length} default templates`,
      templates: created.map((t) => ({ id: t.id, name: t.name, type: t.type })),
    }, { status: 201 })
  } catch (err) {
    console.error("Seed templates error:", err)
    return NextResponse.json({ error: "Failed to seed templates" }, { status: 500 })
  }
}
