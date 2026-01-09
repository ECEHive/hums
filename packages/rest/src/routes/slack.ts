import {
	checkStaffingPermission,
	endSession,
	getCurrentSession,
	startSession,
	switchSessionType,
} from "@ecehive/features";
import { prisma, type User } from "@ecehive/prisma";
import type { FastifyPluginAsync, FastifyReply, FastifyRequest } from "fastify";
import { z } from "zod";
import { logRestAction } from "../shared/audit";
import { slackError, slackSuccess } from "../shared/validation";

// ===== Validation Schemas =====

const UsernameValidationSchema = z
	.string()
	.trim()
	.min(1)
	.max(100)
	.regex(
		/^[a-zA-Z0-9_-]+$/,
		"Username must contain only letters, numbers, hyphens, and underscores",
	);

// Slack slash command payload (application/x-www-form-urlencoded)
// See: https://api.slack.com/interactivity/slash-commands
const SlackSchema = z.object({
	// Verification token provided by Slack (deprecated)
	token: z.string().optional(),

	// Team information (present for workspace commands)
	team_id: z.string(),
	team_domain: z.string(),

	// Enterprise details are only present for enterprise installs
	enterprise_id: z.string().optional(),
	enterprise_name: z.string().optional(),

	// Channel where the command was invoked
	channel_id: z.string(),
	channel_name: z.string(),

	// User who invoked the command
	user_id: z.string(),
	user_name: z.string(),

	// The command itself and the (possibly empty) text after it
	command: z.string(),
	text: z.string().optional().default(""),

	// Response/interaction details
	response_url: z.string(),
	trigger_id: z.string(),
	api_app_id: z.string(),

	// Install flag
	is_enterprise_install: z.string().optional(),
});

// ===== Slack Command Registry =====

type SlackCommand = {
	command: string;
	usage: string;
	validation?: z.ZodString;
	permissions?: string[];
};

const slackCommands: Record<string, SlackCommand> = {
	"/login": {
		command: "/login",
		usage: "/login <GT Username>",
		validation: UsernameValidationSchema,
		permissions: ["sessions.manage"],
	},
	"/logout": {
		command: "/logout",
		usage: "/logout <GT Username>",
		validation: UsernameValidationSchema,
		permissions: ["sessions.manage"],
	},
};

// ===== Helper Functions =====

async function getUserPermissions(user: User) {
	// Get user with roles and permissions in a single optimized query
	const userWithRolesAndPermissions = await prisma.user.findUnique({
		where: { id: user.id },
		include: {
			roles: {
				select: {
					id: true,
					name: true,
					permissions: {
						select: {
							name: true,
						},
					},
				},
			},
		},
	});

	if (!userWithRolesAndPermissions) {
		return {
			user: {
				...user,
				roles: [],
				permissions: [],
			},
		};
	}

	// Extract unique permission names from all roles
	const permissionNames = new Set<string>();
	userWithRolesAndPermissions.roles.forEach((role) => {
		role.permissions.forEach((permission) => {
			permissionNames.add(permission.name);
		});
	});

	// Transform roles to exclude nested permissions
	const roles = userWithRolesAndPermissions.roles.map((role) => ({
		id: role.id,
		name: role.name,
	}));

	return {
		user: {
			...user,
			roles,
			permissions: Array.from(permissionNames),
		},
	};
}

async function updateUserSession(
	reply: FastifyReply,
	targetUsername: string,
	action: "login" | "logout",
) {
	return await prisma.$transaction(
		async (tx) => {
			const now = new Date();

			// Get target user
			const targetUser = await tx.user.findUnique({
				where: { username: targetUsername },
				select: {
					id: true,
					name: true,
					username: true,
					email: true,
					isSystemUser: true,
				},
			});

			if (!targetUser) {
				return slackError(
					reply,
					"User not found",
					`No HUMS user found with username "${targetUsername}".`,
				);
			}

			// Check if target user has staffing permission
			const hasStaffingPermission = await checkStaffingPermission(
				tx,
				targetUser.id,
				targetUser.isSystemUser,
			);

			if (!hasStaffingPermission) {
				return slackError(
					reply,
					"Insufficient permissions",
					`The HUMS user ${targetUser.username} does not have permission to enter a staffing session.`,
				);
			}

			// Get user's current session
			const currentSession = await getCurrentSession(tx, targetUser.id);

			switch (action) {
				case "login": {
					// If the user is already in a session, switch it to staffing if needed
					if (currentSession) {
						if (currentSession.sessionType === "staffing") {
							return slackSuccess(
								reply,
								"Already in staffing session",
								`User ${targetUser.username} is already in a staffing session.`,
							);
						}
						await switchSessionType(tx, currentSession.id, "staffing", now);

						return slackSuccess(
							reply,
							"Session switched to staffing",
							`User ${targetUser.username} was already in a session. Their session has been switched to a staffing session.`,
						);
					} else {
						// Start a new staffing session
						await startSession(tx, targetUser.id, "staffing", now);
						return slackSuccess(
							reply,
							"Staffing session started",
							`User ${targetUser.username} has started a new staffing session.`,
						);
					}
				}
				case "logout": {
					if (!currentSession || currentSession.sessionType !== "staffing") {
						return slackError(
							reply,
							"No active staffing session",
							`User ${targetUser.username} is not currently in a staffing session.`,
						);
					}

					// End the current session
					await endSession(tx, currentSession.id, now);

					return slackSuccess(
						reply,
						"Session ended",
						`User ${targetUser.username}'s session has been ended.`,
					);
				}
				default: {
					return slackError(
						reply,
						"Invalid action",
						"An invalid action was specified.",
					);
				}
			}
		},
		{
			maxWait: 2500,
			timeout: 2500,
		},
	);
}

// ===== Routes =====

export const slackRoutes: FastifyPluginAsync = async (fastify) => {
	// Pre-handler to check permissions for Slack commands
	fastify.addHook(
		"preHandler",
		async (request: FastifyRequest, reply: FastifyReply) => {
			if (!request.user) {
				return slackError(
					reply,
					"Unauthorized user",
					"No HUMS user found with Slack username.",
				);
			}

			const authUser = await getUserPermissions(request.user as User);

			// Check command against registry by validating the Slack payload first
			const parsedCommandPayload = SlackSchema.safeParse(request.body);
			if (!parsedCommandPayload.success) {
				return slackError(
					reply,
					"Invalid request",
					"Slack payload malformed, please contact an app administrator.",
				);
			}
			const commandInfo = slackCommands[parsedCommandPayload.data.command];
			if (commandInfo?.permissions && commandInfo.permissions.length > 0) {
				// System users bypass permission checks
				if (authUser.user.isSystemUser) {
					return;
				}
				// Verify user has all required permissions
				const hasPermissions = commandInfo.permissions.every((perm) =>
					authUser.user.permissions.includes(perm),
				);
				if (!hasPermissions) {
					return slackError(
						reply,
						"Insufficient permissions",
						"You do not have permission to execute this command.",
					);
				}
			}
		},
	);

	// Post-handler for audit logging if command is successful
	fastify.addHook(
		"onSend",
		async (request: FastifyRequest, reply: FastifyReply) => {
			const parsed = SlackSchema.safeParse(request.body);
			if (!parsed.success) {
				// Invalid payload, skip logging
				return;
			}
			const payload = parsed.data;

			// Only log successful commands
			if (reply.success !== true) {
				return;
			}
			// Log the incoming command for audit/debug
			await logRestAction(request, `rest.slack.${payload.command.slice(1)}`, {
				command: `${payload.command} ${payload.text}`,
				user_name: payload.user_name,
				user_id: payload.user_id,
				channel_name: payload.channel_name,
				channel_id: payload.channel_id,
			});
		},
	);

	// Slack only sends POST requests for slash commands
	fastify.post("/", async (request, reply) => {
		try {
			const parsed = SlackSchema.safeParse(request.body);
			if (!parsed.success) {
				return slackError(
					reply,
					"Invalid request",
					"Slack payload malformed, please contact an app administrator.",
				);
			}

			const payload = parsed.data;

			// Check command against registry
			const commandInfo = slackCommands[payload.command];
			if (!commandInfo) {
				return slackError(
					reply,
					"Unknown command",
					`The command "${payload.command}" is not recognized.`,
				);
			} else if (commandInfo.validation) {
				const validationResult = commandInfo.validation.safeParse(payload.text);
				if (!validationResult.success) {
					return slackError(
						reply,
						"Invalid command usage",
						`Usage: ${commandInfo.usage}`,
					);
				}
			}

			switch (payload.command) {
				case "/login":
					return await updateUserSession(reply, payload.text.trim(), "login");
				case "/logout":
					return await updateUserSession(reply, payload.text.trim(), "logout");
				default:
					return slackError(
						reply,
						"Unknown command",
						`The command "${payload.command}" is not recognized.`,
					);
			}
		} catch (err) {
			request.log.error({ err }, "Error processing Slack command");
			return slackError(
				reply,
				"Server error",
				"An internal error occurred while processing your command.",
			);
		}
	});
};
