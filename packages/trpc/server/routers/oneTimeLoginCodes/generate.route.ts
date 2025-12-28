import { prisma } from "@ecehive/prisma";
import { nanoid } from "nanoid";
import z from "zod";
import type { TKioskProtectedProcedureContext } from "../../trpc";

export const ZGenerateSchema = z.object({});

export type TGenerateSchema = z.infer<typeof ZGenerateSchema>;

export type TGenerateOptions = {
	ctx: TKioskProtectedProcedureContext;
	input: TGenerateSchema;
};

/**
 * Generate a new one-time login code using NanoID
 * Code expires in 5 minutes
 */
export async function generateHandler(_options: TGenerateOptions) {
	// Generate a URL-safe unique code using NanoID
	const code = nanoid(16);

	// Code expires in 5 minutes
	const expiresAt = new Date(Date.now() + 5 * 60 * 1000);

	const otaCode = await prisma.oneTimeAccessCode.create({
		data: {
			code,
			expiresAt,
		},
	});

	return {
		code: otaCode.code,
		expiresAt: otaCode.expiresAt,
	};
}
