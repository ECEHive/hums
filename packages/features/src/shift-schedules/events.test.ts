import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
	SHIFT_SCHEDULE_BATCH_MS,
	type ShiftScheduleUpdateEvent,
	shiftScheduleEvents,
} from "./events";

function update(shiftScheduleId: number): ShiftScheduleUpdateEvent {
	return {
		type: "register",
		shiftScheduleId,
		userId: 1,
		periodId: 1,
		timestamp: new Date(),
		delta: {
			user: { id: 1, name: "A" },
			availableSlots: 0,
			totalSlots: 1,
			users: [{ id: 1, name: "A" }],
		},
	};
}

describe("shiftScheduleEvents batching", () => {
	const batches: number[][] = [];
	const listener = (events: ShiftScheduleUpdateEvent[]) =>
		batches.push(events.map((e) => e.shiftScheduleId));

	beforeEach(() => {
		vi.useFakeTimers();
		batches.length = 0;
		shiftScheduleEvents.on("batch", listener);
	});

	afterEach(() => {
		shiftScheduleEvents.off("batch", listener);
		vi.useRealTimers();
	});

	it("sends updates together, in order, once the first one is a batch interval old", () => {
		shiftScheduleEvents.emitUpdate(update(1));
		vi.advanceTimersByTime(SHIFT_SCHEDULE_BATCH_MS - 1);
		shiftScheduleEvents.emitUpdate(update(2));
		expect(batches).toEqual([]);

		vi.advanceTimersByTime(1);
		expect(batches).toEqual([[1, 2]]);
	});

	it("puts every update in exactly one batch", () => {
		for (let id = 1; id <= 1000; id++) {
			shiftScheduleEvents.emitUpdate(update(id));
			vi.advanceTimersByTime(id % 7);
		}
		vi.advanceTimersByTime(SHIFT_SCHEDULE_BATCH_MS);

		expect(batches.flat()).toEqual(
			Array.from({ length: 1000 }, (_, i) => i + 1),
		);
		expect(batches.length).toBeGreaterThan(1);
	});

	it("stays idle when nothing changes", () => {
		vi.advanceTimersByTime(SHIFT_SCHEDULE_BATCH_MS * 10);
		expect(batches).toEqual([]);
		expect(vi.getTimerCount()).toBe(0);
	});
});
