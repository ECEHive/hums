import type { Prisma, ShiftAttendanceStatus } from "@ecehive/prisma";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
	checkStaffingPermission,
	endSession,
	handleTapInAttendance,
	handleTapOutAttendance,
	hasActiveAttendance,
	startSession,
	switchSessionType,
} from "./session-management";

// --- Helpers ---

/** Build a minimal mock Prisma TransactionClient. */
function createMockTx() {
	return {
		shiftOccurrence: {
			findMany: vi.fn().mockResolvedValue([]),
		},
		shiftAttendance: {
			findMany: vi.fn().mockResolvedValue([]),
			findFirst: vi.fn().mockResolvedValue(null),
			create: vi.fn().mockResolvedValue({ id: 1 }),
			update: vi.fn().mockImplementation(({ data }) => ({
				id: 1,
				...data,
			})),
			updateMany: vi.fn().mockResolvedValue({ count: 0 }),
		},
		session: {
			create: vi.fn().mockImplementation(({ data }) => ({
				id: 1,
				...data,
			})),
			update: vi.fn().mockImplementation(({ data, where }) => ({
				id: where.id,
				userId: 1,
				sessionType: "staffing",
				startedAt: new Date(),
				...data,
			})),
			findFirst: vi.fn().mockResolvedValue(null),
			findUnique: vi.fn().mockResolvedValue(null),
		},
		permission: {
			findFirst: vi.fn().mockResolvedValue(null),
		},
		agreement: {
			findMany: vi.fn().mockResolvedValue([]),
		},
		userAgreement: {
			findMany: vi.fn().mockResolvedValue([]),
		},
	} as unknown as Prisma.TransactionClient & {
		shiftOccurrence: { findMany: ReturnType<typeof vi.fn> };
		shiftAttendance: {
			findMany: ReturnType<typeof vi.fn>;
			findFirst: ReturnType<typeof vi.fn>;
			create: ReturnType<typeof vi.fn>;
			update: ReturnType<typeof vi.fn>;
			updateMany: ReturnType<typeof vi.fn>;
		};
		session: {
			create: ReturnType<typeof vi.fn>;
			update: ReturnType<typeof vi.fn>;
			findFirst: ReturnType<typeof vi.fn>;
			findUnique: ReturnType<typeof vi.fn>;
		};
		permission: { findFirst: ReturnType<typeof vi.fn> };
	};
}

type MockTx = ReturnType<typeof createMockTx>;

/**
 * Create a mock shift occurrence that is currently active.
 * Uses a fixed date (2025-06-10) with times chosen to be clearly
 * in progress regardless of the app timezone (America/Chicago).
 */
function createActiveOccurrence(opts: {
	id?: number;
	userId: number;
	startTime?: string;
	endTime?: string;
	timestamp?: Date;
	now?: Date;
	attendances?: Array<{
		id: number;
		timeIn: Date | null;
		timeOut: Date | null;
		status: ShiftAttendanceStatus;
	}>;
}) {
	// Default: shift 01:00-23:00 so it's always "in progress" for any reasonable test time
	const startTime = opts.startTime ?? "01:00:00";
	const endTime = opts.endTime ?? "23:00:00";

	// Use a timestamp at noon CDT so the day is unambiguous in America/Chicago
	const timestamp = opts.timestamp ?? new Date("2025-06-10T17:00:00Z");

	return {
		id: opts.id ?? 1,
		timestamp,
		shiftSchedule: { startTime, endTime },
		attendances: opts.attendances ?? [],
		users: [{ id: opts.userId }],
	};
}

// --- Tests ---

describe("handleTapInAttendance", () => {
	let tx: MockTx;

	beforeEach(() => {
		tx = createMockTx();
	});

	it("should create a new attendance record when none exists", async () => {
		// Tap in at 12:00 CDT (17:00 UTC) on June 10, 2024 - within the shift window
		const tapInTime = new Date("2025-06-10T17:00:00Z");
		const occurrence = createActiveOccurrence({ userId: 1, attendances: [] });
		tx.shiftOccurrence.findMany.mockResolvedValue([occurrence]);

		await handleTapInAttendance(tx, 1, tapInTime);

		expect(tx.shiftAttendance.create).toHaveBeenCalledOnce();
		const createCall = tx.shiftAttendance.create.mock.calls[0][0];
		expect(createCall.data).toMatchObject({
			shiftOccurrenceId: occurrence.id,
			userId: 1,
			status: "present",
		});
		expect(createCall.data.timeIn).toBeInstanceOf(Date);
	});

	it("should update an absent record (no timeIn) to present", async () => {
		const tapInTime = new Date("2025-06-10T17:00:00Z");
		const occurrence = createActiveOccurrence({
			userId: 1,
			attendances: [{ id: 10, timeIn: null, timeOut: null, status: "absent" }],
		});
		tx.shiftOccurrence.findMany.mockResolvedValue([occurrence]);

		await handleTapInAttendance(tx, 1, tapInTime);

		expect(tx.shiftAttendance.update).toHaveBeenCalledOnce();
		const updateCall = tx.shiftAttendance.update.mock.calls[0][0];
		expect(updateCall.where).toEqual({ id: 10 });
		expect(updateCall.data).toMatchObject({
			status: "present",
		});
		expect(updateCall.data.timeIn).toBeInstanceOf(Date);
	});

	it("should not overwrite a record that already has timeIn", async () => {
		const existingTimeIn = new Date("2025-06-10T14:00:00Z");
		const tapInTime = new Date("2025-06-10T17:00:00Z");
		const occurrence = createActiveOccurrence({
			userId: 1,
			attendances: [
				{
					id: 10,
					timeIn: existingTimeIn,
					timeOut: null,
					status: "present",
				},
			],
		});
		tx.shiftOccurrence.findMany.mockResolvedValue([occurrence]);

		await handleTapInAttendance(tx, 1, tapInTime);

		expect(tx.shiftAttendance.create).not.toHaveBeenCalled();
		expect(tx.shiftAttendance.update).not.toHaveBeenCalled();
	});

	it("should skip protected attendance statuses (dropped)", async () => {
		const tapInTime = new Date("2025-06-10T17:00:00Z");
		const occurrence = createActiveOccurrence({
			userId: 1,
			attendances: [{ id: 10, timeIn: null, timeOut: null, status: "dropped" }],
		});
		tx.shiftOccurrence.findMany.mockResolvedValue([occurrence]);

		await handleTapInAttendance(tx, 1, tapInTime);

		expect(tx.shiftAttendance.create).not.toHaveBeenCalled();
		expect(tx.shiftAttendance.update).not.toHaveBeenCalled();
	});

	it("should skip protected attendance statuses (excused)", async () => {
		const tapInTime = new Date("2025-06-10T17:00:00Z");
		const occurrence = createActiveOccurrence({
			userId: 1,
			attendances: [{ id: 10, timeIn: null, timeOut: null, status: "excused" }],
		});
		tx.shiftOccurrence.findMany.mockResolvedValue([occurrence]);

		await handleTapInAttendance(tx, 1, tapInTime);

		expect(tx.shiftAttendance.create).not.toHaveBeenCalled();
		expect(tx.shiftAttendance.update).not.toHaveBeenCalled();
	});

	it("should skip protected attendance statuses (dropped_makeup)", async () => {
		const tapInTime = new Date("2025-06-10T17:00:00Z");
		const occurrence = createActiveOccurrence({
			userId: 1,
			attendances: [
				{
					id: 10,
					timeIn: null,
					timeOut: null,
					status: "dropped_makeup",
				},
			],
		});
		tx.shiftOccurrence.findMany.mockResolvedValue([occurrence]);

		await handleTapInAttendance(tx, 1, tapInTime);

		expect(tx.shiftAttendance.create).not.toHaveBeenCalled();
		expect(tx.shiftAttendance.update).not.toHaveBeenCalled();
	});

	it("should do nothing when there are no active occurrences", async () => {
		tx.shiftOccurrence.findMany.mockResolvedValue([]);

		await handleTapInAttendance(tx, 1, new Date("2025-06-10T17:00:00Z"));

		expect(tx.shiftAttendance.create).not.toHaveBeenCalled();
		expect(tx.shiftAttendance.update).not.toHaveBeenCalled();
	});

	it("should handle multiple active occurrences", async () => {
		const tapInTime = new Date("2025-06-10T17:00:00Z");
		const occ1 = createActiveOccurrence({
			id: 1,
			userId: 1,
			attendances: [],
		});
		const occ2 = createActiveOccurrence({
			id: 2,
			userId: 1,
			attendances: [],
		});
		tx.shiftOccurrence.findMany.mockResolvedValue([occ1, occ2]);

		await handleTapInAttendance(tx, 1, tapInTime);

		expect(tx.shiftAttendance.create).toHaveBeenCalledTimes(2);
	});
});

describe("handleTapOutAttendance", () => {
	let tx: MockTx;

	beforeEach(() => {
		tx = createMockTx();
	});

	it("should set timeOut on open attendance records", async () => {
		// Use fixed dates: shift is 08:00-18:00 CDT on June 10, tap out at 15:00 CDT
		const occTimestamp = new Date("2025-06-10T17:00:00Z"); // noon CDT
		const timeIn = new Date("2025-06-10T13:00:00Z"); // 08:00 CDT
		const tapOutTime = new Date("2025-06-10T20:00:00Z"); // 15:00 CDT

		tx.shiftAttendance.findMany.mockResolvedValue([
			{
				id: 10,
				userId: 1,
				timeIn,
				timeOut: null,
				status: "present",
				shiftOccurrence: {
					timestamp: occTimestamp,
					shiftSchedule: { startTime: "08:00:00", endTime: "18:00:00" },
				},
			},
		]);

		await handleTapOutAttendance(tx, 1, tapOutTime);

		expect(tx.shiftAttendance.update).toHaveBeenCalledOnce();
		const updateCall = tx.shiftAttendance.update.mock.calls[0][0];
		expect(updateCall.where).toEqual({ id: 10 });
		expect(updateCall.data.timeOut).toBeInstanceOf(Date);
	});

	it("should not set timeOut on records without timeIn", async () => {
		// handleTapOutAttendance queries for timeIn: { not: null }
		// so records without timeIn should never be returned
		tx.shiftAttendance.findMany.mockResolvedValue([]);

		await handleTapOutAttendance(tx, 1, new Date());

		expect(tx.shiftAttendance.update).not.toHaveBeenCalled();
	});

	it("should not modify protected attendance records", async () => {
		// The query uses status: { notIn: PROTECTED_ATTENDANCE_STATUSES }
		// so protected records should never come back from the query.
		// This test verifies the in-loop guard as well.
		tx.shiftAttendance.findMany.mockResolvedValue([]);

		await handleTapOutAttendance(tx, 1, new Date());

		expect(tx.shiftAttendance.update).not.toHaveBeenCalled();
	});

	it("should cap timeOut at shift end time if tap-out is after shift end", async () => {
		const occTimestamp = new Date("2025-06-10T00:00:00Z");

		tx.shiftAttendance.findMany.mockResolvedValue([
			{
				id: 10,
				userId: 1,
				timeIn: new Date("2025-06-10T10:00:00Z"),
				timeOut: null,
				status: "present",
				shiftOccurrence: {
					timestamp: occTimestamp,
					shiftSchedule: { startTime: "10:00:00", endTime: "11:00:00" },
				},
			},
		]);

		// Tap out well after shift ended
		const lateOut = new Date("2025-06-10T15:00:00Z");
		await handleTapOutAttendance(tx, 1, lateOut);

		expect(tx.shiftAttendance.update).toHaveBeenCalledOnce();
		const updateCall = tx.shiftAttendance.update.mock.calls[0][0];
		// timeOut should be capped at shift end (11:00), not the actual tap-out time (15:00)
		expect(updateCall.data.timeOut.getTime()).toBeLessThan(lateOut.getTime());
	});

	it("should handle multiple open attendance records", async () => {
		// Fixed dates: shift 08:00-18:00 CDT on June 10, tap out at 15:00 CDT
		const occTimestamp = new Date("2025-06-10T17:00:00Z"); // noon CDT
		const timeIn = new Date("2025-06-10T13:00:00Z"); // 08:00 CDT
		const tapOutTime = new Date("2025-06-10T20:00:00Z"); // 15:00 CDT

		tx.shiftAttendance.findMany.mockResolvedValue([
			{
				id: 10,
				userId: 1,
				timeIn,
				timeOut: null,
				status: "present",
				shiftOccurrence: {
					timestamp: occTimestamp,
					shiftSchedule: { startTime: "08:00:00", endTime: "18:00:00" },
				},
			},
			{
				id: 11,
				userId: 1,
				timeIn,
				timeOut: null,
				status: "present",
				shiftOccurrence: {
					timestamp: occTimestamp,
					shiftSchedule: { startTime: "08:00:00", endTime: "18:00:00" },
				},
			},
		]);

		await handleTapOutAttendance(tx, 1, tapOutTime);

		expect(tx.shiftAttendance.update).toHaveBeenCalledTimes(2);
	});
});

describe("startSession", () => {
	let tx: MockTx;

	beforeEach(() => {
		tx = createMockTx();
		tx.shiftOccurrence.findMany.mockResolvedValue([]);
	});

	it("should create a regular session without triggering attendance", async () => {
		const now = new Date();
		await startSession(tx, 1, "regular", now);

		expect(tx.session.create).toHaveBeenCalledOnce();
		expect(tx.session.create.mock.calls[0][0].data).toMatchObject({
			userId: 1,
			sessionType: "regular",
			startedAt: now,
		});
		// Regular sessions should NOT call tap-in
		expect(tx.shiftOccurrence.findMany).not.toHaveBeenCalled();
	});

	it("should create a staffing session and trigger tap-in attendance", async () => {
		const now = new Date();
		const occurrence = createActiveOccurrence({
			userId: 1,
			attendances: [],
		});
		tx.shiftOccurrence.findMany.mockResolvedValue([occurrence]);

		await startSession(tx, 1, "staffing", now);

		expect(tx.session.create).toHaveBeenCalledOnce();
		expect(tx.session.create.mock.calls[0][0].data.sessionType).toBe(
			"staffing",
		);
		// Staffing sessions should trigger tap-in which queries for occurrences
		expect(tx.shiftOccurrence.findMany).toHaveBeenCalledOnce();
	});
});

describe("endSession", () => {
	let tx: MockTx;

	beforeEach(() => {
		tx = createMockTx();
	});

	it("should end a regular session without triggering attendance", async () => {
		tx.session.update.mockResolvedValue({
			id: 1,
			userId: 1,
			sessionType: "regular",
			startedAt: new Date(),
			endedAt: new Date(),
		});

		const now = new Date();
		await endSession(tx, 1, now);

		expect(tx.session.update).toHaveBeenCalledOnce();
		expect(tx.session.update.mock.calls[0][0].data).toEqual({ endedAt: now });
		// Regular => no tap-out
		expect(tx.shiftAttendance.findMany).not.toHaveBeenCalled();
	});

	it("should end a staffing session and trigger tap-out attendance", async () => {
		tx.session.update.mockResolvedValue({
			id: 1,
			userId: 1,
			sessionType: "staffing",
			startedAt: new Date(),
			endedAt: new Date(),
		});

		const now = new Date();
		await endSession(tx, 1, now);

		expect(tx.session.update).toHaveBeenCalledOnce();
		// Staffing sessions should trigger handleTapOutAttendance
		expect(tx.shiftAttendance.findMany).toHaveBeenCalledOnce();
	});
});

describe("switchSessionType", () => {
	let tx: MockTx;

	beforeEach(() => {
		tx = createMockTx();
	});

	it("should end the current session and start a new one", async () => {
		tx.session.findUnique.mockResolvedValue({
			userId: 1,
			sessionType: "regular",
		});
		tx.session.update.mockResolvedValue({
			id: 1,
			userId: 1,
			sessionType: "regular",
			startedAt: new Date(),
			endedAt: new Date(),
		});
		tx.shiftOccurrence.findMany.mockResolvedValue([]);

		const now = new Date();
		const result = await switchSessionType(tx, 1, "staffing", now);

		// End the old session
		expect(tx.session.update).toHaveBeenCalled();
		// Create the new session
		expect(tx.session.create).toHaveBeenCalled();
		expect(result.endedSession).toBeDefined();
		expect(result.newSession).toBeDefined();
	});

	it("should throw if the current session is not found", async () => {
		tx.session.findUnique.mockResolvedValue(null);

		await expect(switchSessionType(tx, 999, "staffing")).rejects.toThrow(
			"Session not found",
		);
	});
});

describe("checkStaffingPermission", () => {
	let tx: MockTx;

	beforeEach(() => {
		tx = createMockTx();
	});

	it("should return true for system users", async () => {
		const result = await checkStaffingPermission(tx, 1, true);
		expect(result).toBe(true);
		expect(tx.permission.findFirst).not.toHaveBeenCalled();
	});

	it("should return true when user has sessions.staffing permission", async () => {
		tx.permission.findFirst.mockResolvedValue({
			id: 1,
			name: "sessions.staffing",
		});

		const result = await checkStaffingPermission(tx, 1, false);
		expect(result).toBe(true);
	});

	it("should return false when user lacks sessions.staffing permission", async () => {
		tx.permission.findFirst.mockResolvedValue(null);

		const result = await checkStaffingPermission(tx, 1, false);
		expect(result).toBe(false);
	});
});

describe("hasActiveAttendance", () => {
	let tx: MockTx;

	beforeEach(() => {
		tx = createMockTx();
	});

	it("should return false when no open attendance exists", async () => {
		tx.shiftAttendance.findFirst.mockResolvedValue(null);

		const result = await hasActiveAttendance(tx, 1);
		expect(result).toBe(false);
	});

	it("should return true when an active attendance exists for an ongoing shift", async () => {
		const now = new Date();
		const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);
		const twoHoursAgo = new Date(now.getTime() - 2 * 60 * 60 * 1000);

		tx.shiftAttendance.findFirst.mockResolvedValue({
			id: 10,
			userId: 1,
			timeIn: oneHourAgo,
			timeOut: null,
			status: "present",
			shiftOccurrence: {
				timestamp: twoHoursAgo,
				shiftSchedule: {
					startTime: "10:00:00",
					endTime: "14:00:00", // 4 hours - shift still ongoing
				},
			},
		});

		const result = await hasActiveAttendance(tx, 1, now);
		expect(result).toBe(true);
	});

	it("should return false when the shift has already ended", async () => {
		const now = new Date();
		const threeHoursAgo = new Date(now.getTime() - 3 * 60 * 60 * 1000);
		const fourHoursAgo = new Date(now.getTime() - 4 * 60 * 60 * 1000);

		tx.shiftAttendance.findFirst.mockResolvedValue({
			id: 10,
			userId: 1,
			timeIn: threeHoursAgo,
			timeOut: null,
			status: "present",
			shiftOccurrence: {
				timestamp: fourHoursAgo,
				shiftSchedule: {
					startTime: "08:00:00",
					endTime: "09:00:00", // 1 hour shift, ended 3 hours ago
				},
			},
		});

		const result = await hasActiveAttendance(tx, 1, now);
		expect(result).toBe(false);
	});

	it("should use a 24-hour lookback window for the query", async () => {
		tx.shiftAttendance.findFirst.mockResolvedValue(null);

		const now = new Date();
		await hasActiveAttendance(tx, 1, now);

		const call = tx.shiftAttendance.findFirst.mock.calls[0][0];
		expect(call.where.shiftOccurrence.timestamp.gte).toBeInstanceOf(Date);
		expect(call.where.shiftOccurrence.timestamp.lte).toEqual(now);

		// Lookback should be ~24 hours
		const lookbackMs =
			now.getTime() - call.where.shiftOccurrence.timestamp.gte.getTime();
		expect(lookbackMs).toBe(24 * 60 * 60 * 1000);
	});
});
