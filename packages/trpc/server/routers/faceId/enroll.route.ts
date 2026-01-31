import { getLogger } from "@ecehive/logger";
import { prisma } from "@ecehive/prisma";
import { TRPCError } from "@trpc/server";
import z from "zod";
import type { TKioskProtectedProcedureContext } from "../../trpc";

const logger = getLogger("faceId:enroll");

export const ZEnrollSchema = z.object({
	userId: z.number(),
	// Face descriptor is a 128-dimensional vector
	faceDescriptor: z.array(z.number()).length(128),
	// Card number used for verification - proves user authenticated via card tap
	// Enrollment requires recent card verification for authorization
	verificationCardNumber: z.string().regex(/^\d+$/),
});

export type TEnrollOptions = {
	ctx: TKioskProtectedProcedureContext;
	input: z.infer<typeof ZEnrollSchema>;
};

export async function enrollHandler(options: TEnrollOptions) {
	const { ctx, input } = options;
	const { userId, faceDescriptor, verificationCardNumber } = input;

	// Validate all descriptor values are finite numbers
	for (let i = 0; i < faceDescriptor.length; i++) {
		if (!Number.isFinite(faceDescriptor[i])) {
			throw new TRPCError({
				code: "BAD_REQUEST",
				message: `Invalid face descriptor: value at index ${i} is not a finite number`,
			});
		}
	}

	// Verify user exists and card number matches - this ensures the enrollment
	// is being performed for the user who recently tapped their card
	const user = await prisma.user.findUnique({
		where: { id: userId },
		select: { id: true, name: true, username: true, cardNumber: true },
	});

	if (!user) {
		throw new TRPCError({
			code: "NOT_FOUND",
			message: "User not found",
		});
	}

	// Authorization check: verify the card number matches the user being enrolled
	// This ensures Face ID enrollment can only be performed by the user themselves
	// after they have authenticated via their physical card
	if (!user.cardNumber || user.cardNumber !== verificationCardNumber) {
		logger.warn("Face ID enrollment authorization failed - card mismatch", {
			userId,
			deviceId: ctx.device.id,
		});
		throw new TRPCError({
			code: "FORBIDDEN",
			message:
				"Face ID enrollment requires card verification for the same user",
		});
	}

	// Convert the descriptor array to pgvector format: '[0.1,0.2,...]'
	const vectorString = `[${faceDescriptor.join(",")}]`;

	// Check for existing enrollment - if exists, update it (re-enrollment)
	const existingEnrollment = await prisma.faceEnrollment.findUnique({
		where: { userId },
	});

	let enrollmentId: number;
	if (existingEnrollment) {
		// Update existing enrollment (re-enrollment)
		logger.info("Updating existing Face ID enrollment", {
			userId,
			deviceId: ctx.device.id,
		});

		// Use raw SQL to update the vector column
		await prisma.$executeRaw`
			UPDATE "FaceEnrollment"
			SET 
				"faceEmbedding" = ${vectorString}::vector,
				"enrolledAt" = NOW(),
				"updatedAt" = NOW()
			WHERE "userId" = ${userId}
		`;
		enrollmentId = existingEnrollment.id;
	} else {
		// Create new enrollment using raw SQL to include the vector column
		const result = await prisma.$queryRaw<{ id: number }[]>`
			INSERT INTO "FaceEnrollment" (
				"userId", 
				"faceEmbedding", 
				"enrolledAt",
				"successfulMatches",
				"createdAt",
				"updatedAt"
			)
			VALUES (
				${userId},
				${vectorString}::vector,
				NOW(),
				0,
				NOW(),
				NOW()
			)
			RETURNING "id"
		`;
		enrollmentId = result[0].id;
	}

	// Enable Face ID for the user
	await prisma.user.update({
		where: { id: userId },
		data: { faceIdEnabled: true },
	});

	logger.info("Face ID enrolled with pgvector embedding", {
		userId,
		deviceId: ctx.device.id,
	});

	return {
		success: true,
		enrollmentId,
		user: {
			id: user.id,
			name: user.name,
			username: user.username,
		},
	};
}
