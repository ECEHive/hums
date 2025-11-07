import type { ShiftScheduleUpdateEvent } from "@ecehive/features";
import { shiftScheduleEvents } from "@ecehive/features";
import { tracked } from "@trpc/server";
import z from "zod";

export const ZOnScheduleUpdateSchema = z.object({
	periodId: z.number().min(1),
	lastEventId: z.string().nullish(),
});

export type TOnScheduleUpdateSchema = z.infer<typeof ZOnScheduleUpdateSchema>;

/**
 * Subscription that streams real-time shift schedule registration updates.
 * Clients receive events when users register or unregister for shifts.
 */
export async function* onScheduleUpdateHandler(opts: {
	input: TOnScheduleUpdateSchema;
	signal?: AbortSignal;
}) {
	const { periodId } = opts.input;

	console.log("[Subscription] Client subscribed to period:", periodId);

	// Create an async iterable from the event emitter
	// This properly handles the EventEmitter and AbortSignal
	const iterable = shiftScheduleEvents.toIterable("update", {
		signal: opts.signal,
	});

	// Listen for new events and yield them with tracking
	for await (const [data] of iterable) {
		const event = data as ShiftScheduleUpdateEvent;

		console.log(
			"[Subscription] Received event for period:",
			event.periodId,
			"Subscribed to:",
			periodId,
		);

		// Only send events for the requested period
		if (event.periodId === periodId) {
			// Use the timestamp as the event ID for tracking
			const eventId = event.timestamp.getTime().toString();
			console.log("[Subscription] Sending event to client:", eventId);
			yield tracked(eventId, event);
		}
	}

	console.log("[Subscription] Client unsubscribed from period:", periodId);
}
