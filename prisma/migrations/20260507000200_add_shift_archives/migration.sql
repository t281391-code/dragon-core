-- CreateTable
CREATE TABLE `ShiftArchive` (
    `id` VARCHAR(191) NOT NULL,
    `startDate` VARCHAR(191) NOT NULL,
    `endDate` VARCHAR(191) NOT NULL,
    `title` VARCHAR(191) NOT NULL,
    `snapshot` JSON NOT NULL,
    `createdById` VARCHAR(191) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `ShiftArchive_startDate_endDate_key`(`startDate`, `endDate`),
    INDEX `ShiftArchive_createdAt_idx`(`createdAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `ShiftArchive` ADD CONSTRAINT `ShiftArchive_createdById_fkey` FOREIGN KEY (`createdById`) REFERENCES `User`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
