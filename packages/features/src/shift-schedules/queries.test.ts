import { describe, expect, it, vi } from "vitest";
import { getAllSchedulesForBalancing, type PrismaTransaction } from "./queries";

describe("getAllSchedulesForBalancing", () => {
	// #381: schedules from past periods blocked registration
	it("only returns schedules in the period, with the fields balancing reads", async () => {
		const findMany = vi.fn().mockResolvedValue([]);
		const prisma = {
			shiftSchedule: { findMany },
		} as unknown as PrismaTransaction;

		await getAllSchedulesForBalancing(prisma, 7);

		// Without slots, full schedules block again; without users, everything counts as empty.
		expect(findMany.mock.calls[0][0]).toEqual({
			where: { shiftType: { periodId: 7 } },
			select: {
				id: true,
				shiftTypeId: true,
				dayOfWeek: true,
				startTime: true,
				endTime: true,
				slots: true,
				users: { select: { id: true } },
			},
		});
	});
});
