ALTER TABLE `User` ADD COLUMN `mrCode` VARCHAR(191) NULL;

CREATE UNIQUE INDEX `User_mrCode_key` ON `User`(`mrCode`);
