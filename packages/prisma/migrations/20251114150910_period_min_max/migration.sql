-- CreateEnum
CREATE TYPE "MinMaxUnit" AS ENUM ('count', 'minutes', 'hours');

-- AlterTable
ALTER TABLE "Period" ADD COLUMN     "max" INTEGER,
ADD COLUMN     "min" INTEGER,
ADD COLUMN     "minMaxUnit" "MinMaxUnit";
