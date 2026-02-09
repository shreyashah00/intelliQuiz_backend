/*
  Warnings:

  - You are about to drop the `User` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropTable
DROP TABLE "User";

-- CreateTable
CREATE TABLE "users" (
    "UserID" SERIAL NOT NULL,
    "Username" TEXT NOT NULL,
    "Email" TEXT NOT NULL,
    "Password" TEXT NOT NULL,
    "Role" TEXT NOT NULL DEFAULT 'student',
    "FirstName" TEXT,
    "LastName" TEXT,
    "PhoneNumber" TEXT,
    "ProfilePicture" TEXT,
    "Bio" TEXT,
    "DateOfBirth" TIMESTAMP(3),
    "Gender" TEXT,
    "Address" TEXT,
    "City" TEXT,
    "Country" TEXT,
    "EmailVerified" BOOLEAN NOT NULL DEFAULT false,
    "OTP" TEXT,
    "OTPExpiry" TIMESTAMP(3),
    "OTPAttempts" INTEGER NOT NULL DEFAULT 0,
    "AccountStatus" TEXT NOT NULL DEFAULT 'active',
    "LastPasswordReset" TIMESTAMP(3),
    "RefreshToken" TEXT,
    "CreatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "UpdatedAt" TIMESTAMP(3) NOT NULL,
    "LastLogin" TIMESTAMP(3),

    CONSTRAINT "users_pkey" PRIMARY KEY ("UserID")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_Username_key" ON "users"("Username");

-- CreateIndex
CREATE UNIQUE INDEX "users_Email_key" ON "users"("Email");

-- CreateIndex
CREATE INDEX "users_Email_idx" ON "users"("Email");

-- CreateIndex
CREATE INDEX "users_Username_idx" ON "users"("Username");

-- CreateIndex
CREATE INDEX "users_Role_idx" ON "users"("Role");
