import {
	createControlProvider,
	deleteControlProvider,
	getControlProviderById,
	listControlProviders,
	updateControlProvider,
} from "@ecehive/features";
import { z } from "zod";

export const ZCreateProviderSchema = z.object({
	name: z.string().min(1).max(255),
	providerType: z.enum(["GEORGIA_TECH_PLC"]),
	config: z.record(z.string(), z.unknown()),
	isActive: z.boolean().optional(),
});

export const ZDeleteProviderSchema = z.object({
	id: z.number().int(),
});

export const ZGetProviderSchema = z.object({
	id: z.number().int(),
});

export const ZListProvidersSchema = z.object({
	search: z.string().optional(),
	isActive: z.boolean().optional(),
	limit: z.number().int().min(1).max(100).default(25),
	offset: z.number().int().min(0).default(0),
});

export const ZUpdateProviderSchema = z.object({
	id: z.number().int(),
	name: z.string().min(1).max(255).optional(),
	config: z.record(z.string(), z.unknown()).optional(),
	isActive: z.boolean().optional(),
});

export async function createProviderHandler({
	input,
}: {
	input: z.infer<typeof ZCreateProviderSchema>;
}) {
	return createControlProvider(input);
}

export async function deleteProviderHandler({
	input,
}: {
	input: z.infer<typeof ZDeleteProviderSchema>;
}) {
	return deleteControlProvider(input.id);
}

export async function getProviderHandler({
	input,
}: {
	input: z.infer<typeof ZGetProviderSchema>;
}) {
	return getControlProviderById(input.id);
}

export async function listProvidersHandler({
	input,
}: {
	input: z.infer<typeof ZListProvidersSchema>;
}) {
	return listControlProviders(input);
}

export async function updateProviderHandler({
	input,
}: {
	input: z.infer<typeof ZUpdateProviderSchema>;
}) {
	return updateControlProvider(input);
}
