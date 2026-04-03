import { defineConfig, type ExtractConfigType } from "../types";

/**
 * Reservation Configuration
 * Defines global configuration options for control point reservations
 */
export const reservationConfig = defineConfig({
	groups: [
		{
			id: "reservation-general",
			label: "Reservation Settings",
			description: "Configure global settings for control point reservations",
			icon: "CalendarClock",
			fields: [
				{
					key: "reservations.max_per_user",
					label: "Max Reservations Per User",
					description:
						"Maximum number of active or upcoming reservations a single user can hold at once",
					type: "number",
					defaultValue: 3,
					min: 1,
					max: 50,
					step: 1,
				},
				{
					key: "reservations.grace_period_minutes",
					label: "Grace Period (Minutes)",
					description:
						"Number of minutes after a reservation's start time before it is automatically cancelled if not checked in",
					type: "number",
					defaultValue: 15,
					min: 1,
					max: 120,
					step: 1,
				},
			] as const,
		},
	] as const,
});

export type ReservationConfigType = ExtractConfigType<typeof reservationConfig>;
