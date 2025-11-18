import { prisma } from "@ecehive/prisma";
import z from "zod";
import type { TProtectedProcedureContext } from "../../trpc";

export const ZGetStatusSchema = z.object({});

export type TGetStatusSchema = z.infer<typeof ZGetStatusSchema>;

export type TGetStatusOptions = {
	ctx: TProtectedProcedureContext;
	input: TGetStatusSchema;
};

export async function getStatusHandler(options: TGetStatusOptions) {
	const userId = options.ctx.user.id;

	// Get all enabled agreements
	const enabledAgreements = await prisma.agreement.findMany({
		where: { isEnabled: true },
		select: { id: true },
	});

	// Get user's agreements
	const userAgreements = await prisma.userAgreement.findMany({
		where: {
			userId,
			agreementId: { in: enabledAgreements.map((a) => a.id) },
		},
		include: {
			agreement: true,
		},
	});

	const agreedIds = new Set(userAgreements.map((ua) => ua.agreementId));
	const missingAgreementIds = enabledAgreements
		.filter((a) => !agreedIds.has(a.id))
		.map((a) => a.id);

	return {
		hasAgreedToAll: missingAgreementIds.length === 0,
		missingAgreementIds,
		userAgreements,
	};
}
