-- CreateTable
CREATE TABLE "ControlGateway" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "accessToken" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ControlGateway_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ControlGatewayAction" (
    "id" SERIAL NOT NULL,
    "gatewayId" INTEGER NOT NULL,
    "controlPointId" TEXT NOT NULL,
    "action" "ControlAction" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ControlGatewayAction_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ControlGateway_accessToken_key" ON "ControlGateway"("accessToken");

-- CreateIndex
CREATE INDEX "ControlGateway_accessToken_idx" ON "ControlGateway"("accessToken");

-- CreateIndex
CREATE INDEX "ControlGatewayAction_gatewayId_idx" ON "ControlGatewayAction"("gatewayId");

-- CreateIndex
CREATE INDEX "ControlGatewayAction_controlPointId_idx" ON "ControlGatewayAction"("controlPointId");

-- CreateIndex
CREATE UNIQUE INDEX "ControlGatewayAction_gatewayId_controlPointId_action_key" ON "ControlGatewayAction"("gatewayId", "controlPointId", "action");

-- AddForeignKey
ALTER TABLE "ControlGatewayAction" ADD CONSTRAINT "ControlGatewayAction_gatewayId_fkey" FOREIGN KEY ("gatewayId") REFERENCES "ControlGateway"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ControlGatewayAction" ADD CONSTRAINT "ControlGatewayAction_controlPointId_fkey" FOREIGN KEY ("controlPointId") REFERENCES "ControlPoint"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Add control gateway permissions
INSERT INTO "Permission" (name) VALUES
    ('control.gateways.list'),
    ('control.gateways.get'),
    ('control.gateways.create'),
    ('control.gateways.update'),
    ('control.gateways.delete')
ON CONFLICT (name) DO NOTHING;
