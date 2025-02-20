-- DropIndex
DROP INDEX `Mesh_taskId_key` ON `mesh`;

-- AlterTable
ALTER TABLE `mesh` ADD COLUMN `apiKeyId` VARCHAR(191) NULL,
    MODIFY `taskId` VARCHAR(100) NULL;

-- CreateTable
CREATE TABLE `ApiKey` (
    `id` VARCHAR(191) NOT NULL,
    `keyHash` VARCHAR(255) NOT NULL,
    `activeTasks` INTEGER NOT NULL DEFAULT 0,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `ApiKey_keyHash_key`(`keyHash`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `Mesh` ADD CONSTRAINT `Mesh_apiKeyId_fkey` FOREIGN KEY (`apiKeyId`) REFERENCES `ApiKey`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
