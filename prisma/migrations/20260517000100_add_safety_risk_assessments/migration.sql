CREATE TABLE `SafetyRiskAssessment` (
  `id` VARCHAR(191) NOT NULL,
  `employeeName` VARCHAR(191) NOT NULL,
  `taskName` VARCHAR(191) NOT NULL,
  `workArea` VARCHAR(191) NOT NULL,
  `assessmentDate` DATETIME(3) NOT NULL,
  `answers` JSON NOT NULL,
  `createdById` VARCHAR(191) NOT NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL,

  INDEX `SafetyRiskAssessment_assessmentDate_idx`(`assessmentDate`),
  INDEX `SafetyRiskAssessment_createdAt_idx`(`createdAt`),
  INDEX `SafetyRiskAssessment_createdById_createdAt_idx`(`createdById`, `createdAt`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE `SafetyRiskAssessment`
  ADD CONSTRAINT `SafetyRiskAssessment_createdById_fkey`
  FOREIGN KEY (`createdById`) REFERENCES `User`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
