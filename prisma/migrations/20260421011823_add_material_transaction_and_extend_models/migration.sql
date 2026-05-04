/*
  Warnings:

  - Added the required column `lotNumber` to the `ProductionLog` table without a default value. This is not possible if the table is not empty.
  - Added the required column `productName` to the `ProductionLog` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE `Material` ADD COLUMN `maximumStock` DOUBLE NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE `ProductionLog` ADD COLUMN `destinationMine` VARCHAR(191) NULL,
    ADD COLUMN `lotNumber` VARCHAR(191) NOT NULL,
    ADD COLUMN `note` TEXT NULL,
    ADD COLUMN `productName` VARCHAR(191) NOT NULL,
    ADD COLUMN `scheduledDate` DATETIME(3) NULL,
    ADD COLUMN `status` VARCHAR(191) NOT NULL DEFAULT 'ready',
    MODIFY `shift` VARCHAR(191) NOT NULL DEFAULT 'өдрийн',
    MODIFY `quantityUsed` DOUBLE NOT NULL DEFAULT 0,
    MODIFY `downtimeMinutes` INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE `SafetyIncident` MODIFY `status` VARCHAR(191) NOT NULL DEFAULT 'open';

-- AlterTable
ALTER TABLE `Transport` ADD COLUMN `note` VARCHAR(191) NULL;

-- CreateTable
CREATE TABLE `MaterialTransaction` (
    `id` VARCHAR(191) NOT NULL,
    `materialId` VARCHAR(191) NOT NULL,
    `type` VARCHAR(191) NOT NULL,
    `quantity` DOUBLE NOT NULL,
    `note` VARCHAR(191) NULL,
    `transactionDate` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `createdById` VARCHAR(191) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `MaterialTransaction` ADD CONSTRAINT `MaterialTransaction_materialId_fkey` FOREIGN KEY (`materialId`) REFERENCES `Material`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `MaterialTransaction` ADD CONSTRAINT `MaterialTransaction_createdById_fkey` FOREIGN KEY (`createdById`) REFERENCES `User`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
