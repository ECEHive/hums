import { prisma } from "@ecehive/prisma";
import z from "zod";
import type { TKioskProtectedProcedureContext } from "../../trpc";

export const ZGetEnrolledFacesSchema = z.object({
	// Optional: limit results for performance (kept for API compatibility)
	limit: z.number().min(1).max(500).default(500),
});

export type TGetEnrolledFacesOptions = {
	ctx: TKioskProtectedProcedureContext;
	input: z.infer<typeof ZGetEnrolledFacesSchema>;
};

/**
 * Get enrolled faces count and basic metadata.
 *
 * SECURITY: This endpoint no longer returns face descriptors/embeddings.
 * All face matching is done server-side using pgvector for both security
 * and performance (avoids transferring all embeddings to kiosk clients).
 *
 * Kiosk clients should use the matchFace endpoint to identify users.
 */
export async function getEnrolledFacesHandler(
	options: TGetEnrolledFacesOptions,
) {
	const { input } = options;
	const { limit } = input;

	// Get enrolled face count (no descriptors returned for security)
	const enrollments = await prisma.faceEnrollment.findMany({
		where: {
			user: {
				faceIdEnabled: true,
			},
			// Only count enrollments that have the vector embedding populated
			// faceEmbedding: { not: null }, // Cannot use this with Unsupported type
		},
		take: limit,
		select: {
			userId: true,
			// Do NOT select faceDescriptor or faceEmbedding - keep face data server-side
			user: {
				select: {
					id: true,
					name: true,
					username: true,
					// cardNumber intentionally not returned for security
				},
			},
		},
	});

	return {
		// Return metadata only, no face descriptors
		enrollments: enrollments.map((e) => ({
			userId: e.userId,
			userName: e.user.name,
			username: e.user.username,
			// faceDescriptor intentionally removed - all matching is server-side now
		})),
		// Provide count for easy checking
		count: enrollments.length,
	};
}
