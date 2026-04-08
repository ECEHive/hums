-- CreateEnum
CREATE TYPE "TransactionRateLimitPeriod" AS ENUM ('day', 'week', 'month', 'semester');

-- AlterTable
ALTER TABLE "Item" ADD COLUMN     "transactionRateLimitPeriod" "TransactionRateLimitPeriod";
