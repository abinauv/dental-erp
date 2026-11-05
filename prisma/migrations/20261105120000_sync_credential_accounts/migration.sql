-- Fix for the Better Auth migration (20261029130000).
--
-- Better Auth verifies web sign-in against the credential BaAccount row, but
-- until now the app set passwords only on User.password. The original backfill
-- covered the users that existed at the time; anyone created or given a new
-- password afterwards has no credential row, or a stale one. From this release
-- the app writes both (lib/auth-credentials); this migration repairs existing
-- data. Every step is idempotent.

-- Better Auth's schema check rejects a required column it never writes, so give
-- User.password a default. The app always sets a real bcrypt hash, and an empty
-- hash can never authenticate.
-- AlterTable
ALTER TABLE `User` MODIFY `password` VARCHAR(191) NOT NULL DEFAULT '';

-- Create the missing credential rows. The id scheme matches the original
-- backfill and lib/auth-credentials.
INSERT INTO `BaAccount` (`id`, `accountId`, `providerId`, `userId`, `password`, `createdAt`, `updatedAt`)
SELECT CONCAT('bacred_', u.`id`), u.`id`, 'credential', u.`id`, u.`password`, NOW(3), NOW(3)
FROM `User` AS u
WHERE u.`password` <> ''
  AND NOT EXISTS (
    SELECT 1 FROM `BaAccount` AS a
    WHERE a.`userId` = u.`id` AND a.`providerId` = 'credential'
  );

-- Re-sync stale credential rows (e.g. after an admin password reset) from
-- User.password, which was the only password the app wrote before this fix.
UPDATE `BaAccount` AS a
INNER JOIN `User` AS u ON u.`id` = a.`userId`
SET a.`password` = u.`password`, a.`updatedAt` = NOW(3)
WHERE a.`providerId` = 'credential'
  AND u.`password` <> ''
  AND (a.`password` IS NULL OR a.`password` <> u.`password`);
