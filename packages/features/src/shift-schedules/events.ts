import { EventEmitter, on } from "node:events";

export interface ShiftScheduleUpdateEvent {
	type: "register" | "unregister";
	shiftScheduleId: number;
	userId: number;
	periodId: number;
	timestamp: Date;
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
