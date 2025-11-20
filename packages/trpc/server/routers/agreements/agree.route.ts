import { prisma } from "@ecehive/prisma";
import { TRPCError } from "@trpc/server";
import z from "zod";
import type { TProtectedProcedureContext } from "../../trpc";

export const ZAgreeSchema = z.object({
	agreementId: z.number().min(1),
});

export type TAgreeSchema = z.infer<typeof ZAgreeSchema>;

export type TAgreeOptions = {
	ctx: TProtectedProcedureContext;
	input: TAgreeSchema;
};

export async function agreeHandler(options: TAgreeOptions) {
	const { agreementId } = options.input;
	const userId = options.ctx.user.id;

	// Verify agreement exists and is enabled
	const agreement = await prisma.agreement.findUnique({
		where: { id: agreementId },
	});

	if (!agreement) {
		throw new TRPCError({
			code: "NOT_FOUND",
			message: "Agreement not found",
		});
	}

	if (!agreement.isEnabled) {
		throw new TRPCError({
			code: "BAD_REQUEST",
			message: "This agreement is not currently active",
		});
	}

	// Check if already agreed
	const existing = await prisma.userAgreement.findUnique({
		where: {
			userId_agreementId: {
				userId,
				agreementId,
			},
		},
	});

	if (existing) {
		return { userAgreement: existing, alreadyAgreed: true };
	}

	// Create the agreement
	const userAgreement = await prisma.userAgreement.create({
		data: {
			userId,
			agreementId,
		},
		include: {
			agreement: true,
		},
	});

	return { userAgreement, alreadyAgreed: false };
}
