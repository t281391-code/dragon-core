-- CreateTable
CREATE TABLE `DailyProductionPlan` (
    `id` VARCHAR(191) NOT NULL,
    `planDate` DATETIME(3) NOT NULL,
    `targetQuantity` DOUBLE NOT NULL,
    `createdById` VARCHAR(191) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `DailyProductionPlan_planDate_key`(`planDate`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
