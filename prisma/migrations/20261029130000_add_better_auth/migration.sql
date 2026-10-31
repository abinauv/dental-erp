-- Better Auth migration: new session/account/verification tables + a boolean
-- email-verified flag on User, plus a backfill of credential accounts so every
-- existing user keeps their current (bcrypt) password.

-- AlterTable
ALTER TABLE `User` ADD COLUMN `emailVerifiedBa` BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE `BaSession` (
    `id` VARCHAR(191) NOT NULL,
    `expiresAt` DATETIME(3) NOT NULL,
    `token` VARCHAR(191) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,
    `ipAddress` VARCHAR(191) NULL,
    `userAgent` TEXT NULL,
    `userId` VARCHAR(191) NOT NULL,

    UNIQUE INDEX `BaSession_token_key`(`token`),
    INDEX `BaSession_userId_idx`(`userId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `BaAccount` (
    `id` VARCHAR(191) NOT NULL,
    `accountId` VARCHAR(191) NOT NULL,
    `providerId` VARCHAR(191) NOT NULL,
    `userId` VARCHAR(191) NOT NULL,
    `accessToken` TEXT NULL,
    `refreshToken` TEXT NULL,
    `idToken` TEXT NULL,
    `accessTokenExpiresAt` DATETIME(3) NULL,
    `refreshTokenExpiresAt` DATETIME(3) NULL,
    `scope` VARCHAR(191) NULL,
    `password` TEXT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `BaAccount_userId_idx`(`userId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `BaVerification` (
    `id` VARCHAR(191) NOT NULL,
    `identifier` VARCHAR(191) NOT NULL,
    `value` TEXT NOT NULL,
    `expiresAt` DATETIME(3) NOT NULL,
    `createdAt` DATETIME(3) NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NULL,

    INDEX `BaVerification_identifier_idx`(`identifier`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `BaSession` ADD CONSTRAINT `BaSession_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `BaAccount` ADD CONSTRAINT `BaAccount_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- Backfill one credential account per existing user, carrying the bcrypt hash.
-- Better Auth stores the email/password credential in BaAccount (providerId
-- 'credential', accountId = the user id), not in User.password, so without this
-- existing users could not sign in. The custom verify() in lib/auth.ts checks
-- bcrypt, so no password resets are needed.
INSERT INTO `BaAccount` (`id`, `accountId`, `providerId`, `userId`, `password`, `createdAt`, `updatedAt`)
SELECT CONCAT('bacred_', `id`), `id`, 'credential', `id`, `password`, NOW(3), NOW(3)
FROM `User`
WHERE `password` IS NOT NULL AND `password` <> '';
