-- AlterTable: add the country-agnostic tax breakdown columns. The legacy
-- CGST/SGST columns are retained one release for historical re-render.
ALTER TABLE `Invoice` ADD COLUMN `taxComponents` JSON NULL;
ALTER TABLE `Invoice` ADD COLUMN `taxAmount` DECIMAL(10, 2) NOT NULL DEFAULT 0.00;

-- Backfill the scalar tax total for existing invoices from the legacy columns,
-- so revenue/tax reporting keeps working. The taxComponents JSON is left NULL
-- here (the renderer falls back to the CGST/SGST columns); the optional
-- backfill script populates it for completeness.
UPDATE `Invoice` SET `taxAmount` = `cgstAmount` + `sgstAmount`;
