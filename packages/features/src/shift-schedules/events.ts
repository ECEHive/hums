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

class ShiftScheduleEventEmitter extends EventEmitter {
	emitUpdate(event: ShiftScheduleUpdateEvent) {
		this.emit("update", event);
	}

	/**
	 * Convert EventEmitter to async iterable for use in subscriptions
	 * This wraps Node's `on()` helper to create an async iterator
	 */
	toIterable<K extends string | symbol>(
		event: K,
		options?: { signal?: AbortSignal },
	): AsyncIterable<unknown[]> {
		return on(this, event, options) as AsyncIterable<unknown[]>;
	}
}

export const shiftScheduleEvents = new ShiftScheduleEventEmitter();
