/**
 * Lookup user ID by card number - used for security snapshots
 * This is a fast lookup to get the user ID before processing taps
 */

import { findUserByCard } from "@ecehive/features";
import z from "zod";
import type { TKioskProtectedProcedureContext } from "../../trpc";

export const ZLookupUserByCardSchema = z.object({
	cardNumber: z.string(),
});

export type TLookupUserByCardOptions = {
	ctx: TKioskProtectedProcedureContext;
	input: z.infer<typeof ZLookupUserByCardSchema>;
};

export async function lookupUserByCardHandler(
	options: TLookupUserByCardOptions,
) {
	const { input } = options;
	const { cardNumber } = input;

	const user = await findUserByCard(cardNumber);

	if (!user) {
		return { found: false as const, userId: null, userName: null };
	}

	return {
		found: true as const,
		userId: user.id,
		userName: user.name,
	};
}
