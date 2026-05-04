-- Add indexes used by dashboard list, filter, and chart queries.
CREATE INDEX `User_isActive_fullName_idx` ON `User`(`isActive`, `fullName`);
CREATE INDEX `Material_name_idx` ON `Material`(`name`);
CREATE INDEX `MaterialTransaction_transactionDate_idx` ON `MaterialTransaction`(`transactionDate`);
CREATE INDEX `MaterialTransaction_type_transactionDate_idx` ON `MaterialTransaction`(`type`, `transactionDate`);
CREATE INDEX `MaterialTransaction_materialId_transactionDate_idx` ON `MaterialTransaction`(`materialId`, `transactionDate`);
CREATE INDEX `ProductionLog_productionDate_idx` ON `ProductionLog`(`productionDate`);
CREATE INDEX `ProductionLog_scheduledDate_idx` ON `ProductionLog`(`scheduledDate`);
CREATE INDEX `ProductionLog_materialId_productionDate_idx` ON `ProductionLog`(`materialId`, `productionDate`);
CREATE INDEX `SafetyIncident_incidentDate_idx` ON `SafetyIncident`(`incidentDate`);
CREATE INDEX `SafetyIncident_status_incidentDate_idx` ON `SafetyIncident`(`status`, `incidentDate`);
CREATE INDEX `Transport_transportDate_idx` ON `Transport`(`transportDate`);
CREATE INDEX `Transport_status_transportDate_idx` ON `Transport`(`status`, `transportDate`);
CREATE INDEX `Transport_materialId_transportDate_idx` ON `Transport`(`materialId`, `transportDate`);
