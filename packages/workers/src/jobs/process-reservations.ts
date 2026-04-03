import { processReservationGracePeriod } from "@ecehive/features";
import { getLogger } from "@ecehive/logger";
import { CronJob } from "cron";

const logger = getLogger("workers:reservation-grace-period");

/**
 * Processes reservations that have exceeded their grace period or expired.
 *
 * This job:
 * 1. Finds PENDING reservations past their start time + grace period → marks as NO_SHOW
 * 2. Finds ACTIVE reservations past their end time → marks as COMPLETED
 *
 * Runs every minute.
 */
export async function processReservations(): Promise<void> {
	try {
		const results = await processReservationGracePeriod();

		if (results.length > 0) {
			const noShows = results.filter((r) => r.action === "no_show");
			const completed = results.filter((r) => r.action === "completed");

			if (noShows.length > 0) {
				logger.info("Reservations marked as no-show", {
					count: noShows.length,
					reservations: noShows.map((r) => ({
						id: r.reservationId,
						controlPoint: r.controlPointName,
						user: r.userName,
					})),
				});
			}

			if (completed.length > 0) {
				logger.info("Reservations completed", {
					count: completed.length,
					reservations: completed.map((r) => ({
						id: r.reservationId,
						controlPoint: r.controlPointName,
						user: r.userName,
					})),
				});
			}
		}
	} catch (err) {
		logger.error("Failed to process reservation grace periods", {
			error: err instanceof Error ? err.message : String(err),
		});
		throw err;
	}
}

// Run every minute
export const processReservationsJob = new CronJob(
	"* * * * *",
	processReservations,
);
