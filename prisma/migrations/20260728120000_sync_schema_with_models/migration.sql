-- AlterTable
ALTER TABLE `Appointment` ADD COLUMN `isVirtual` BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN `videoConsultationId` VARCHAR(191) NULL;

-- AlterTable
ALTER TABLE `Document` ADD COLUMN `annotatedAt` DATETIME(3) NULL,
    ADD COLUMN `annotatedBy` VARCHAR(191) NULL,
    ADD COLUMN `annotations` JSON NULL;

-- AlterTable
ALTER TABLE `EmailLog` ADD COLUMN `clickedAt` DATETIME(3) NULL,
    ADD COLUMN `trackingId` VARCHAR(191) NULL;

-- AlterTable
ALTER TABLE `Hospital` ADD COLUMN `alternatePhone` VARCHAR(191) NULL,
    ADD COLUMN `bankAccountName` VARCHAR(191) NULL,
    ADD COLUMN `country` VARCHAR(191) NOT NULL DEFAULT 'IN',
    ADD COLUMN `currency` VARCHAR(191) NOT NULL DEFAULT 'INR',
    ADD COLUMN `emailVerificationExpiry` DATETIME(3) NULL,
    ADD COLUMN `emailVerificationToken` VARCHAR(191) NULL,
    ADD COLUMN `locale` VARCHAR(191) NOT NULL DEFAULT 'en-IN',
    ADD COLUMN `patientPortalEnabled` BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN `timezone` VARCHAR(191) NOT NULL DEFAULT 'Asia/Kolkata';

-- AlterTable
ALTER TABLE `InsuranceClaim` ADD COLUMN `appealDate` DATETIME(3) NULL,
    ADD COLUMN `appealDeadline` DATETIME(3) NULL,
    ADD COLUMN `appealNotes` TEXT NULL,
    ADD COLUMN `appealStatus` VARCHAR(191) NULL,
    ADD COLUMN `denialCode` VARCHAR(191) NULL;

-- AlterTable
ALTER TABLE `Patient` ADD COLUMN `aiSummary` JSON NULL,
    ADD COLUMN `aiSummaryAt` DATETIME(3) NULL;

-- AlterTable
ALTER TABLE `Payment` ADD COLUMN `gateway` VARCHAR(191) NULL,
    ADD COLUMN `gatewayOrderId` VARCHAR(191) NULL,
    ADD COLUMN `gatewayPaymentId` VARCHAR(191) NULL,
    ADD COLUMN `gatewayStatus` VARCHAR(191) NULL,
    MODIFY `paymentMethod` ENUM('CASH', 'CARD', 'UPI', 'BANK_TRANSFER', 'CHEQUE', 'INSURANCE', 'WALLET', 'ONLINE') NOT NULL;

-- CreateTable
CREATE TABLE `InsuranceProviderMaster` (
    `id` VARCHAR(191) NOT NULL,
    `hospitalId` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `code` VARCHAR(191) NULL,
    `contactPhone` VARCHAR(191) NULL,
    `contactEmail` VARCHAR(191) NULL,
    `website` VARCHAR(191) NULL,
    `claimSubmissionUrl` VARCHAR(191) NULL,
    `portalUsername` VARCHAR(191) NULL,
    `portalPassword` TEXT NULL,
    `isActive` BOOLEAN NOT NULL DEFAULT true,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `InsuranceProviderMaster_hospitalId_idx`(`hospitalId`),
    UNIQUE INDEX `InsuranceProviderMaster_hospitalId_name_key`(`hospitalId`, `name`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `PatientInsurance` (
    `id` VARCHAR(191) NOT NULL,
    `hospitalId` VARCHAR(191) NOT NULL,
    `patientId` VARCHAR(191) NOT NULL,
    `providerId` VARCHAR(191) NOT NULL,
    `policyNumber` VARCHAR(191) NOT NULL,
    `groupNumber` VARCHAR(191) NULL,
    `memberId` VARCHAR(191) NOT NULL,
    `subscriberName` VARCHAR(191) NOT NULL,
    `subscriberRelation` VARCHAR(191) NOT NULL DEFAULT 'Self',
    `effectiveDate` DATETIME(3) NOT NULL,
    `expiryDate` DATETIME(3) NULL,
    `coverageType` VARCHAR(191) NULL,
    `annualMaximum` DECIMAL(10, 2) NULL,
    `usedAmount` DECIMAL(10, 2) NULL,
    `remainingAmount` DECIMAL(10, 2) NULL,
    `deductible` DECIMAL(10, 2) NULL,
    `deductibleMet` BOOLEAN NOT NULL DEFAULT false,
    `copayPercentage` DECIMAL(5, 2) NULL,
    `isActive` BOOLEAN NOT NULL DEFAULT true,
    `lastVerifiedAt` DATETIME(3) NULL,
    `verificationStatus` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `PatientInsurance_hospitalId_idx`(`hospitalId`),
    INDEX `PatientInsurance_patientId_idx`(`patientId`),
    INDEX `PatientInsurance_providerId_idx`(`providerId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `PreAuthorization` (
    `id` VARCHAR(191) NOT NULL,
    `hospitalId` VARCHAR(191) NOT NULL,
    `patientId` VARCHAR(191) NOT NULL,
    `insurancePolicyId` VARCHAR(191) NOT NULL,
    `treatmentPlanId` VARCHAR(191) NULL,
    `authNumber` VARCHAR(191) NULL,
    `requestDate` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `procedures` JSON NOT NULL,
    `estimatedCost` DECIMAL(10, 2) NOT NULL,
    `status` ENUM('PENDING', 'SUBMITTED', 'APPROVED', 'DENIED', 'EXPIRED') NOT NULL DEFAULT 'PENDING',
    `approvedAmount` DECIMAL(10, 2) NULL,
    `approvedDate` DATETIME(3) NULL,
    `expiryDate` DATETIME(3) NULL,
    `denialReason` VARCHAR(191) NULL,
    `notes` TEXT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `PreAuthorization_hospitalId_idx`(`hospitalId`),
    INDEX `PreAuthorization_patientId_idx`(`patientId`),
    INDEX `PreAuthorization_status_idx`(`status`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `PaymentGatewayConfig` (
    `id` VARCHAR(191) NOT NULL,
    `hospitalId` VARCHAR(191) NOT NULL,
    `provider` ENUM('RAZORPAY', 'PHONEPE', 'PAYTM') NOT NULL,
    `isEnabled` BOOLEAN NOT NULL DEFAULT false,
    `isLiveMode` BOOLEAN NOT NULL DEFAULT false,
    `razorpayKeyId` VARCHAR(191) NULL,
    `razorpayKeySecret` VARCHAR(191) NULL,
    `phonepeMerchantId` VARCHAR(191) NULL,
    `phonepeSaltKey` VARCHAR(191) NULL,
    `phonepeSaltIndex` VARCHAR(191) NULL,
    `paytmMid` VARCHAR(191) NULL,
    `paytmMerchantKey` VARCHAR(191) NULL,
    `paytmWebsite` VARCHAR(191) NULL,
    `webhookSecret` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `PaymentGatewayConfig_hospitalId_key`(`hospitalId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `PaymentLink` (
    `id` VARCHAR(191) NOT NULL,
    `hospitalId` VARCHAR(191) NOT NULL,
    `invoiceId` VARCHAR(191) NOT NULL,
    `token` VARCHAR(191) NOT NULL,
    `amount` DECIMAL(10, 2) NOT NULL,
    `expiresAt` DATETIME(3) NOT NULL,
    `usedAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `PaymentLink_token_key`(`token`),
    INDEX `PaymentLink_hospitalId_idx`(`hospitalId`),
    INDEX `PaymentLink_token_idx`(`token`),
    INDEX `PaymentLink_invoiceId_idx`(`invoiceId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `AIConversation` (
    `id` VARCHAR(191) NOT NULL,
    `hospitalId` VARCHAR(191) NOT NULL,
    `userId` VARCHAR(191) NOT NULL,
    `sessionType` ENUM('CHAT', 'COMMAND', 'ANALYSIS', 'QUERY') NOT NULL,
    `messages` JSON NOT NULL,
    `context` JSON NOT NULL,
    `resolved` BOOLEAN NOT NULL DEFAULT false,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `AIConversation_hospitalId_idx`(`hospitalId`),
    INDEX `AIConversation_userId_idx`(`userId`),
    INDEX `AIConversation_createdAt_idx`(`createdAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `AISkillExecution` (
    `id` VARCHAR(191) NOT NULL,
    `hospitalId` VARCHAR(191) NOT NULL,
    `userId` VARCHAR(191) NULL,
    `skill` VARCHAR(191) NOT NULL,
    `input` JSON NOT NULL,
    `output` JSON NULL,
    `status` ENUM('PENDING', 'RUNNING', 'COMPLETED', 'FAILED') NOT NULL DEFAULT 'PENDING',
    `duration` INTEGER NULL,
    `tokensUsed` INTEGER NULL,
    `cost` DECIMAL(10, 6) NULL,
    `error` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `AISkillExecution_hospitalId_idx`(`hospitalId`),
    INDEX `AISkillExecution_skill_idx`(`skill`),
    INDEX `AISkillExecution_status_idx`(`status`),
    INDEX `AISkillExecution_createdAt_idx`(`createdAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `AIInsight` (
    `id` VARCHAR(191) NOT NULL,
    `hospitalId` VARCHAR(191) NOT NULL,
    `category` ENUM('REVENUE', 'CLINICAL', 'OPERATIONAL', 'PATIENT', 'STAFFING', 'INVENTORY') NOT NULL,
    `severity` ENUM('INFO', 'WARNING', 'CRITICAL') NOT NULL,
    `title` VARCHAR(191) NOT NULL,
    `description` TEXT NOT NULL,
    `data` JSON NULL,
    `dismissed` BOOLEAN NOT NULL DEFAULT false,
    `actionTaken` BOOLEAN NOT NULL DEFAULT false,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `expiresAt` DATETIME(3) NULL,

    INDEX `AIInsight_hospitalId_idx`(`hospitalId`),
    INDEX `AIInsight_category_idx`(`category`),
    INDEX `AIInsight_severity_idx`(`severity`),
    INDEX `AIInsight_dismissed_idx`(`dismissed`),
    INDEX `AIInsight_createdAt_idx`(`createdAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `PatientRiskScore` (
    `id` VARCHAR(191) NOT NULL,
    `patientId` VARCHAR(191) NOT NULL,
    `hospitalId` VARCHAR(191) NOT NULL,
    `overallScore` INTEGER NOT NULL,
    `factors` JSON NOT NULL,
    `contraindications` JSON NULL,
    `calculatedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `PatientRiskScore_patientId_idx`(`patientId`),
    INDEX `PatientRiskScore_hospitalId_idx`(`hospitalId`),
    INDEX `PatientRiskScore_calculatedAt_idx`(`calculatedAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `FormTemplate` (
    `id` VARCHAR(191) NOT NULL,
    `hospitalId` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `description` TEXT NULL,
    `type` ENUM('MEDICAL_HISTORY', 'CONSENT', 'INTAKE', 'FEEDBACK', 'CUSTOM') NOT NULL,
    `fields` JSON NOT NULL,
    `isActive` BOOLEAN NOT NULL DEFAULT true,
    `isDefault` BOOLEAN NOT NULL DEFAULT false,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `FormTemplate_hospitalId_idx`(`hospitalId`),
    INDEX `FormTemplate_type_idx`(`type`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `FormSubmission` (
    `id` VARCHAR(191) NOT NULL,
    `hospitalId` VARCHAR(191) NOT NULL,
    `templateId` VARCHAR(191) NOT NULL,
    `patientId` VARCHAR(191) NULL,
    `appointmentId` VARCHAR(191) NULL,
    `data` JSON NOT NULL,
    `signature` LONGTEXT NULL,
    `signedAt` DATETIME(3) NULL,
    `ipAddress` VARCHAR(191) NULL,
    `status` ENUM('SUBMITTED', 'REVIEWED', 'APPROVED', 'REJECTED') NOT NULL DEFAULT 'SUBMITTED',
    `reviewedBy` VARCHAR(191) NULL,
    `reviewedAt` DATETIME(3) NULL,
    `reviewNotes` TEXT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `FormSubmission_hospitalId_idx`(`hospitalId`),
    INDEX `FormSubmission_patientId_idx`(`patientId`),
    INDEX `FormSubmission_appointmentId_idx`(`appointmentId`),
    INDEX `FormSubmission_status_idx`(`status`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `PatientOTP` (
    `id` VARCHAR(191) NOT NULL,
    `hospitalId` VARCHAR(191) NOT NULL,
    `phone` VARCHAR(191) NOT NULL,
    `otp` VARCHAR(191) NOT NULL,
    `expiresAt` DATETIME(3) NOT NULL,
    `verified` BOOLEAN NOT NULL DEFAULT false,
    `attempts` INTEGER NOT NULL DEFAULT 0,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `PatientOTP_phone_hospitalId_idx`(`phone`, `hospitalId`),
    INDEX `PatientOTP_expiresAt_idx`(`expiresAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `MembershipPlan` (
    `id` VARCHAR(191) NOT NULL,
    `hospitalId` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `description` TEXT NULL,
    `price` DECIMAL(10, 2) NOT NULL,
    `duration` INTEGER NOT NULL,
    `benefits` JSON NOT NULL,
    `maxMembers` INTEGER NULL,
    `isActive` BOOLEAN NOT NULL DEFAULT true,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `MembershipPlan_hospitalId_idx`(`hospitalId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `PatientMembership` (
    `id` VARCHAR(191) NOT NULL,
    `hospitalId` VARCHAR(191) NOT NULL,
    `patientId` VARCHAR(191) NOT NULL,
    `planId` VARCHAR(191) NOT NULL,
    `startDate` DATETIME(3) NOT NULL,
    `endDate` DATETIME(3) NOT NULL,
    `status` ENUM('ACTIVE', 'EXPIRED', 'CANCELLED', 'SUSPENDED') NOT NULL DEFAULT 'ACTIVE',
    `paymentId` VARCHAR(191) NULL,
    `autoRenew` BOOLEAN NOT NULL DEFAULT false,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `PatientMembership_hospitalId_idx`(`hospitalId`),
    INDEX `PatientMembership_patientId_idx`(`patientId`),
    INDEX `PatientMembership_status_idx`(`status`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Referral` (
    `id` VARCHAR(191) NOT NULL,
    `hospitalId` VARCHAR(191) NOT NULL,
    `referrerPatientId` VARCHAR(191) NOT NULL,
    `referredPatientId` VARCHAR(191) NULL,
    `referredName` VARCHAR(191) NOT NULL,
    `referredPhone` VARCHAR(191) NOT NULL,
    `referralCode` VARCHAR(191) NOT NULL,
    `status` ENUM('PENDING', 'CONVERTED', 'EXPIRED', 'REWARDED') NOT NULL DEFAULT 'PENDING',
    `rewardType` VARCHAR(191) NULL,
    `rewardValue` DECIMAL(10, 2) NULL,
    `rewardGiven` BOOLEAN NOT NULL DEFAULT false,
    `rewardGivenAt` DATETIME(3) NULL,
    `convertedAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `Referral_referralCode_key`(`referralCode`),
    INDEX `Referral_hospitalId_idx`(`hospitalId`),
    INDEX `Referral_referrerPatientId_idx`(`referrerPatientId`),
    INDEX `Referral_referralCode_idx`(`referralCode`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `LoyaltyTransaction` (
    `id` VARCHAR(191) NOT NULL,
    `hospitalId` VARCHAR(191) NOT NULL,
    `patientId` VARCHAR(191) NOT NULL,
    `points` INTEGER NOT NULL,
    `type` VARCHAR(191) NOT NULL,
    `description` VARCHAR(191) NOT NULL,
    `referenceId` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `LoyaltyTransaction_hospitalId_idx`(`hospitalId`),
    INDEX `LoyaltyTransaction_patientId_idx`(`patientId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `CalendarIntegration` (
    `id` VARCHAR(191) NOT NULL,
    `hospitalId` VARCHAR(191) NOT NULL,
    `userId` VARCHAR(191) NOT NULL,
    `provider` VARCHAR(191) NOT NULL,
    `accessToken` TEXT NOT NULL,
    `refreshToken` TEXT NOT NULL,
    `calendarId` VARCHAR(191) NULL,
    `syncEnabled` BOOLEAN NOT NULL DEFAULT true,
    `lastSyncAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `CalendarIntegration_hospitalId_idx`(`hospitalId`),
    UNIQUE INDEX `CalendarIntegration_userId_provider_key`(`userId`, `provider`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Waitlist` (
    `id` VARCHAR(191) NOT NULL,
    `hospitalId` VARCHAR(191) NOT NULL,
    `patientId` VARCHAR(191) NOT NULL,
    `doctorId` VARCHAR(191) NULL,
    `preferredDays` JSON NULL,
    `preferredTime` VARCHAR(191) NULL,
    `procedureId` VARCHAR(191) NULL,
    `notes` VARCHAR(191) NULL,
    `status` ENUM('ACTIVE', 'NOTIFIED', 'BOOKED', 'CANCELLED', 'EXPIRED') NOT NULL DEFAULT 'ACTIVE',
    `notifiedAt` DATETIME(3) NULL,
    `bookedAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `Waitlist_hospitalId_idx`(`hospitalId`),
    INDEX `Waitlist_status_idx`(`status`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `PaymentPlan` (
    `id` VARCHAR(191) NOT NULL,
    `hospitalId` VARCHAR(191) NOT NULL,
    `invoiceId` VARCHAR(191) NOT NULL,
    `patientId` VARCHAR(191) NOT NULL,
    `totalAmount` DECIMAL(10, 2) NOT NULL,
    `downPayment` DECIMAL(10, 2) NOT NULL DEFAULT 0,
    `installments` INTEGER NOT NULL,
    `frequency` ENUM('WEEKLY', 'BIWEEKLY', 'MONTHLY') NOT NULL DEFAULT 'MONTHLY',
    `interestRate` DECIMAL(5, 2) NOT NULL DEFAULT 0,
    `status` ENUM('ACTIVE', 'COMPLETED', 'DEFAULTED', 'CANCELLED') NOT NULL DEFAULT 'ACTIVE',
    `startDate` DATETIME(3) NOT NULL,
    `nextDueDate` DATETIME(3) NULL,
    `notes` TEXT NULL,
    `createdBy` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `PaymentPlan_hospitalId_idx`(`hospitalId`),
    INDEX `PaymentPlan_patientId_idx`(`patientId`),
    INDEX `PaymentPlan_invoiceId_idx`(`invoiceId`),
    INDEX `PaymentPlan_status_idx`(`status`),
    INDEX `PaymentPlan_nextDueDate_idx`(`nextDueDate`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `PaymentPlanSchedule` (
    `id` VARCHAR(191) NOT NULL,
    `planId` VARCHAR(191) NOT NULL,
    `installmentNo` INTEGER NOT NULL,
    `amount` DECIMAL(10, 2) NOT NULL,
    `dueDate` DATETIME(3) NOT NULL,
    `paidDate` DATETIME(3) NULL,
    `paidAmount` DECIMAL(10, 2) NULL,
    `paymentId` VARCHAR(191) NULL,
    `status` ENUM('PENDING', 'PAID', 'OVERDUE', 'WAIVED') NOT NULL DEFAULT 'PENDING',

    INDEX `PaymentPlanSchedule_planId_idx`(`planId`),
    INDEX `PaymentPlanSchedule_dueDate_idx`(`dueDate`),
    INDEX `PaymentPlanSchedule_status_idx`(`status`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `VideoConsultation` (
    `id` VARCHAR(191) NOT NULL,
    `hospitalId` VARCHAR(191) NOT NULL,
    `appointmentId` VARCHAR(191) NULL,
    `patientId` VARCHAR(191) NOT NULL,
    `doctorId` VARCHAR(191) NOT NULL,
    `roomUrl` VARCHAR(191) NOT NULL,
    `roomName` VARCHAR(191) NOT NULL,
    `status` ENUM('SCHEDULED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED', 'NO_SHOW') NOT NULL DEFAULT 'SCHEDULED',
    `scheduledAt` DATETIME(3) NOT NULL,
    `startedAt` DATETIME(3) NULL,
    `endedAt` DATETIME(3) NULL,
    `duration` INTEGER NULL,
    `notes` TEXT NULL,
    `recordingUrl` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `VideoConsultation_appointmentId_key`(`appointmentId`),
    INDEX `VideoConsultation_hospitalId_idx`(`hospitalId`),
    INDEX `VideoConsultation_doctorId_idx`(`doctorId`),
    INDEX `VideoConsultation_patientId_idx`(`patientId`),
    INDEX `VideoConsultation_status_idx`(`status`),
    INDEX `VideoConsultation_scheduledAt_idx`(`scheduledAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `MarketingAutomation` (
    `id` VARCHAR(191) NOT NULL,
    `hospitalId` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `trigger` JSON NOT NULL,
    `action` JSON NOT NULL,
    `isActive` BOOLEAN NOT NULL DEFAULT true,
    `lastRunAt` DATETIME(3) NULL,
    `runCount` INTEGER NOT NULL DEFAULT 0,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `MarketingAutomation_hospitalId_idx`(`hospitalId`),
    INDEX `MarketingAutomation_isActive_idx`(`isActive`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Instrument` (
    `id` VARCHAR(191) NOT NULL,
    `hospitalId` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `category` VARCHAR(191) NOT NULL,
    `serialNumber` VARCHAR(191) NULL,
    `rfidTag` VARCHAR(191) NULL,
    `status` ENUM('AVAILABLE', 'IN_USE', 'STERILIZING', 'CONTAMINATED', 'MAINTENANCE', 'RETIRED') NOT NULL DEFAULT 'AVAILABLE',
    `location` VARCHAR(191) NULL,
    `lastSterilizedAt` DATETIME(3) NULL,
    `sterilizationCycleCount` INTEGER NOT NULL DEFAULT 0,
    `maxCycles` INTEGER NULL,
    `purchaseDate` DATETIME(3) NULL,
    `warrantyDate` DATETIME(3) NULL,
    `notes` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `Instrument_hospitalId_idx`(`hospitalId`),
    INDEX `Instrument_status_idx`(`status`),
    INDEX `Instrument_rfidTag_idx`(`rfidTag`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `SterilizationLog` (
    `id` VARCHAR(191) NOT NULL,
    `hospitalId` VARCHAR(191) NOT NULL,
    `instrumentId` VARCHAR(191) NOT NULL,
    `cycleNumber` INTEGER NOT NULL,
    `method` VARCHAR(191) NOT NULL,
    `machineId` VARCHAR(191) NULL,
    `temperature` DECIMAL(5, 1) NULL,
    `pressure` DECIMAL(5, 2) NULL,
    `duration` INTEGER NULL,
    `operatorId` VARCHAR(191) NOT NULL,
    `result` ENUM('PASS', 'FAIL', 'PENDING') NOT NULL DEFAULT 'PASS',
    `biologicalIndicator` BOOLEAN NOT NULL DEFAULT false,
    `chemicalIndicator` BOOLEAN NOT NULL DEFAULT false,
    `notes` VARCHAR(191) NULL,
    `startedAt` DATETIME(3) NOT NULL,
    `completedAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `SterilizationLog_hospitalId_idx`(`hospitalId`),
    INDEX `SterilizationLog_instrumentId_idx`(`instrumentId`),
    INDEX `SterilizationLog_startedAt_idx`(`startedAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Device` (
    `id` VARCHAR(191) NOT NULL,
    `hospitalId` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `type` VARCHAR(191) NOT NULL,
    `serialNumber` VARCHAR(191) NULL,
    `location` VARCHAR(191) NULL,
    `status` ENUM('ONLINE', 'OFFLINE', 'ERROR', 'MAINTENANCE') NOT NULL DEFAULT 'OFFLINE',
    `lastPingAt` DATETIME(3) NULL,
    `ipAddress` VARCHAR(191) NULL,
    `firmwareVersion` VARCHAR(191) NULL,
    `metadata` JSON NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `Device_hospitalId_idx`(`hospitalId`),
    INDEX `Device_status_idx`(`status`),
    INDEX `Device_type_idx`(`type`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `DeviceDataLog` (
    `id` VARCHAR(191) NOT NULL,
    `deviceId` VARCHAR(191) NOT NULL,
    `data` JSON NOT NULL,
    `eventType` VARCHAR(191) NULL,
    `timestamp` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `DeviceDataLog_deviceId_idx`(`deviceId`),
    INDEX `DeviceDataLog_timestamp_idx`(`timestamp`),
    INDEX `DeviceDataLog_eventType_idx`(`eventType`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `PushDevice` (
    `id` VARCHAR(191) NOT NULL,
    `token` VARCHAR(191) NOT NULL,
    `platform` VARCHAR(191) NOT NULL,
    `deviceName` VARCHAR(191) NULL,
    `isActive` BOOLEAN NOT NULL DEFAULT true,
    `userId` VARCHAR(191) NOT NULL,
    `hospitalId` VARCHAR(191) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `PushDevice_token_key`(`token`),
    INDEX `PushDevice_userId_idx`(`userId`),
    INDEX `PushDevice_hospitalId_idx`(`hospitalId`),
    INDEX `PushDevice_isActive_idx`(`isActive`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `DataImportJob` (
    `id` VARCHAR(191) NOT NULL,
    `hospitalId` VARCHAR(191) NOT NULL,
    `userId` VARCHAR(191) NOT NULL,
    `fileName` VARCHAR(191) NOT NULL,
    `fileType` VARCHAR(191) NOT NULL,
    `filePath` VARCHAR(191) NOT NULL,
    `entityType` VARCHAR(191) NOT NULL,
    `status` ENUM('UPLOADED', 'MAPPED', 'VALIDATED', 'IMPORTING', 'COMPLETED', 'FAILED', 'CANCELLED') NOT NULL DEFAULT 'UPLOADED',
    `sourceColumns` JSON NULL,
    `columnMapping` JSON NULL,
    `previewData` JSON NULL,
    `validationErrors` JSON NULL,
    `totalRows` INTEGER NOT NULL DEFAULT 0,
    `successCount` INTEGER NOT NULL DEFAULT 0,
    `errorCount` INTEGER NOT NULL DEFAULT 0,
    `signedOffAt` DATETIME(3) NULL,
    `completedAt` DATETIME(3) NULL,
    `errorLog` LONGTEXT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `DataImportJob_hospitalId_idx`(`hospitalId`),
    INDEX `DataImportJob_status_idx`(`status`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateIndex
CREATE UNIQUE INDEX `EmailLog_trackingId_key` ON `EmailLog`(`trackingId`);

-- CreateIndex
CREATE INDEX `Payment_gatewayOrderId_idx` ON `Payment`(`gatewayOrderId`);

-- AddForeignKey
ALTER TABLE `InsuranceClaim` ADD CONSTRAINT `InsuranceClaim_patientId_fkey` FOREIGN KEY (`patientId`) REFERENCES `Patient`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `InsuranceProviderMaster` ADD CONSTRAINT `InsuranceProviderMaster_hospitalId_fkey` FOREIGN KEY (`hospitalId`) REFERENCES `Hospital`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `PatientInsurance` ADD CONSTRAINT `PatientInsurance_hospitalId_fkey` FOREIGN KEY (`hospitalId`) REFERENCES `Hospital`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `PatientInsurance` ADD CONSTRAINT `PatientInsurance_patientId_fkey` FOREIGN KEY (`patientId`) REFERENCES `Patient`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `PatientInsurance` ADD CONSTRAINT `PatientInsurance_providerId_fkey` FOREIGN KEY (`providerId`) REFERENCES `InsuranceProviderMaster`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `PreAuthorization` ADD CONSTRAINT `PreAuthorization_hospitalId_fkey` FOREIGN KEY (`hospitalId`) REFERENCES `Hospital`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `PreAuthorization` ADD CONSTRAINT `PreAuthorization_patientId_fkey` FOREIGN KEY (`patientId`) REFERENCES `Patient`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `PreAuthorization` ADD CONSTRAINT `PreAuthorization_insurancePolicyId_fkey` FOREIGN KEY (`insurancePolicyId`) REFERENCES `PatientInsurance`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `PaymentGatewayConfig` ADD CONSTRAINT `PaymentGatewayConfig_hospitalId_fkey` FOREIGN KEY (`hospitalId`) REFERENCES `Hospital`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `PaymentLink` ADD CONSTRAINT `PaymentLink_hospitalId_fkey` FOREIGN KEY (`hospitalId`) REFERENCES `Hospital`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `PaymentLink` ADD CONSTRAINT `PaymentLink_invoiceId_fkey` FOREIGN KEY (`invoiceId`) REFERENCES `Invoice`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `AIConversation` ADD CONSTRAINT `AIConversation_hospitalId_fkey` FOREIGN KEY (`hospitalId`) REFERENCES `Hospital`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `AIConversation` ADD CONSTRAINT `AIConversation_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `AISkillExecution` ADD CONSTRAINT `AISkillExecution_hospitalId_fkey` FOREIGN KEY (`hospitalId`) REFERENCES `Hospital`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `AIInsight` ADD CONSTRAINT `AIInsight_hospitalId_fkey` FOREIGN KEY (`hospitalId`) REFERENCES `Hospital`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `PatientRiskScore` ADD CONSTRAINT `PatientRiskScore_patientId_fkey` FOREIGN KEY (`patientId`) REFERENCES `Patient`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `PatientRiskScore` ADD CONSTRAINT `PatientRiskScore_hospitalId_fkey` FOREIGN KEY (`hospitalId`) REFERENCES `Hospital`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `FormTemplate` ADD CONSTRAINT `FormTemplate_hospitalId_fkey` FOREIGN KEY (`hospitalId`) REFERENCES `Hospital`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `FormSubmission` ADD CONSTRAINT `FormSubmission_hospitalId_fkey` FOREIGN KEY (`hospitalId`) REFERENCES `Hospital`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `FormSubmission` ADD CONSTRAINT `FormSubmission_templateId_fkey` FOREIGN KEY (`templateId`) REFERENCES `FormTemplate`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `PatientOTP` ADD CONSTRAINT `PatientOTP_hospitalId_fkey` FOREIGN KEY (`hospitalId`) REFERENCES `Hospital`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `MembershipPlan` ADD CONSTRAINT `MembershipPlan_hospitalId_fkey` FOREIGN KEY (`hospitalId`) REFERENCES `Hospital`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `PatientMembership` ADD CONSTRAINT `PatientMembership_hospitalId_fkey` FOREIGN KEY (`hospitalId`) REFERENCES `Hospital`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `PatientMembership` ADD CONSTRAINT `PatientMembership_patientId_fkey` FOREIGN KEY (`patientId`) REFERENCES `Patient`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `PatientMembership` ADD CONSTRAINT `PatientMembership_planId_fkey` FOREIGN KEY (`planId`) REFERENCES `MembershipPlan`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Referral` ADD CONSTRAINT `Referral_hospitalId_fkey` FOREIGN KEY (`hospitalId`) REFERENCES `Hospital`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `LoyaltyTransaction` ADD CONSTRAINT `LoyaltyTransaction_hospitalId_fkey` FOREIGN KEY (`hospitalId`) REFERENCES `Hospital`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `CalendarIntegration` ADD CONSTRAINT `CalendarIntegration_hospitalId_fkey` FOREIGN KEY (`hospitalId`) REFERENCES `Hospital`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `CalendarIntegration` ADD CONSTRAINT `CalendarIntegration_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Waitlist` ADD CONSTRAINT `Waitlist_hospitalId_fkey` FOREIGN KEY (`hospitalId`) REFERENCES `Hospital`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `PaymentPlan` ADD CONSTRAINT `PaymentPlan_hospitalId_fkey` FOREIGN KEY (`hospitalId`) REFERENCES `Hospital`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `PaymentPlan` ADD CONSTRAINT `PaymentPlan_invoiceId_fkey` FOREIGN KEY (`invoiceId`) REFERENCES `Invoice`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `PaymentPlan` ADD CONSTRAINT `PaymentPlan_patientId_fkey` FOREIGN KEY (`patientId`) REFERENCES `Patient`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `PaymentPlanSchedule` ADD CONSTRAINT `PaymentPlanSchedule_planId_fkey` FOREIGN KEY (`planId`) REFERENCES `PaymentPlan`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `VideoConsultation` ADD CONSTRAINT `VideoConsultation_hospitalId_fkey` FOREIGN KEY (`hospitalId`) REFERENCES `Hospital`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `VideoConsultation` ADD CONSTRAINT `VideoConsultation_appointmentId_fkey` FOREIGN KEY (`appointmentId`) REFERENCES `Appointment`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `VideoConsultation` ADD CONSTRAINT `VideoConsultation_patientId_fkey` FOREIGN KEY (`patientId`) REFERENCES `Patient`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `VideoConsultation` ADD CONSTRAINT `VideoConsultation_doctorId_fkey` FOREIGN KEY (`doctorId`) REFERENCES `Staff`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `MarketingAutomation` ADD CONSTRAINT `MarketingAutomation_hospitalId_fkey` FOREIGN KEY (`hospitalId`) REFERENCES `Hospital`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Instrument` ADD CONSTRAINT `Instrument_hospitalId_fkey` FOREIGN KEY (`hospitalId`) REFERENCES `Hospital`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `SterilizationLog` ADD CONSTRAINT `SterilizationLog_hospitalId_fkey` FOREIGN KEY (`hospitalId`) REFERENCES `Hospital`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `SterilizationLog` ADD CONSTRAINT `SterilizationLog_instrumentId_fkey` FOREIGN KEY (`instrumentId`) REFERENCES `Instrument`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Device` ADD CONSTRAINT `Device_hospitalId_fkey` FOREIGN KEY (`hospitalId`) REFERENCES `Hospital`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `DeviceDataLog` ADD CONSTRAINT `DeviceDataLog_deviceId_fkey` FOREIGN KEY (`deviceId`) REFERENCES `Device`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `PushDevice` ADD CONSTRAINT `PushDevice_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `PushDevice` ADD CONSTRAINT `PushDevice_hospitalId_fkey` FOREIGN KEY (`hospitalId`) REFERENCES `Hospital`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `DataImportJob` ADD CONSTRAINT `DataImportJob_hospitalId_fkey` FOREIGN KEY (`hospitalId`) REFERENCES `Hospital`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `DataImportJob` ADD CONSTRAINT `DataImportJob_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

