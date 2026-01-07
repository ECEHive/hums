import { type Prisma, prisma } from "@ecehive/prisma";
import type { FastifyPluginAsync } from "fastify";
import { z } from "zod";
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
};

const slackCommands: Record<string, SlackCommand> = {
	"/login": {
		command: "/login",
		usage: "/login <GT Username>",
		validation: UsernameValidationSchema,
	},
	"/logout": {
		command: "/logout",
		usage: "/logout <GT Username>",
		validation: UsernameValidationSchema,
	},
};

// ===== Routes =====

export const slackRoutes: FastifyPluginAsync = async (fastify) => {
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

			// Log the incoming command for audit/debug
			// await logRestAction(request, `rest.slack.${payload.command.slice(1)}`, {
			// 	command: `${payload.command} ${payload.text}`,
			// 	user_name: payload.user_name,
			// 	user_id: payload.user_id,
			// 	channel_name: payload.channel_name,
			// 	channel_id: payload.channel_id,
			// });

			// Placeholder: actual command handling not implemented yet
			return slackSuccess(
				reply,
				"Command received",
				`You invoked the command "${payload.command}" with text: "${payload.text}"`,
			);
		} catch (err) {
			console.error("Error in slack POST handler", { err });
			throw err;
		}
	});
};
