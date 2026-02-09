/*
  Warnings:

  - The primary key for the `User` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - You are about to drop the column `createdAt` on the `User` table. All the data in the column will be lost.
  - You are about to drop the column `email` on the `User` table. All the data in the column will be lost.
  - You are about to drop the column `id` on the `User` table. All the data in the column will be lost.
  - You are about to drop the column `name` on the `User` table. All the data in the column will be lost.
  - You are about to drop the column `password` on the `User` table. All the data in the column will be lost.
  - You are about to drop the column `updatedAt` on the `User` table. All the data in the column will be lost.
  - A unique constraint covering the columns `[Username]` on the table `User` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[Email]` on the table `User` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `Email` to the `User` table without a default value. This is not possible if the table is not empty.
  - Added the required column `Password` to the `User` table without a default value. This is not possible if the table is not empty.
  - Added the required column `Username` to the `User` table without a default value. This is not possible if the table is not empty.

*/
-- DropIndex
DROP INDEX "User_email_key";

-- AlterTable
ALTER TABLE "User" DROP CONSTRAINT "User_pkey",
DROP COLUMN "createdAt",
DROP COLUMN "email",
DROP COLUMN "id",
DROP COLUMN "name",
DROP COLUMN "password",
DROP COLUMN "updatedAt",
ADD COLUMN     "CreatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "Email" TEXT NOT NULL,
ADD COLUMN     "LastLogin" TIMESTAMP(3),
ADD COLUMN     "Password" TEXT NOT NULL,
ADD COLUMN     "Role" TEXT NOT NULL DEFAULT 'student',
ADD COLUMN     "UserID" SERIAL NOT NULL,
ADD COLUMN     "Username" TEXT NOT NULL,
ADD CONSTRAINT "User_pkey" PRIMARY KEY ("UserID");

-- CreateIndex
CREATE UNIQUE INDEX "User_Username_key" ON "User"("Username");

-- CreateIndex
CREATE UNIQUE INDEX "User_Email_key" ON "User"("Email");
