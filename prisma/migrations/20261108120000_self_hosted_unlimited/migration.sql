-- Self-hosted clinics are unlimited.
--
-- Clinic signup used to create every clinic on the FREE plan (100 patients,
-- 3 staff, 500 MB), and the API enforces those caps. The self-hosted edition
-- has no plan tiers and no way to raise them, so a clinic could not add a
-- fourth staff member or a 101st patient.

-- New clinics: unlimited by default.
ALTER TABLE `Hospital` MODIFY `plan` ENUM('FREE', 'PROFESSIONAL', 'ENTERPRISE', 'SELF_HOSTED') NOT NULL DEFAULT 'SELF_HOSTED',
    MODIFY `patientLimit` INTEGER NOT NULL DEFAULT -1,
    MODIFY `staffLimit` INTEGER NOT NULL DEFAULT -1,
    MODIFY `storageLimitMb` INTEGER NOT NULL DEFAULT -1;

-- Existing FREE clinics: lift the caps. PROFESSIONAL/ENTERPRISE are already
-- unlimited and are left as they are.
UPDATE `Hospital`
SET `plan` = 'SELF_HOSTED', `patientLimit` = -1, `staffLimit` = -1, `storageLimitMb` = -1
WHERE `plan` = 'FREE';
