/**
 * Control Gateways - Get
 */

import { prisma } from "@ecehive/prisma";
import { TRPCError } from "@trpc/server";

/**
 * Gets a control gateway by ID with its associated actions
 * Access token is redacted to prevent exposure
 */
export async function getControlGatewayById(id: number) {
	const gateway = await prisma.controlGateway.findUnique({
		where: { id },
		include: {
			actions: {
				include: {
					controlPoint: {
						select: {
							id: true,
							name: true,
							location: true,
							controlClass: true,
							isActive: true,
						},
					},
				},
			},
		},
	});

	if (!gateway) {
		throw new TRPCError({
			code: "NOT_FOUND",
			message: "Control gateway not found",
		});
	}

	// Redact access token
	return {
		...gateway,
		accessToken: `****${gateway.accessToken.slice(-4)}`,
	};
}
