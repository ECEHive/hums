-- Enable pgvector extension for vector similarity search
CREATE EXTENSION IF NOT EXISTS vector;

-- CreateEnum
CREATE TYPE "SecurityEventType" AS ENUM ('TAP_IN', 'TAP_OUT', 'FACE_ID_LOGIN', 'FACE_ID_ENROLLMENT');

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "faceIdEnabled" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "FaceEnrollment" (
    "id" SERIAL NOT NULL,
    "userId" INTEGER NOT NULL,
    "faceEmbedding" vector(128),
    "enrolledAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastUsedAt" TIMESTAMP(3),
    "successfulMatches" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FaceEnrollment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SecuritySnapshot" (
    "id" TEXT NOT NULL,
    "deviceId" INTEGER,
    "userId" INTEGER,
    "eventType" "SecurityEventType" NOT NULL,
    "imagePath" TEXT NOT NULL,
    "capturedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "faceDetected" BOOLEAN NOT NULL DEFAULT false,
    "faceConfidence" DOUBLE PRECISION,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SecuritySnapshot_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "FaceEnrollment_userId_key" ON "FaceEnrollment"("userId");

-- CreateIndex
CREATE INDEX "SecuritySnapshot_deviceId_idx" ON "SecuritySnapshot"("deviceId");

-- CreateIndex
CREATE INDEX "SecuritySnapshot_userId_idx" ON "SecuritySnapshot"("userId");

-- CreateIndex
CREATE INDEX "SecuritySnapshot_capturedAt_idx" ON "SecuritySnapshot"("capturedAt");

-- CreateIndex
CREATE INDEX "SecuritySnapshot_eventType_idx" ON "SecuritySnapshot"("eventType");

-- Create an HNSW index for fast approximate nearest neighbor search
-- Using L2 distance which is standard for face embeddings
CREATE INDEX "FaceEnrollment_faceEmbedding_idx" ON "FaceEnrollment"
USING hnsw ("faceEmbedding" vector_l2_ops)
WITH (m = 16, ef_construction = 64);

-- AddForeignKey
ALTER TABLE "FaceEnrollment" ADD CONSTRAINT "FaceEnrollment_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SecuritySnapshot" ADD CONSTRAINT "SecuritySnapshot_deviceId_fkey" FOREIGN KEY ("deviceId") REFERENCES "Device"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SecuritySnapshot" ADD CONSTRAINT "SecuritySnapshot_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Add security permissions
INSERT INTO "Permission" ("name") VALUES
    ('security.list');