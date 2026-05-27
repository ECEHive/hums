import { createControlGateway } from '@ecehive/features';
import { deleteControlGateway } from '@ecehive/features';
import { getControlGatewayById } from '@ecehive/features';
import { listControlGateways } from '@ecehive/features';
import { updateControlGateway } from '@ecehive/features';
import { z } from 'zod';

export const ZCreateGatewaySchema = z.object({
  name: z.string().min(1).max(255),
  description: z.string().max(1000).optional(),
  isActive: z.boolean().optional(),
  actions: z
    .array(
      z.object({
        controlPointId: z.string().uuid(),
        action: z.enum(['TURN_ON', 'TURN_OFF', 'UNLOCK']),
      })
    )
    .default([]),
});

export const ZDeleteGatewaySchema = z.object({
  id: z.number().int(),
});

export const ZGetGatewaySchema = z.object({
  id: z.number().int(),
});

export const ZListGatewaysSchema = z.object({
  search: z.string().optional(),
  isActive: z.boolean().optional(),
  limit: z.number().int().min(1).max(100).default(25),
  offset: z.number().int().min(0).default(0),
});

export const ZUpdateGatewaySchema = z.object({
  id: z.number().int(),
  name: z.string().min(1).max(255).optional(),
  description: z.string().max(1000).nullish(),
  isActive: z.boolean().optional(),
  actions: z
    .array(
      z.object({
        controlPointId: z.string().uuid(),
        action: z.enum(['TURN_ON', 'TURN_OFF', 'UNLOCK']),
      })
    )
    .optional(),
});

export async function createGatewayHandler({ input }: { input: z.infer<typeof ZCreateGatewaySchema> }) {
  return createControlGateway(input);
}

export async function deleteGatewayHandler({ input }: { input: z.infer<typeof ZDeleteGatewaySchema> }) {
  return deleteControlGateway(input.id);
}

export async function getGatewayHandler({ input }: { input: z.infer<typeof ZGetGatewaySchema> }) {
  return getControlGatewayById(input.id);
}

export async function listGatewaysHandler({ input }: { input: z.infer<typeof ZListGatewaysSchema> }) {
  return listControlGateways(input);
}

export async function updateGatewayHandler({ input }: { input: z.infer<typeof ZUpdateGatewaySchema> }) {
  return updateControlGateway(input);
}
