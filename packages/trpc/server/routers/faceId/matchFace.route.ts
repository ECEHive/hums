import { getLogger } from "@ecehive/logger";
import { prisma } from "@ecehive/prisma";
import { TRPCError } from "@trpc/server";
import z from "zod";
import type { TKioskProtectedProcedureContext } from "../../trpc";

const logger = getLogger("faceId:matchFace");

// Face matching threshold (lower = more strict)
// This is the maximum Euclidean distance for a match
const FACE_MATCH_THRESHOLD = 0.6;

// Rate limiting configuration
// Allows a maximum number of requests per device within a time window
const RATE_LIMIT_WINDOW_MS = 60000; // 1 minute window
const RATE_LIMIT_MAX_REQUESTS = 30; // Max 30 requests per minute per device

// In-memory rate limiting store (per device)
// In production, consider using Redis for distributed rate limiting
const rateLimitStore = new Map<
	number,
	{ count: number; windowStart: number }
>();

/**
 * Check and update rate limit for a device
 * Returns true if the request is allowed, false if rate limited
 */
function checkRateLimit(deviceId: number): boolean {
	const now = Date.now();
	const deviceLimit = rateLimitStore.get(deviceId);

	if (!deviceLimit || now - deviceLimit.windowStart > RATE_LIMIT_WINDOW_MS) {
		// Start a new window
		rateLimitStore.set(deviceId, { count: 1, windowStart: now });
		return true;
	}

	if (deviceLimit.count >= RATE_LIMIT_MAX_REQUESTS) {
		return false;
	}

	// Increment count in current window
	deviceLimit.count++;
	return true;
}

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

	// Check rate limit before processing
	if (!checkRateLimit(ctx.device.id)) {
		logger.warn("Rate limit exceeded for Face ID matching", {
			deviceId: ctx.device.id,
		});
		throw new TRPCError({
			code: "TOO_MANY_REQUESTS",
			message:
				"Too many Face ID match requests. Please wait before trying again.",
		});
	}

	// Validate all descriptor values are finite numbers
	for (let i = 0; i < faceDescriptor.length; i++) {
		if (!Number.isFinite(faceDescriptor[i])) {
			logger.warn("Invalid face descriptor value", {
				index: i,
				value: faceDescriptor[i],
				deviceId: ctx.device.id,
			});
			return {
				matched: false,
				user: null,
				confidence: 0,
				distance: Infinity,
			};
		}
	}

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
