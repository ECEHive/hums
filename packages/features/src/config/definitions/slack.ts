import { defineConfig, type ExtractConfigType } from "../types";

/**
 * Slack Configuration
 * Defines configuration options for Slack integration
 */
export const slackConfig = defineConfig({
	groups: [
		{
			id: "slack-integration",
			label: "Slack Integration",
			description: "Configure Slack integration",
			icon: "Slack",
			fields: [
				{
					key: "slack.secret",
					label: "Slack Signing Secret",
					description: "The secret used to verify incoming Slack requests",
					type: "secret",
					defaultValue: "",
				},
			],
		},
	],
} as const);

export type SlackConfigType = ExtractConfigType<typeof slackConfig>;
