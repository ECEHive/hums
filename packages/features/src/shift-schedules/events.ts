import { EventEmitter, on } from "node:events";

/**
 * User info included in delta updates for proper client state management
 */
export interface ShiftScheduleUser {
	id: number;
	name: string;
}

/**
 * Delta-based event for shift schedule updates.
 * Contains all information needed to update client state without refetching.
 */
export interface ShiftScheduleUpdateEvent {
	type: "register" | "unregister";
	shiftScheduleId: number;
	userId: number;
	periodId: number;
	timestamp: Date;
	/**
	 * Delta information for applying changes directly to client cache.
	 * Allows clients to update their local state without full refetch.
	 */
	delta: {
		/** The user who registered/unregistered */
		user: ShiftScheduleUser;
		/** Updated slot count after the change */
		availableSlots: number;
		/** Total slots for context */
		totalSlots: number;
		/** Updated list of all users registered for this shift */
		users: ShiftScheduleUser[];
	};
}

export const SHIFT_SCHEDULE_BATCH_MS = 250;

/**
 * Updates are sent to subscribers in batches: writing each update separately to
 * every open subscription was the biggest cost during signup rushes. The first
 * update starts one timer; every update lands in exactly one batch, in order.
 */
class ShiftScheduleEventEmitter extends EventEmitter {
	#pending: ShiftScheduleUpdateEvent[] = [];
	#timer: ReturnType<typeof setTimeout> | null = null;

	emitUpdate(event: ShiftScheduleUpdateEvent) {
		this.#pending.push(event);
		if (this.#timer === null) {
			this.#timer = setTimeout(() => this.#flush(), SHIFT_SCHEDULE_BATCH_MS);
		}
	}

	#flush() {
		const events = this.#pending;
		this.#pending = [];
		this.#timer = null;
		this.emit("batch", events);
	}

	batches(signal?: AbortSignal): AsyncIterable<[ShiftScheduleUpdateEvent[]]> {
		return on(this, "batch", { signal }) as AsyncIterable<
			[ShiftScheduleUpdateEvent[]]
		>;
	}
}

export const shiftScheduleEvents = new ShiftScheduleEventEmitter();
// Every open signup page holds one listener
shiftScheduleEvents.setMaxListeners(0);
