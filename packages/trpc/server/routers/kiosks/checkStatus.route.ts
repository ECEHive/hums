import { db, kiosks } from "@ecehive/drizzle";
import { and, eq } from "drizzle-orm";
import z from "zod";
import type { Context } from "../../context";

export const ZCheckStatusSchema = z.object({});

export type TCheckStatusSchema = z.infer<typeof ZCheckStatusSchema>;

export type TCheckStatusOptions = {
	ctx: Context;
	input: TCheckStatusSchema;
};

export async function checkStatusHandler(options: TCheckStatusOptions) {
	// Get the client IP address from the request
	const clientIp =
		options.ctx.req.headers["x-forwarded-for"] ||
		options.ctx.req.headers["x-real-ip"] ||
		options.ctx.req.socket.remoteAddress ||
		"unknown";

	const ip = Array.isArray(clientIp) ? clientIp[0] : clientIp;

	// Check if this IP is registered as a kiosk
	const [kiosk] = await db
		.select()
		.from(kiosks)
		.where(and(eq(kiosks.ipAddress, ip), eq(kiosks.isActive, true)))
		.limit(1);

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
