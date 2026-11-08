/**
 * Staff fields that only an admin, or the staff member themselves, may read:
 * government ID numbers, pay and bank details, and personal contact data.
 * Everyone else gets what they need to work with a colleague (name, role,
 * work phone/email, qualifications) and nothing more.
 */
export const SENSITIVE_STAFF_FIELDS = [
  'dateOfBirth',
  'alternatePhone',
  'address',
  'city',
  'state',
  'pincode',
  'aadharNumber',
  'panNumber',
  'salary',
  'bankAccountNo',
  'bankIfsc',
  'emergencyContact',
  'emergencyPhone',
] as const

export function redactStaff<T extends object>(staff: T): T {
  const copy = { ...staff } as Record<string, unknown>
  for (const field of SENSITIVE_STAFF_FIELDS) delete copy[field]
  return copy as T
}
