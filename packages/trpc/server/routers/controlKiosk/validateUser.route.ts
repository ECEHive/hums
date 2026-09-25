/**
 * Control Kiosk Routes - Validate User
 *
 * This route validates if a user is registered in the system and returns the user's ID.
 */

import { findUserByCard } from "@ecehive/features";
import { z } from "zod";
import type { TControlProtectedProcedureContext } from "../../trpc";

export const ZValidateUserSchema = z.object({
	cardNumber: z.string().regex(/^\d+$/),
});

type ValidateUserOptions = {
	ctx: TControlProtectedProcedureContext;
	input: z.infer<typeof ZValidateUserSchema>;
};

export async function validateUserHandler({ input }: ValidateUserOptions) {
	const { cardNumber } = input;

	// Find the user by card number using findUserByCard for consistency
	try {
		const user = await findUserByCard(cardNumber);
		return {
			isValid: !!user,
			userId: user?.id,
		};
	} catch (error) {
		console.error("Error validating user:", error);
		return {
			isValid: false,
			userId: null,
		};
	}
}
