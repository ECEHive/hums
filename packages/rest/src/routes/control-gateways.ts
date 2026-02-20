/**
 * Control Gateways REST Route
 *
 * This route provides the public-facing endpoint for invoking control gateways.
 * External systems call this endpoint with a gateway access token and a
 * credential value to trigger configured control point actions.
 *
 * Authentication is handled by the gateway's own access token, not by the
 * standard API token auth guard.
 */

import { GatewayError, invokeControlGateway } from "@ecehive/features";
import type { FastifyPluginAsync } from "fastify";
import { z } from "zod";
import { internalError, validationError } from "../shared/validation";

// ===== Validation Schemas =====

const InvokeGatewayBodySchema = z.object({
	credentialValue: z.string().trim().min(1, "Credential value is required"),
});

const GatewayAccessTokenHeaderSchema = z.object({
	"x-gateway-token": z.string().min(1, "Gateway access token is required"),
});

// ===== Routes =====

export const controlGatewayRoutes: FastifyPluginAsync = async (fastify) => {
	// POST /control/gateways/invoke — invoke a control gateway
	fastify.post<{ Body: unknown }>("/invoke", async (request, reply) => {
		// Validate the access token from header
		const headerParse = GatewayAccessTokenHeaderSchema.safeParse(
			request.headers,
		);
		if (!headerParse.success) {
			return reply.code(401).send({
				success: false,
				error: {
					code: "UNAUTHORIZED",
					message: "Missing or invalid gateway access token",
				},
			});
		}

		const body = InvokeGatewayBodySchema.safeParse(request.body);
		if (!body.success) {
			return validationError(reply, body.error);
		}

		const accessToken = headerParse.data["x-gateway-token"];

		try {
			const result = await invokeControlGateway({
				accessToken,
				credentialValue: body.data.credentialValue,
			});

			return {
				success: true,
				data: result,
			};
		} catch (error) {
			if (error instanceof GatewayError) {
				const statusMap: Record<string, number> = {
					INVALID_TOKEN: 401,
					GATEWAY_INACTIVE: 403,
					INVALID_CREDENTIAL: 401,
				};
				const status = statusMap[error.code] ?? 400;

				return reply.code(status).send({
					success: false,
					error: {
						code: error.code,
						message: error.message,
					},
				});
			}

			return internalError(reply);
		}
	});
};
