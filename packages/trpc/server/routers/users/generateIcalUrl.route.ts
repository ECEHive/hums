import { env } from "@ecehive/env";
import { SignJWT } from "jose";
import z from "zod";
import type { TProtectedProcedureContext } from "../../trpc";

export const ZGenerateIcalUrlSchema = z.object({});
export type TGenerateIcalUrlSchema = z.infer<typeof ZGenerateIcalUrlSchema>;

export type TGenerateIcalUrlOptions = {
	ctx: TProtectedProcedureContext;
	input: TGenerateIcalUrlSchema;
};

/**
 * Generate a signed iCal URL for the current user's shifts.
 * The token never expires and is signed with ICAL_SECRET.
 */
export async function generateIcalUrlHandler(options: TGenerateIcalUrlOptions) {
	const userId = options.ctx.user.id;

	// Create a JWT token that never expires for iCal access
	const token = await new SignJWT({ userId, type: "ical" })
		.setProtectedHeader({ alg: "HS256" })
		.setIssuedAt()
		// No expiration - iCal tokens are permanent
		.sign(env.ICAL_SECRET);

	// Construct the full URL
	const baseUrl = env.CLIENT_BASE_URL.replace(/\/$/, "");
	const icalUrl = `${baseUrl}/api/ical/${token}.ical`;

	return { url: icalUrl };
}
