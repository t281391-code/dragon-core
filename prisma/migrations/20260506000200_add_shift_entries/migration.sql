-- CreateTable
CREATE TABLE IF NOT EXISTS `ShiftEntry` (
    `id` VARCHAR(191) NOT NULL,
    `userId` VARCHAR(191) NOT NULL,
    `date` VARCHAR(191) NOT NULL,
    `shiftCode` VARCHAR(191) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `ShiftEntry_userId_date_key`(`userId`, `date`),
    INDEX `ShiftEntry_date_idx`(`date`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey if it is missing. This migration may run against databases
-- where ShiftEntry was created manually before Prisma migration history existed.
SET @shiftEntryFkCount = (
    SELECT COUNT(*)
    FROM information_schema.KEY_COLUMN_USAGE
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = 'ShiftEntry'
      AND CONSTRAINT_NAME = 'ShiftEntry_userId_fkey'
);

SET @shiftEntryFkSql = IF(
    @shiftEntryFkCount = 0,
    'ALTER TABLE `ShiftEntry` ADD CONSTRAINT `ShiftEntry_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE',
    'SELECT 1'
);

PREPARE shiftEntryFkStmt FROM @shiftEntryFkSql;
EXECUTE shiftEntryFkStmt;
DEALLOCATE PREPARE shiftEntryFkStmt;
