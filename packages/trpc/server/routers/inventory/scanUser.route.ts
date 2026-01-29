import {
	checkMissingAgreements,
	findUserByCard,
	getActiveSuspension,
} from "@ecehive/features";
import { prisma } from "@ecehive/prisma";
import z from "zod";
import type { TInventoryProtectedProcedureContext } from "../../trpc";

export const ZScanUserSchema = z.object({
	cardNumber: z.string().regex(/^\d+$/),
});

export type TScanUserSchema = z.infer<typeof ZScanUserSchema>;

export type TScanUserOptions = {
	ctx: TInventoryProtectedProcedureContext;
	input: TScanUserSchema;
};

export async function scanUserHandler(options: TScanUserOptions) {
	const { cardNumber } = options.input;

	const user = await findUserByCard(cardNumber);

	return await prisma.$transaction(async (tx) => {
		const now = new Date();

		// Check if user is suspended
		const activeSuspension = await getActiveSuspension(tx, user.id, now);
		if (activeSuspension) {
			return {
				status: "suspended" as const,
				user,
				suspension: {
					endDate: activeSuspension.endDate,
					externalNotes: activeSuspension.externalNotes,
				},
			};
		}

		// Check if user has agreed to all enabled agreements
		const missingAgreements = await checkMissingAgreements(tx, user.id);

		if (missingAgreements.length > 0) {
			return {
				status: "agreements_required" as const,
				user,
				missingAgreements,
			};
		}

		// User verified and has no issues
		return {
			status: "verified" as const,
			user,
		};
	});
}
