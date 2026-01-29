import { defineConfig, type ExtractConfigType } from "../types";

/**
 * Email Configuration
 * Defines configuration options for email settings
 */
export const emailConfig = defineConfig({
	groups: [
		{
			id: "session-email-notifications",
			label: "Session Email Notifications",
			description: "Configure email notifications for session events",
			icon: "Mail",
			fields: [
				{
					key: "email.sessions.autologout.regular.enabled",
					label: "Email Users on Regular Session Auto-Logout",
					description:
						"Send an email notification when a regular session is automatically ended",
					type: "boolean",
					defaultValue: true,
				},
				{
					key: "email.sessions.autologout.staffing.enabled",
					label: "Email Users on Staffing Session Auto-Logout",
					description:
						"Send an email notification when a staffing session is automatically ended",
					type: "boolean",
					defaultValue: true,
				},
			],
		},
		{
			id: "user-email-notifications",
			label: "User Email Notifications",
			description: "Configure email notifications for user account events",
			icon: "UserPlus",
			fields: [
				{
					key: "email.users.welcome.enabled",
					label: "Send Welcome Email to New Users",
					description:
						"Send a welcome email when a user account is created (first login or first tap-in)",
					type: "boolean",
					defaultValue: true,
				},
			],
		},
	],
} as const);

export type EmailConfigType = ExtractConfigType<typeof emailConfig>;
