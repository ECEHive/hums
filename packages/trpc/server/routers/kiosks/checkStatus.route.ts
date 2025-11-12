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

	// Check if this IP is registered as a kiosk
	const kiosk = await prisma.kiosk.findFirst({
		where: {
			ipAddress: ip,
			isActive: true,
		},
	});

	if (kiosk) {
		return {
			status: true,
			kiosk,
		};
	}

	return {
		status: false,
		ip,
	};
}
