/*
  Warnings:

  - A unique constraint covering the columns `[slackUsername]` on the table `User` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterTable
ALTER TABLE "User" ADD COLUMN     "slackUsername" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "User_slackUsername_key" ON "User"("slackUsername");
