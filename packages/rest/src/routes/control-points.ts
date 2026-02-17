import {
	findControlPoint,
	listControlPoints,
	operateControlPoint,
} from "@ecehive/features";
import type { FastifyPluginAsync } from "fastify";
import { z } from "zod";
import { logRestAction } from "../shared/audit";
import { listResponse, successResponse } from "../shared/responses";
import {
	badRequestError,
	notFoundError,
	validationError,
} from "../shared/validation";

// ===== Validation Schemas =====

// Reusable username validation schema (matches the pattern from users.ts)
const UsernameValidationSchema = z
	.string()
	.trim()
	.min(1)
	.max(100)
	.regex(
		/^[a-zA-Z0-9_-]+$/,
		"Username must contain only letters, numbers, hyphens, and underscores",
	);

const ControlPointIdParamsSchema = z.object({
	id: z.string().trim().min(1),
});

const OperateControlPointSchema = z.object({
	username: UsernameValidationSchema,
	state: z.boolean(),
});

const ListControlPointsQuerySchema = z.object({
	skip: z.coerce.number().int().min(0).default(0),
	take: z.coerce.number().int().min(1).max(200).default(50),
});

// ===== Helper Functions =====

/**
 * Serializes a control point for the API response
 */
function serializeControlPoint(point: {
	id: string;
	name: string;
	description: string | null;
	location: string | null;
	controlClass: string;
	canControlOnline: boolean;
	canControlWithCode: boolean;
	currentState: boolean;
	isActive: boolean;
	createdAt: Date;
	updatedAt: Date;
	provider: {
		id: number;
		name: string;
		providerType: string;
		isActive?: boolean;
	};
	authorizedRoles: Array<{ id: number; name: string }>;
	authorizedUsers: Array<{
		id: number;
		name: string;
		username: string;
		email?: string;
	}>;
}) {
	return {
		id: point.id,
		name: point.name,
		description: point.description,
		location: point.location,
		controlClass: point.controlClass,
		canControlOnline: point.canControlOnline,
		canControlWithCode: point.canControlWithCode,
		currentState: point.currentState,
		isActive: point.isActive,
		createdAt: point.createdAt,
		updatedAt: point.updatedAt,
		provider: {
			id: point.provider.id,
			name: point.provider.name,
			providerType: point.provider.providerType,
		},
		authorizedRoles: point.authorizedRoles.map((r) => ({
			id: r.id,
			name: r.name,
		})),
		authorizedUsers: point.authorizedUsers.map((u) => ({
			id: u.id,
			name: u.name,
			username: u.username,
		})),
	};
}

// ===== Routes =====

export const controlPointsRoutes: FastifyPluginAsync = async (fastify) => {
	/**
	 * GET /control/points
	 * Retrieve all control points with pagination
	 */
	fastify.get("/", async (request, reply) => {
		// Validate query parameters
		const parsedQuery = ListControlPointsQuerySchema.safeParse(request.query);
		if (!parsedQuery.success) {
			return validationError(reply, parsedQuery.error);
		}

		const { skip, take } = parsedQuery.data;

		try {
			const result = await listControlPoints({
				offset: skip,
				limit: take,
				sortBy: "name",
				sortOrder: "asc",
			});

			return listResponse(result.points.map(serializeControlPoint), {
				total: result.total,
				skip,
				take,
				hasMore: result.hasMore,
			});
		} catch (error) {
			request.log.error({ err: error }, "Failed to list control points");
			return badRequestError(reply, "Failed to retrieve control points", error);
		}
	});

	/**
	 * GET /control/points/:id
	 * Retrieve a specific control point by ID
	 */
	fastify.get("/:id", async (request, reply) => {
		// Validate params
		const parsedParams = ControlPointIdParamsSchema.safeParse(request.params);
		if (!parsedParams.success) {
			return validationError(reply, parsedParams.error);
		}

		const { id } = parsedParams.data;

		try {
			const controlPoint = await findControlPoint(id);

			if (!controlPoint) {
				return notFoundError(reply, "Control point", id);
			}

			return successResponse(serializeControlPoint(controlPoint));
		} catch (error) {
			request.log.error(
				{ err: error, controlPointId: id },
				"Failed to retrieve control point",
			);
			return badRequestError(reply, "Failed to retrieve control point", error);
		}
	});

	/**
	 * PUT /control/points/:id/operate
	 * Operate a control point (switch or door) to a specified state
	 *
	 * Requires:
	 * - Valid control point ID in path
	 * - JSON body with username (string) and state (boolean)
	 * - Username must exist in the system
	 */
	fastify.put("/:id/operate", async (request, reply) => {
		const parsedParams = ControlPointIdParamsSchema.safeParse(request.params);
		if (!parsedParams.success) {
			return validationError(reply, parsedParams.error);
		}

		const parsedBody = OperateControlPointSchema.safeParse(request.body);
		if (!parsedBody.success) {
			return validationError(reply, parsedBody.error);
		}

		const { id } = parsedParams.data;
		const { username, state } = parsedBody.data;

		try {
			const result = await operateControlPoint({
				controlPointId: id,
				username,
				state,
			});

			await logRestAction(request, "rest.control.points.operate", {
				controlPointId: id,
				username,
				state,
				action: result.action,
				success: result.success,
				logId: result.logId,
			});

			return successResponse({
				id: result.controlPointId,
				username: result.username,
				action: result.action,
				previousState: result.previousState,
				newState: result.newState,
				success: result.success,
				logId: result.logId,
				timestamp: new Date(),
			});
		} catch (error) {
			if (error && typeof error === "object" && "code" in error) {
				const trpcError = error as { code: string; message: string };

				switch (trpcError.code) {
					case "NOT_FOUND":
						if (trpcError.message.includes("User")) {
							return notFoundError(reply, "User", username);
						}
						if (trpcError.message.includes("Control point")) {
							return notFoundError(reply, "Control point", id);
						}
						return notFoundError(reply, "Resource");

					case "FORBIDDEN":
						return reply.code(403).send({
							success: false,
							error: {
								code: "FORBIDDEN",
								message: trpcError.message,
							},
						});

					case "PRECONDITION_FAILED":
						return reply.code(412).send({
							success: false,
							error: {
								code: "PRECONDITION_FAILED",
								message: trpcError.message,
							},
						});

					case "BAD_REQUEST":
						return badRequestError(reply, trpcError.message);
				}
			}

			request.log.error(
				{ err: error, controlPointId: id, username, state },
				"Failed to operate control point",
			);
			return badRequestError(reply, "Failed to operate control point", error);
		}
	});
};
