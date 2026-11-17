-- The audit log records changes to clinic records (lib/audit-log.ts), not just
-- AI actions, imports and automations.
--
-- entityLabel names the record (a patient, an invoice number) so an entry still
-- reads after the record is deleted. source says how the change came in: web,
-- mobile or patient-portal; null for the system. Both are null on older rows.
--
-- The log now grows with every change, and its page lists a clinic's entries
-- newest first, so it gets an index on exactly that.

-- AlterTable
ALTER TABLE `AuditLog` ADD COLUMN `entityLabel` VARCHAR(191) NULL,
    ADD COLUMN `source` VARCHAR(32) NULL;

-- CreateIndex
CREATE INDEX `AuditLog_hospitalId_createdAt_idx` ON `AuditLog`(`hospitalId`, `createdAt`);
