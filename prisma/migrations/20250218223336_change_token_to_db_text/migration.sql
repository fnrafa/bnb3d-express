-- DropIndex
DROP INDEX `Session_token_key` ON `session`;

-- AlterTable
ALTER TABLE `session` MODIFY `token` TEXT NOT NULL;
