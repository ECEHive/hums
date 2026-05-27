import { generateToken, validateTicket } from "@ecehive/auth";
import {
	ALLOWED_AFFILIATIONS_LABEL,
	findOrCreateUser,
	isAffiliationAllowed,
} from "@ecehive/features";
import { TRPCError } from "@trpc/server";
import z from "zod";

export const ZLoginSchema = z.object({
	ticket: z.string(),
	service: z.string(),
});

export type TLoginSchema = z.infer<typeof ZLoginSchema>;

export type TLoginOptions = {
	input: TLoginSchema;
};

export async function loginHandler(options: TLoginOptions) {
	const { ticket, service } = options.input;

	if (!service) {
		throw new TRPCError({
			code: "BAD_REQUEST",
			message: "Service is required to validate CAS tickets",
		});
	}

	const validationResult = await validateTicket(ticket, service);

	if (!validationResult) {
		throw new TRPCError({
			code: "UNAUTHORIZED",
			message: "Invalid ticket",
		});
	}

	const derivedName = [
		validationResult.attributes.givenName,
		validationResult.attributes.sn,
	]
		.filter(Boolean)
		.join(" ")
		.trim();

	const user = await findOrCreateUser(validationResult.username, {
		name: derivedName.length ? derivedName : undefined,
		email: validationResult.attributes.email,
	});

	// System users (administrators) bypass affiliation and provider-deletion restrictions.
	if (
		!user.isSystemUser &&
		(user.providerDeleted || !isAffiliationAllowed(user.affiliation))
	) {
		throw new TRPCError({
			code: "FORBIDDEN",
			message: `HUMS is only available to ${ALLOWED_AFFILIATIONS_LABEL}. If you believe this is an error, please contact support.`,
		});
	}

	const token = await generateToken(user.id);

	if (!token) {
		throw new TRPCError({
			code: "INTERNAL_SERVER_ERROR",
			message: "Failed to generate token",
		});
	}

	return { token };
}
