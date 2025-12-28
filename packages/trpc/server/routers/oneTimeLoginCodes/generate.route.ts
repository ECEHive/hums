import { randomBytes } from "node:crypto";
import { prisma } from "@ecehive/prisma";
import z from "zod";
import type { TKioskProtectedProcedureContext } from "../../trpc";

export const ZGenerateSchema = z.object({});

export type TGenerateSchema = z.infer<typeof ZGenerateSchema>;

export type TGenerateOptions = {
	ctx: TKioskProtectedProcedureContext;
	input: TGenerateSchema;
};

/**
 * Generate a new one-time login code
 * Code expires in 5 minutes
 */
export async function generateHandler(_options: TGenerateOptions) {
	// Generate a cryptographically secure random code (8 bytes = 16 hex characters)
	const code = randomBytes(8).toString("hex");

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
