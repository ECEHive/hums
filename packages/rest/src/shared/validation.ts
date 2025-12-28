import type { FastifyReply } from "fastify";
import type { z } from "zod";

/**
 * Handles validation errors consistently across all endpoints
 * @param reply - The Fastify reply object
 * @param error - The Zod validation error containing details about what failed
 */
export function validationError(reply: FastifyReply, error: z.ZodError) {
	return reply.code(400).send({
		success: false,
		error: {
			code: "VALIDATION_ERROR",
			message: "Request validation failed",
			details: error.flatten(),
		},
	});
}

/**
 * Standard error response for not found resources
 * @param reply - The Fastify reply object
 * @param resource - The type of resource that was not found (e.g., "User", "Role")
 * @param identifier - Optional identifier of the resource (e.g., username, ID)
 */
export function notFoundError(
	reply: FastifyReply,
	resource: string,
	identifier?: string,
) {
	return reply.code(404).send({
		success: false,
		error: {
			code: "NOT_FOUND",
			message: `${resource} not found${identifier ? `: ${identifier}` : ""}`,
		},
	});
}

/**
 * Standard error response for conflicts (e.g., duplicate resources)
 * @param reply - The Fastify reply object
 * @param message - The error message to display
 * @param details - Optional additional details about the conflict
 */
export function conflictError(
	reply: FastifyReply,
	message: string,
	details?: unknown,
) {
	return reply.code(409).send({
		success: false,
		error: {
			code: "CONFLICT",
			message,
			details,
		},
	});
}

/**
 * Standard error response for bad requests
 * @param reply - The Fastify reply object
 * @param message - The error message to display
 * @param details - Optional additional details about why the request is invalid
 */
export function badRequestError(
	reply: FastifyReply,
	message: string,
	details?: unknown,
) {
	return reply.code(400).send({
		success: false,
		error: {
			code: "BAD_REQUEST",
			message,
			details,
		},
	});
}

/**
 * Standard error response for internal server errors
 * @param reply - The Fastify reply object
 * @param message - Optional custom error message (defaults to generic message)
 */
export function internalError(reply: FastifyReply, message?: string) {
	return reply.code(500).send({
		success: false,
		error: {
			code: "INTERNAL_ERROR",
			message: message || "An internal error occurred",
		},
	});
}
