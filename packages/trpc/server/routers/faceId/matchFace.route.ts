import { getLogger } from "@ecehive/logger";
import { prisma } from "@ecehive/prisma";
import z from "zod";
import type { TKioskProtectedProcedureContext } from "../../trpc";

const logger = getLogger("faceId:matchFace");

// Face matching threshold (lower = more strict)
// This is the maximum Euclidean distance for a match
const FACE_MATCH_THRESHOLD = 0.6;

export const ZMatchFaceSchema = z.object({
	// Face descriptor is a 128-dimensional vector from face-api.js
	faceDescriptor: z.array(z.number()).length(128),
});

export type TMatchFaceOptions = {
	ctx: TKioskProtectedProcedureContext;
	input: z.infer<typeof ZMatchFaceSchema>;
};

/**
 * Interface for the raw SQL query result
 */
interface FaceMatchResult {
	userId: number;
	distance: number;
	userName: string;
	username: string;
	cardNumber: string | null;
}

/**
 * Match a face descriptor against all enrolled faces using pgvector
 * Uses HNSW index for fast approximate nearest neighbor search
 * Returns the best match if found within threshold, or null if no match
 *
 * SECURITY: All face data and comparisons stay server-side.
 * Only the matching result (user info) is returned to the kiosk.
 */
export async function matchFaceHandler(options: TMatchFaceOptions) {
	const { ctx, input } = options;
	const { faceDescriptor } = input;

	logger.debug("Matching face descriptor using pgvector", {
		deviceId: ctx.device.id,
	});

	// Convert the descriptor array to pgvector format: '[0.1,0.2,...]'
	const vectorString = `[${faceDescriptor.join(",")}]`;

	// Use pgvector's L2 distance operator (<->) for efficient similarity search
	// The HNSW index will be used automatically for fast approximate nearest neighbor search
	// We only need to fetch the closest match within threshold
	const results = await prisma.$queryRaw<FaceMatchResult[]>`
		SELECT 
			fe."userId",
			fe."faceEmbedding" <-> ${vectorString}::vector AS distance,
			u."name" AS "userName",
			u."username",
			u."cardNumber"
		FROM "FaceEnrollment" fe
		INNER JOIN "User" u ON fe."userId" = u."id"
		WHERE u."faceIdEnabled" = true
			AND fe."faceEmbedding" IS NOT NULL
		ORDER BY fe."faceEmbedding" <-> ${vectorString}::vector
		LIMIT 1
	`;

	// No results at all
	if (results.length === 0) {
		logger.debug("No enrolled faces found for matching", {
			deviceId: ctx.device.id,
		});
		return {
			matched: false,
			user: null,
			confidence: 0,
			distance: Infinity,
		};
	}

	const bestMatch = results[0];
	const bestDistance = bestMatch.distance;

	// Check if the best match is good enough
	if (bestDistance <= FACE_MATCH_THRESHOLD) {
		// Convert distance to confidence (0-1 range, higher is better)
		const confidence = Math.max(0, 1 - bestDistance / FACE_MATCH_THRESHOLD);

		logger.info("Face matched via pgvector", {
			userId: bestMatch.userId,
			userName: bestMatch.userName,
			confidence,
			distance: bestDistance,
			deviceId: ctx.device.id,
		});

		// Update successful match count and last used timestamp
		await prisma.faceEnrollment.update({
			where: { userId: bestMatch.userId },
			data: {
				successfulMatches: { increment: 1 },
				lastUsedAt: new Date(),
			},
		});

		return {
			matched: true,
			user: {
				id: bestMatch.userId,
				name: bestMatch.userName,
				username: bestMatch.username,
				cardNumber: bestMatch.cardNumber,
			},
			confidence,
			distance: bestDistance,
		};
	}

	logger.debug("No face match found within threshold", {
		bestDistance,
		threshold: FACE_MATCH_THRESHOLD,
		deviceId: ctx.device.id,
	});

	return {
		matched: false,
		user: null,
		confidence: 0,
		distance: bestDistance,
	};
}
