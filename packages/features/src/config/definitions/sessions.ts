import { defineConfig, type ExtractConfigType } from "../types";

/**
 * Session Configuration
 * Defines configuration options for user sessions
 */
export const sessionConfig = defineConfig({
	groups: [
		{
			id: "session-timeout",
			label: "Session Timeout",
			description:
				"Configure automatic session logout based on session duration",
			icon: "Clock",
			fields: [
				{
					key: "session.timeout.regular.enabled",
					label: "Enable Auto-Logout for Regular Sessions",
					description:
						"Automatically end regular sessions after a specified duration",
					type: "boolean",
					defaultValue: true,
				},
				{
					key: "session.timeout.regular.hours",
					label: "Regular Session Timeout (Hours)",
					description:
						"Number of hours before a regular session is automatically ended",
					type: "number",
					defaultValue: 12,
					min: 0.1,
					max: 168, // 1 week
					step: 0.1,
					showWhen: (values: Record<string, unknown>) =>
						values["session.timeout.regular.enabled"] === true,
				},
				{
					key: "session.timeout.staffing.enabled",
					label: "Enable Auto-Logout for Staffing Sessions",
					description:
						"Automatically end staffing sessions after a specified duration",
					type: "boolean",
					defaultValue: true,
				},
				{
					key: "session.timeout.staffing.hours",
					label: "Staffing Session Timeout (Hours)",
					description:
						"Number of hours before a staffing session is automatically ended",
					type: "number",
					defaultValue: 8,
					min: 0.1,
					max: 168, // 1 week
					step: 0.1,
					showWhen: (values: Record<string, unknown>) =>
						values["session.timeout.staffing.enabled"] === true,
				},
			],
		},
		{
			id: "kiosk-sessions",
			label: "Kiosk Session Types",
			description:
				"Configure which session types can be started/ended from kiosks",
			icon: "Monitor",
			fields: [
				{
					key: "kiosk.sessions.regular.enabled",
					label: "Allow Regular Sessions on Kiosks",
					description:
						"Allow users to start and end regular sessions from kiosk devices",
					type: "boolean",
					defaultValue: true,
				},
				{
					key: "kiosk.sessions.staffing.enabled",
					label: "Allow Staffing Sessions on Kiosks",
					description:
						"Allow users to start and end staffing sessions from kiosk devices",
					type: "boolean",
					defaultValue: true,
				},
			],
		},
	],
} as const);

export type SessionConfigType = ExtractConfigType<typeof sessionConfig>;
