ALTER TABLE `ProductionLog`
  ADD COLUMN `updatedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3);

CREATE TABLE `Equipment` (
  `id` VARCHAR(191) NOT NULL,
  `name` VARCHAR(191) NOT NULL,
  `type` VARCHAR(191) NOT NULL,
  `maxRpm` DOUBLE NOT NULL,
  `department` VARCHAR(191) NOT NULL,
  `isActive` BOOLEAN NOT NULL DEFAULT true,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),

  UNIQUE INDEX `Equipment_name_key`(`name`),
  INDEX `Equipment_department_isActive_idx`(`department`, `isActive`),
  INDEX `Equipment_type_idx`(`type`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `EquipmentTelemetryLog` (
  `id` VARCHAR(191) NOT NULL,
  `productionLogId` VARCHAR(191) NOT NULL,
  `equipmentId` VARCHAR(191) NOT NULL,
  `rpm` DOUBLE NOT NULL,
  `maxRpm` DOUBLE NOT NULL,
  `loadPercent` DOUBLE NOT NULL,
  `temperature` DOUBLE NULL,
  `pressure` DOUBLE NULL,
  `vibration` DOUBLE NULL,
  `status` VARCHAR(191) NOT NULL,
  `note` TEXT NULL,
  `recordedAt` DATETIME(3) NOT NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

  INDEX `EquipmentTelemetryLog_recordedAt_idx`(`recordedAt`),
  INDEX `EquipmentTelemetryLog_equipmentId_recordedAt_idx`(`equipmentId`, `recordedAt`),
  INDEX `EquipmentTelemetryLog_productionLogId_idx`(`productionLogId`),
  INDEX `EquipmentTelemetryLog_status_recordedAt_idx`(`status`, `recordedAt`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE `EquipmentTelemetryLog`
  ADD CONSTRAINT `EquipmentTelemetryLog_productionLogId_fkey`
  FOREIGN KEY (`productionLogId`) REFERENCES `ProductionLog`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE `EquipmentTelemetryLog`
  ADD CONSTRAINT `EquipmentTelemetryLog_equipmentId_fkey`
  FOREIGN KEY (`equipmentId`) REFERENCES `Equipment`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
