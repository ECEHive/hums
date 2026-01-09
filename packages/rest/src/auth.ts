import { createHmac, timingSafeEqual } from "node:crypto";
import type { AuditLogger } from "@ecehive/features";
import {
	ConfigService,
	createAuditLogger,
	verifyApiToken,
} from "@ecehive/features";
import type { ApiToken, User } from "@ecehive/prisma";
import { prisma } from "@ecehive/prisma";
import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { slackError } from "./shared/validation";

function extractToken(request: FastifyRequest) {
	const headerToken = request.headers["x-api-key"];
	const normalizedHeader =
		typeof headerToken === "string"
			? headerToken
			: Array.isArray(headerToken)
				? headerToken[0]
				: null;
	if (normalizedHeader) {
		const trimmed = normalizedHeader.toString().trim();
		if (trimmed.length > 0) {
			return trimmed;
		}
	}

	const authHeader = request.headers.authorization;
	if (authHeader?.startsWith("Bearer ")) {
		return authHeader.slice(7).trim();
	}

	return null;
}

async function authGuard(request: FastifyRequest, reply: FastifyReply) {
	// Check for Slack signature first, if not present, normal REST
	if (request.headers["x-slack-signature"]) {
		// Verify Slack signing secret signature (per Slack docs)
		const sigHeader = request.headers["x-slack-signature"] as
			| string
			| undefined;
		const tsHeader = request.headers["x-slack-request-timestamp"] as
			| string
			| undefined;
		const signingSecret = await ConfigService.get("slack.secret");

		if (!signingSecret || typeof signingSecret !== "string") {
			request.log.error(
				"SLACK_SIGNING_SECRET is not configured or is not a string",
			);
			return slackError(
				reply,
				"Server misconfiguration",
				"Slack signing secret not configured.",
			);
		}

		if (!sigHeader || !tsHeader) {
			request.log.warn(
				{ hasSignature: !!sigHeader, hasTimestamp: !!tsHeader },
				"Missing Slack signature/timestamp headers",
			);
			return slackError(
				reply,
				"Unauthorized request",
				"Missing Slack signature or timestamp headers.",
			);
		}

		const ts = Number(tsHeader);
		if (Number.isNaN(ts)) {
			request.log.warn({ tsHeader }, "Invalid Slack timestamp header");
			return slackError(
				reply,
				"Unauthorized request",
				"Invalid Slack request timestamp.",
			);
		}

		const now = Math.floor(Date.now() / 1000);
		const FIVE_MINUTES = 60 * 5;
		if (Math.abs(now - ts) > FIVE_MINUTES) {
			request.log.warn({ ts, now }, "Slack request timestamp out of range");
			return slackError(
				reply,
				"Request expired",
				"Slack request timestamp is too old.",
			);
		}

		// Read raw body (the onRequest hook runs before body parsers)
		let rawBody: string | undefined = request.rawBody;
		if (typeof rawBody !== "string") {
			// Buffer the stream
			try {
				rawBody = await new Promise<string>((resolve, reject) => {
					const chunks: Buffer[] = [];
					request.raw.on("data", (chunk: Buffer) => chunks.push(chunk));
					request.raw.on("end", () =>
						resolve(Buffer.concat(chunks).toString("utf8")),
					);
					request.raw.on("error", (err) => reject(err));
				});
				// Attach for downstream handlers/parsers
				request.rawBody = rawBody;
				// Also try to parse urlencoded body and set request.body so downstream code can use it
				try {
					const params = new URLSearchParams(rawBody);
					const obj: Record<string, string> = {};
					Array.from(params.entries()).forEach(([k, v]) => {
						obj[k] = v;
					});
					request.body = obj;
					request.log.info(
						{ parsedBody: request.body },
						"Parsed Slack urlencoded body",
					);
				} catch (_err) {
					request.log.warn(
						{ err: _err },
						"Failed to parse urlencoded Slack body",
					);
				}
			} catch (err) {
				request.log.warn({ err }, "Failed to read raw Slack request body");
				return slackError(
					reply,
					"Invalid request",
					"Failed to read Slack request body.",
				);
			}
		}

		const basestring = `v0:${ts}:${rawBody}`;
		const expected = createHmac("sha256", signingSecret)
			.update(basestring)
			.digest("hex");
		// sigHeader is like "v0=..."
		const sigParts = sigHeader.split("=");
		const receivedHex = sigParts.length > 1 ? sigParts[1] : sigHeader;

		let valid = false;
		try {
			const a = Buffer.from(receivedHex, "hex");
			const b = Buffer.from(expected, "hex");
			if (a.length === b.length) valid = timingSafeEqual(a, b);
		} catch (err) {
			request.log.warn({ err }, "Error comparing Slack signatures");
			valid = false;
		}

		if (!valid) {
			return slackError(
				reply,
				"Unauthorized request",
				"Invalid Slack request signature",
			);
		}

		// Signature verified - Find HUMS user ID of Slack caller
		let slackUsername = "";
		const body = request.body;
		if (body && typeof body === "object" && "user_name" in body) {
			try {
				const b = body as Record<string, unknown>;
				const uname = b.user_name;
				slackUsername = typeof uname === "string" ? uname : String(uname ?? "");
			} catch {
				slackUsername = "";
			}
		}

		let user: User | null = null;
		const bodyObj =
			request.body && typeof request.body === "object"
				? (request.body as Record<string, unknown>)
				: null;

		const lookupName =
			slackUsername ||
			(bodyObj && typeof bodyObj.user_name === "string"
				? bodyObj.user_name
				: "");

		if (lookupName) {
			user = await prisma.user.findUnique({
				where: { slackUsername: lookupName },
			});
		}

		if (!user) {
			return slackError(
				reply,
				"Unauthorized user",
				`No HUMS user found with Slack username "${slackUsername}".`,
			);
		}

		// Attach audit logger and user to request
		request.audit = createAuditLogger({
			userId: user.id,
			source: "slack",
		});
		request.user = user;
	} else {
		const token = extractToken(request);
		if (!token) {
			return reply.code(401).send({
				error: "missing_api_token",
				message: "Provide an API token via Authorization or x-api-key",
			});
		}

		const record = await verifyApiToken(token);
		if (!record) {
			return reply.code(401).send({
				error: "invalid_api_token",
				message: "API token is invalid or expired",
			});
		}

		if (!record.createdById) {
			return reply.code(403).send({
				error: "api_token_missing_owner",
				message: "API token must be associated with a user",
			});
		}

		request.apiToken = record;
		request.audit = createAuditLogger({
			userId: record.createdById,
			apiTokenId: record.id,
			source: "rest",
		});
	}
}

export function registerAuthGuard(instance: FastifyInstance) {
	instance.addHook("onRequest", authGuard);
}

declare module "fastify" {
	interface FastifyRequest {
		apiToken?: ApiToken;
		audit?: AuditLogger;
		rawBody?: string;
		user?: User;
	}
	interface FastifyReply {
		success: boolean;
	}
}
