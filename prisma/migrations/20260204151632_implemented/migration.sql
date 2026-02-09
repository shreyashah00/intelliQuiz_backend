/*
  Warnings:

  - You are about to drop the `file_chunks` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `files` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "file_chunks" DROP CONSTRAINT "file_chunks_FileID_fkey";

-- DropForeignKey
ALTER TABLE "files" DROP CONSTRAINT "files_UserID_fkey";

-- DropTable
DROP TABLE "file_chunks";

-- DropTable
DROP TABLE "files";
