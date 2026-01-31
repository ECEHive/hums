import { findUserByCard } from "@ecehive/features";
import { prisma } from "@ecehive/prisma";
import z from "zod";
import type { TKioskProtectedProcedureContext } from "../../trpc";

export const ZVerifyCardForEnrollmentSchema = z.object({
	cardNumber: z.string().regex(/^\d+$/),
});

export type TVerifyCardForEnrollmentOptions = {
	ctx: TKioskProtectedProcedureContext;
	input: z.infer<typeof ZVerifyCardForEnrollmentSchema>;
};

export async function verifyCardForEnrollmentHandler(
	options: TVerifyCardForEnrollmentOptions,
) {
	const { input } = options;
	const { cardNumber } = input;

	// Find the user by card number
	const user = await findUserByCard(cardNumber);

	// Check if user already has Face ID enrolled
	const existingEnrollment = await prisma.faceEnrollment.findUnique({
		where: { userId: user.id },
	});

	// Return user info along with enrollment status
	// Let the client decide how to handle existing enrollment
	return {
		success: true,
		user: {
			id: user.id,
			name: user.name,
			username: user.username,
		},
		hasExistingEnrollment: !!existingEnrollment,
	};
}
