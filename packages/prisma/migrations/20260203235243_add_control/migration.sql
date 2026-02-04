-- CreateEnum
CREATE TYPE "ControlProviderType" AS ENUM ('GEORGIA_TECH_PLC');

-- CreateEnum
CREATE TYPE "ControlClass" AS ENUM ('SWITCH', 'DOOR');

-- CreateEnum
CREATE TYPE "ControlAction" AS ENUM ('TURN_ON', 'TURN_OFF', 'UNLOCK', 'READ_STATE');

-- CreateTable
CREATE TABLE "ControlProvider" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "providerType" "ControlProviderType" NOT NULL,
    "config" JSONB NOT NULL DEFAULT '{}',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ControlProvider_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ControlPoint" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "location" TEXT,
    "controlClass" "ControlClass" NOT NULL,
    "canControlOnline" BOOLEAN NOT NULL DEFAULT true,
    "canControlWithCode" BOOLEAN NOT NULL DEFAULT false,
    "providerConfig" JSONB NOT NULL DEFAULT '{}',
    "currentState" BOOLEAN NOT NULL DEFAULT false,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "providerId" INTEGER NOT NULL,

    CONSTRAINT "ControlPoint_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ControlLog" (
    "id" TEXT NOT NULL,
    "controlPointId" TEXT NOT NULL,
    "userId" INTEGER NOT NULL,
    "action" "ControlAction" NOT NULL,
    "previousState" BOOLEAN,
    "newState" BOOLEAN,
    "success" BOOLEAN NOT NULL DEFAULT true,
    "errorMessage" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ControlLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "_ControlPointRoles" (
    "A" TEXT NOT NULL,
    "B" INTEGER NOT NULL,

    CONSTRAINT "_ControlPointRoles_AB_pkey" PRIMARY KEY ("A","B")
);

-- CreateTable
CREATE TABLE "_ControlPointUsers" (
    "A" TEXT NOT NULL,
    "B" INTEGER NOT NULL,

    CONSTRAINT "_ControlPointUsers_AB_pkey" PRIMARY KEY ("A","B")
);

-- CreateIndex
CREATE UNIQUE INDEX "ControlProvider_name_key" ON "ControlProvider"("name");

-- CreateIndex
CREATE INDEX "ControlPoint_providerId_idx" ON "ControlPoint"("providerId");

-- CreateIndex
CREATE INDEX "ControlLog_controlPointId_createdAt_idx" ON "ControlLog"("controlPointId", "createdAt");

-- CreateIndex
CREATE INDEX "ControlLog_userId_createdAt_idx" ON "ControlLog"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "_ControlPointRoles_B_index" ON "_ControlPointRoles"("B");

-- CreateIndex
CREATE INDEX "_ControlPointUsers_B_index" ON "_ControlPointUsers"("B");

-- AddForeignKey
ALTER TABLE "ControlPoint" ADD CONSTRAINT "ControlPoint_providerId_fkey" FOREIGN KEY ("providerId") REFERENCES "ControlProvider"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ControlLog" ADD CONSTRAINT "ControlLog_controlPointId_fkey" FOREIGN KEY ("controlPointId") REFERENCES "ControlPoint"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ControlLog" ADD CONSTRAINT "ControlLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_ControlPointRoles" ADD CONSTRAINT "_ControlPointRoles_A_fkey" FOREIGN KEY ("A") REFERENCES "ControlPoint"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_ControlPointRoles" ADD CONSTRAINT "_ControlPointRoles_B_fkey" FOREIGN KEY ("B") REFERENCES "Role"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_ControlPointUsers" ADD CONSTRAINT "_ControlPointUsers_A_fkey" FOREIGN KEY ("A") REFERENCES "ControlPoint"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_ControlPointUsers" ADD CONSTRAINT "_ControlPointUsers_B_fkey" FOREIGN KEY ("B") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Add control permissions
INSERT INTO "Permission" (name) VALUES
    -- Control provider management
    ('control.providers.list'),
    ('control.providers.get'),
    ('control.providers.create'),
    ('control.providers.update'),
    ('control.providers.delete'),
    
    -- Control point management
    ('control.points.list'),
    ('control.points.get'),
    ('control.points.create'),
    ('control.points.update'),
    ('control.points.delete'),
    
    -- Control point operation (actually controlling equipment)
    ('control.points.operate'),
    
    -- Control logs viewing
    ('control.logs.list')
    
ON CONFLICT (name) DO NOTHING;