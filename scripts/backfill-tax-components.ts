/**
 * One-off backfill: populate Invoice.taxComponents for historical rows from the
 * legacy CGST/SGST columns, so every invoice carries the country-agnostic tax
 * breakdown (lib/tax TaxComponent[]) that was in force when it was issued.
 *
 * Safe to re-run: only touches rows where taxComponents IS NULL. The migration
 * (20261027120000_add_invoice_tax_components) already backfilled the scalar
 * taxAmount; the renderer also falls back to the CGST/SGST columns, so this is
 * for completeness/reporting hygiene rather than correctness.
 *
 *   npx tsx scripts/backfill-tax-components.ts
 */
import { PrismaClient, Prisma } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  const invoices = await prisma.invoice.findMany({
    where: { taxComponents: { equals: Prisma.DbNull } },
    select: { id: true, cgstRate: true, sgstRate: true, cgstAmount: true, sgstAmount: true },
  })

  console.log(`Backfilling taxComponents for ${invoices.length} invoice(s)…`)

  let updated = 0
  for (const inv of invoices) {
    const cgstAmount = Number(inv.cgstAmount)
    const sgstAmount = Number(inv.sgstAmount)
    const components = [
      { code: 'CGST', label: 'CGST', rate: Number(inv.cgstRate), amount: cgstAmount },
      { code: 'SGST', label: 'SGST', rate: Number(inv.sgstRate), amount: sgstAmount },
    ]
    await prisma.invoice.update({
      where: { id: inv.id },
      data: {
        taxComponents: components as unknown as Prisma.InputJsonValue,
        taxAmount: Math.round((cgstAmount + sgstAmount) * 100) / 100,
      },
    })
    updated++
  }

  console.log(`Done. Updated ${updated} invoice(s).`)
}

main()
  .catch((err) => {
    console.error(err)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
