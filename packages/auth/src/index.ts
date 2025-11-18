import { env } from "@ecehive/env";
import { XMLParser } from "fast-xml-parser";
import { jwtVerify, SignJWT } from "jose";

const parser = new XMLParser();

/**
 * Validate a CAS ticket and return the user's username.
 * @param ticket - The ticket provided by the user from the CAS server.
 * @param service - The service URL to provide to the CAS server when validating the ticket.
 * @returns The user's username or null if validation fails.
 */
export async function validateTicket(ticket: string, service: string) {
	try {
		const query = new URLSearchParams({
			service: service,
			ticket: ticket,
		});

		const response = await fetch(
			`${env.AUTH_CAS_SERVER}/cas/serviceValidate?${query.toString()}`,
		);

		if (!response.ok) {
			return null;
		}

		// Parse the XML response
		const text = await response.text();
		const result = parser.parse(text);

		const user =
			result?.["cas:serviceResponse"]?.["cas:authenticationSuccess"]?.[
				"cas:user"
			];

		if (!user) {
			return null;
		}

		return user as string;
	} catch (error) {
		console.error("Error validating CAS ticket:", error);
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
		console.error("Error generating token:", error);
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
		console.error("Error validating token:", error);
		return null;
	}
}
