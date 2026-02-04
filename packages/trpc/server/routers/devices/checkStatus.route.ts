import { prisma } from "@ecehive/prisma";
import z from "zod";
import type { Context } from "../../context";
import { getClientIp } from "../../utils/getClientIp";

export const ZCheckStatusSchema = z.object({});

export type TCheckStatusSchema = z.infer<typeof ZCheckStatusSchema>;

export type TCheckStatusOptions = {
	ctx: Context;
	input: TCheckStatusSchema;
};

export async function checkStatusHandler(options: TCheckStatusOptions) {
	// Get the client IP address from the request
	const ip = getClientIp(options.ctx.req);

	// Check if this IP is registered as a device
	const device = await prisma.device.findFirst({
		where: {
			ipAddress: ip,
			isActive: true,
		},
		include: {
			controlPoints: {
				where: { isActive: true },
				select: {
					id: true,
					name: true,
					description: true,
					location: true,
					controlClass: true,
					currentState: true,
					isActive: true,
					canControlOnline: true,
					authorizedRoles: { select: { id: true } },
					authorizedUsers: { select: { id: true } },
				},
			},
		},
	});

	if (device) {
		return {
			status: true,
			device,
		};
	}

	return {
		status: false,
		ip,
	};
}
