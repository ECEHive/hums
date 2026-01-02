import { env } from "@ecehive/env";
import { getLogger } from "@ecehive/logger";
import { XMLParser } from "fast-xml-parser";
import { jwtVerify, SignJWT } from "jose";

const logger = getLogger("auth");
const parser = new XMLParser();

const getCasField = <T = unknown>(
	obj: Record<string, unknown> | undefined,
	key: string,
): T | undefined => {
	return (obj?.[`cas:${key}`] ?? obj?.[key]) as T | undefined;
};

export type CasAttributes = {
	uid?: string;
	email?: string;
	givenName?: string;
	sn?: string;
};

export type CasValidationResult = {
	username: string;
	attributes: CasAttributes;
};

/**
 * Validate a CAS ticket and return user details.
 * @param ticket - The ticket provided by the user from the CAS server.
 * @param service - The service URL to provide to the CAS server when validating the ticket.
 * @returns CAS user details or null if validation fails.
 */
export async function validateTicket(
	ticket: string,
	service: string,
): Promise<CasValidationResult | null> {
	try {
		const query = new URLSearchParams({
			service,
			ticket,
		});

		const response = await fetch(
			`${env.AUTH_CAS_VALIDATE_URL}?${query.toString()}`,
		);

		if (!response.ok) {
			return null;
		}

		// Parse the XML response
		const text = await response.text();
		const result = parser.parse(text);

		const serviceResponse = getCasField<Record<string, unknown>>(
			result as Record<string, unknown>,
			"serviceResponse",
		);
		const authenticationSuccess = getCasField<Record<string, unknown>>(
			serviceResponse,
			"authenticationSuccess",
		);

		const user =
			getCasField<string>(authenticationSuccess, "user") ??
			getCasField<string>(authenticationSuccess, "uid");

		if (!user) {
			return null;
		}

		const attributesRaw = getCasField<Record<string, unknown>>(
			authenticationSuccess,
			"attributes",
		);

		const attributes: CasAttributes = {
			uid: getCasField<string>(attributesRaw, "uid"),
			email: getCasField<string>(attributesRaw, "eduPersonPrincipalName"),
			givenName: getCasField<string>(attributesRaw, "givenName"),
			sn: getCasField<string>(attributesRaw, "sn"),
		};

		return { username: user, attributes };
	} catch (error) {
		logger.error("CAS ticket validation failed", {
			error: error instanceof Error ? error.message : String(error),
		});
		return null;
	}
}

/**
 * Generate a JWT for a given user ID.
 * @param userId - The user ID to generate a token for.
 * @returns The generated JWT or null if token generation fails.
 */
export type GenerateTokenOptions = {
	impersonatedById?: number;
};

export async function generateToken(
	userId: number,
	options?: GenerateTokenOptions,
) {
	try {
		const payload: Record<string, unknown> = { userId };
		if (options?.impersonatedById) {
			payload.impersonatedById = options.impersonatedById;
		}

		const jwt = await new SignJWT(payload)
			.setProtectedHeader({ alg: "HS256" })
			.setIssuedAt()
			.setExpirationTime("24h")
			.sign(env.AUTH_SECRET);

		return jwt as string;
	} catch (error) {
		logger.error("Token generation failed", {
			error: error instanceof Error ? error.message : String(error),
		});
		return null;
	}
}

/**
 * Validate a JWT token.
 * @param token - The provided token to validate.
 * @returns The user ID or null if validation fails.
 */
export type ValidatedToken = {
	userId: number;
	impersonatedById?: number;
};

export async function validateToken(
	token: string,
): Promise<ValidatedToken | null> {
	try {
		const { payload } = await jwtVerify(token, env.AUTH_SECRET);
		const userId = payload.userId;

		if (!userId || typeof userId !== "number") {
			return null;
		}

		const validated: ValidatedToken = { userId };
		if (
			"impersonatedById" in payload &&
			typeof payload.impersonatedById === "number"
		) {
			validated.impersonatedById = payload.impersonatedById;
		}

		return validated;
	} catch (error) {
		logger.warn("Token validation failed", {
			error: error instanceof Error ? error.message : String(error),
		});
		return null;
	}
}
