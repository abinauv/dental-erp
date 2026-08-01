-- AlterTable
ALTER TABLE `InventoryItem` ADD COLUMN `deletedAt` DATETIME(3) NULL,
    ADD COLUMN `hsnCode` VARCHAR(191) NULL,
    ADD COLUMN `imageUrl` VARCHAR(191) NULL,
    ADD COLUMN `itemType` ENUM('DENTAL_MATERIAL', 'INSTRUMENT', 'CONSUMABLE', 'MEDICINE', 'OFFICE_SUPPLY', 'EQUIPMENT') NOT NULL DEFAULT 'DENTAL_MATERIAL',
    ADD COLUMN `notes` TEXT NULL,
    ADD COLUMN `preferredSupplierId` VARCHAR(191) NULL,
    ADD COLUMN `taxPercentage` DECIMAL(5, 2) NULL;

-- AlterTable
ALTER TABLE `StockTransaction` ADD COLUMN `batchId` VARCHAR(191) NULL,
    ADD COLUMN `fromLocation` VARCHAR(191) NULL,
    ADD COLUMN `supplierId` VARCHAR(191) NULL,
    ADD COLUMN `toLocation` VARCHAR(191) NULL,
    ADD COLUMN `transactionDate` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3);

-- AlterTable
ALTER TABLE `Supplier` ADD COLUMN `creditLimit` DECIMAL(12, 2) NULL,
    ADD COLUMN `deletedAt` DATETIME(3) NULL,
    ADD COLUMN `notes` TEXT NULL,
    ADD COLUMN `status` ENUM('ACTIVE', 'INACTIVE', 'BLOCKED') NOT NULL DEFAULT 'ACTIVE';

-- AlterTable
ALTER TABLE `PurchaseOrder` ADD COLUMN `deletedAt` DATETIME(3) NULL;

-- AlterTable
ALTER TABLE `LabVendor` ADD COLUMN `alternatePhone` VARCHAR(191) NULL,
    ADD COLUMN `city` VARCHAR(191) NULL,
    ADD COLUMN `code` VARCHAR(191) NULL,
    ADD COLUMN `creditLimit` DECIMAL(12, 2) NULL,
    ADD COLUMN `deletedAt` DATETIME(3) NULL,
    ADD COLUMN `gstNumber` VARCHAR(191) NULL,
    ADD COLUMN `notes` TEXT NULL,
    ADD COLUMN `panNumber` VARCHAR(191) NULL,
    ADD COLUMN `paymentTerms` VARCHAR(191) NULL,
    ADD COLUMN `pincode` VARCHAR(191) NULL,
    ADD COLUMN `state` VARCHAR(191) NULL,
    ADD COLUMN `status` ENUM('ACTIVE', 'INACTIVE', 'BLOCKED') NOT NULL DEFAULT 'ACTIVE';

-- AlterTable
ALTER TABLE `LabOrder` ADD COLUMN `createdBy` VARCHAR(191) NULL,
    ADD COLUMN `deletedAt` DATETIME(3) NULL,
    ADD COLUMN `priority` ENUM('NORMAL', 'URGENT') NOT NULL DEFAULT 'NORMAL',
    ADD COLUMN `specialInstructions` TEXT NULL;

-- CreateTable
CREATE TABLE `StockAlert` (
    `id` VARCHAR(191) NOT NULL,
    `hospitalId` VARCHAR(191) NOT NULL,
    `itemId` VARCHAR(191) NOT NULL,
    `alertType` ENUM('OUT_OF_STOCK', 'LOW_STOCK', 'EXPIRING_SOON', 'EXPIRED') NOT NULL,
    `alertDate` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `isAcknowledged` BOOLEAN NOT NULL DEFAULT false,
    `acknowledgedBy` VARCHAR(191) NULL,
    `acknowledgedAt` DATETIME(3) NULL,
    `notes` TEXT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `StockAlert_hospitalId_idx`(`hospitalId`),
    INDEX `StockAlert_itemId_idx`(`itemId`),
    INDEX `StockAlert_alertType_idx`(`alertType`),
    INDEX `StockAlert_isAcknowledged_idx`(`isAcknowledged`),
    INDEX `StockAlert_alertDate_idx`(`alertDate`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `LabOrderHistory` (
    `id` VARCHAR(191) NOT NULL,
    `labOrderId` VARCHAR(191) NOT NULL,
    `statusFrom` ENUM('CREATED', 'SENT_TO_LAB', 'IN_PROGRESS', 'QUALITY_CHECK', 'READY', 'DELIVERED', 'FITTED', 'REMAKE_REQUIRED', 'CANCELLED') NULL,
    `statusTo` ENUM('CREATED', 'SENT_TO_LAB', 'IN_PROGRESS', 'QUALITY_CHECK', 'READY', 'DELIVERED', 'FITTED', 'REMAKE_REQUIRED', 'CANCELLED') NOT NULL,
    `changedBy` VARCHAR(191) NULL,
    `notes` TEXT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `LabOrderHistory_labOrderId_idx`(`labOrderId`),
    INDEX `LabOrderHistory_createdAt_idx`(`createdAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `LabOrderDocument` (
    `id` VARCHAR(191) NOT NULL,
    `labOrderId` VARCHAR(191) NOT NULL,
    `fileName` VARCHAR(191) NOT NULL,
    `fileUrl` VARCHAR(191) NOT NULL,
    `fileType` VARCHAR(191) NULL,
    `fileSize` INTEGER NULL,
    `documentType` VARCHAR(191) NULL,
    `uploadedBy` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `LabOrderDocument_labOrderId_idx`(`labOrderId`),
    INDEX `LabOrderDocument_createdAt_idx`(`createdAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateIndex
CREATE INDEX `InventoryItem_deletedAt_idx` ON `InventoryItem`(`deletedAt`);

-- CreateIndex
CREATE INDEX `InventoryItem_itemType_idx` ON `InventoryItem`(`itemType`);

-- CreateIndex
CREATE INDEX `InventoryItem_preferredSupplierId_idx` ON `InventoryItem`(`preferredSupplierId`);

-- CreateIndex
CREATE INDEX `StockTransaction_transactionDate_idx` ON `StockTransaction`(`transactionDate`);

-- CreateIndex
CREATE INDEX `StockTransaction_batchId_idx` ON `StockTransaction`(`batchId`);

-- CreateIndex
CREATE INDEX `StockTransaction_supplierId_idx` ON `StockTransaction`(`supplierId`);

-- CreateIndex
CREATE INDEX `Supplier_status_idx` ON `Supplier`(`status`);

-- CreateIndex
CREATE INDEX `Supplier_deletedAt_idx` ON `Supplier`(`deletedAt`);

-- CreateIndex
CREATE INDEX `PurchaseOrder_deletedAt_idx` ON `PurchaseOrder`(`deletedAt`);

-- CreateIndex
CREATE INDEX `LabVendor_status_idx` ON `LabVendor`(`status`);

-- CreateIndex
CREATE INDEX `LabVendor_deletedAt_idx` ON `LabVendor`(`deletedAt`);

-- CreateIndex
CREATE INDEX `LabOrder_deletedAt_idx` ON `LabOrder`(`deletedAt`);

-- AddForeignKey
ALTER TABLE `InventoryItem` ADD CONSTRAINT `InventoryItem_preferredSupplierId_fkey` FOREIGN KEY (`preferredSupplierId`) REFERENCES `Supplier`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `StockTransaction` ADD CONSTRAINT `StockTransaction_batchId_fkey` FOREIGN KEY (`batchId`) REFERENCES `InventoryBatch`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `StockTransaction` ADD CONSTRAINT `StockTransaction_supplierId_fkey` FOREIGN KEY (`supplierId`) REFERENCES `Supplier`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `StockAlert` ADD CONSTRAINT `StockAlert_hospitalId_fkey` FOREIGN KEY (`hospitalId`) REFERENCES `Hospital`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `StockAlert` ADD CONSTRAINT `StockAlert_itemId_fkey` FOREIGN KEY (`itemId`) REFERENCES `InventoryItem`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `StockAlert` ADD CONSTRAINT `StockAlert_acknowledgedBy_fkey` FOREIGN KEY (`acknowledgedBy`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `LabOrderHistory` ADD CONSTRAINT `LabOrderHistory_labOrderId_fkey` FOREIGN KEY (`labOrderId`) REFERENCES `LabOrder`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `LabOrderHistory` ADD CONSTRAINT `LabOrderHistory_changedBy_fkey` FOREIGN KEY (`changedBy`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `LabOrderDocument` ADD CONSTRAINT `LabOrderDocument_labOrderId_fkey` FOREIGN KEY (`labOrderId`) REFERENCES `LabOrder`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `LabOrderDocument` ADD CONSTRAINT `LabOrderDocument_uploadedBy_fkey` FOREIGN KEY (`uploadedBy`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

