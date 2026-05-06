CREATE TABLE `AiAgentAuditLog` (
  `id` VARCHAR(191) NOT NULL,
  `userId` VARCHAR(191) NOT NULL,
  `toolName` VARCHAR(191) NOT NULL,
  `actionType` VARCHAR(32) NOT NULL,
  `success` BOOLEAN NOT NULL DEFAULT false,
  `summary` TEXT NOT NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

  INDEX `AiAgentAuditLog_userId_createdAt_idx`(`userId`, `createdAt`),
  INDEX `AiAgentAuditLog_toolName_createdAt_idx`(`toolName`, `createdAt`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE `AiAgentAuditLog`
ADD CONSTRAINT `AiAgentAuditLog_userId_fkey`
FOREIGN KEY (`userId`) REFERENCES `User`(`id`)
ON DELETE RESTRICT ON UPDATE CASCADE;
