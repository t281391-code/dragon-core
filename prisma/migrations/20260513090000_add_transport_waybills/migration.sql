CREATE TABLE `TransportWaybill` (
    `id` VARCHAR(191) NOT NULL,
    `title` VARCHAR(191) NOT NULL,
    `header` JSON NOT NULL,
    `rows` JSON NOT NULL,
    `reportDate` DATETIME(3) NOT NULL,
    `createdById` VARCHAR(191) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `TransportWaybill_reportDate_idx`(`reportDate`),
    INDEX `TransportWaybill_createdAt_idx`(`createdAt`),
    INDEX `TransportWaybill_createdById_createdAt_idx`(`createdById`, `createdAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE `TransportWaybill` ADD CONSTRAINT `TransportWaybill_createdById_fkey` FOREIGN KEY (`createdById`) REFERENCES `User`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
