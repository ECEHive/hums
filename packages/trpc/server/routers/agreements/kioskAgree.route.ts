import { findUserByCard } from "@ecehive/features";
import { prisma } from "@ecehive/prisma";
import { TRPCError } from "@trpc/server";
import z from "zod";
import type { TKioskProtectedProcedureContext } from "../../trpc";

export const ZKioskAgreeSchema = z.object({
	cardNumber: z.string().regex(/^\d+$/),
	agreementId: z.number().min(1),
});

export type TKioskAgreeSchema = z.infer<typeof ZKioskAgreeSchema>;

export type TKioskAgreeOptions = {
	ctx: TKioskProtectedProcedureContext;
	input: TKioskAgreeSchema;
};

export async function kioskAgreeHandler(options: TKioskAgreeOptions) {
	const { cardNumber, agreementId } = options.input;

	// Find user by card number
	const user = await findUserByCard(cardNumber);

	if (!user) {
		throw new TRPCError({
			code: "NOT_FOUND",
			message: "User not found",
		});
	}

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
				userId: user.id,
				agreementId,
			},
		},
	});

	if (existing) {
		// Already agreed, return success
		return {
			success: true,
			message: "Agreement already accepted",
		};
	}

	// Create new agreement record
	await prisma.userAgreement.create({
		data: {
			userId: user.id,
			agreementId,
		},
	});

	return {
		success: true,
		message: "Agreement accepted successfully",
	};
}
