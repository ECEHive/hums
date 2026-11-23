import { describe, expect, it, vi } from "vitest";
import type { Transaction } from "../types/transaction";
import {
	assignUserToScheduleOccurrences,
	unassignUserFromScheduleOccurrences,
} from "./generators";

const USER = 5;
const WEEK1 = new Date("2026-01-05T15:00:00Z");
const WEEK2 = new Date("2026-01-12T15:00:00Z");

function occurrence(id: number, timestamp: Date, userIds: number[]) {
	return { id, timestamp, users: userIds.map((userId) => ({ id: userId })) };
}

function mockTx({
	occurrences = [] as ReturnType<typeof occurrence>[],
	assigned = [] as { id: number }[],
} = {}) {
	const findMany = vi.fn(({ where }) =>
		Promise.resolve(where.users ? assigned : occurrences),
	);
	const update = vi.fn().mockResolvedValue({ id: USER });
	const tx = {
		shiftOccurrence: { findMany },
		user: { update },
	} as unknown as Transaction;
	return { tx, update, findMany };
}

describe("assignUserToScheduleOccurrences", () => {
	it("connects the emptiest slot of every week in one update", async () => {
		const { tx, update, findMany } = mockTx({
			occurrences: [
				occurrence(1, WEEK1, [1, 2]),
				occurrence(2, WEEK1, [3]),
				occurrence(3, WEEK2, []),
				occurrence(4, WEEK2, [4]),
			],
		});

		await assignUserToScheduleOccurrences(tx, 10, USER);

		expect(findMany).toHaveBeenCalledTimes(1);
		expect(update).toHaveBeenCalledTimes(1);
		expect(update.mock.calls[0][0]).toMatchObject({
			where: { id: USER },
			data: { shiftOccurrences: { connect: [{ id: 2 }, { id: 3 }] } },
		});
	});

	it("gives ties to the first slot", async () => {
		const { tx, update } = mockTx({
			occurrences: [occurrence(1, WEEK1, [1]), occurrence(2, WEEK1, [2])],
		});

		await assignUserToScheduleOccurrences(tx, 10, USER);

		expect(update.mock.calls[0][0].data.shiftOccurrences.connect).toEqual([
			{ id: 1 },
		]);
	});

	it("skips weeks the user already has a slot in", async () => {
		const { tx, update } = mockTx({
			occurrences: [
				occurrence(1, WEEK1, [USER]),
				occurrence(2, WEEK1, []),
				occurrence(3, WEEK2, []),
			],
		});

		await assignUserToScheduleOccurrences(tx, 10, USER);

		expect(update.mock.calls[0][0].data.shiftOccurrences.connect).toEqual([
			{ id: 3 },
		]);
	});

	it("writes nothing when every week is already assigned", async () => {
		const { tx, update } = mockTx({
			occurrences: [occurrence(1, WEEK1, [USER]), occurrence(2, WEEK1, [])],
		});

		await assignUserToScheduleOccurrences(tx, 10, USER);

		expect(update).not.toHaveBeenCalled();
	});
});

describe("unassignUserFromScheduleOccurrences", () => {
	it("disconnects the user's occurrences in one update", async () => {
		const { tx, update } = mockTx({ assigned: [{ id: 1 }, { id: 3 }] });

		await unassignUserFromScheduleOccurrences(tx, 10, USER);

		expect(update).toHaveBeenCalledTimes(1);
		expect(update.mock.calls[0][0]).toMatchObject({
			where: { id: USER },
			data: { shiftOccurrences: { disconnect: [{ id: 1 }, { id: 3 }] } },
		});
	});

	it("writes nothing when the user has no occurrences", async () => {
		const { tx, update } = mockTx();

		await unassignUserFromScheduleOccurrences(tx, 10, USER);

		expect(update).not.toHaveBeenCalled();
	});
});
