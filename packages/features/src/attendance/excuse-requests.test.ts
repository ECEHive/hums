import type { ShiftAttendanceStatus } from "@ecehive/prisma";
import { describe, expect, it } from "vitest";
import {
	EXCUSE_REQUEST_WINDOW_MS,
	getExcuseRequestDeadline,
	getExcuseRequestEligibility,
} from "./excuse-requests";

const SHIFT_END = new Date("2025-01-15T15:00:00Z");
const HOUR_MS = 60 * 60 * 1000;

function createAttendance(
	overrides: Partial<Parameters<typeof getExcuseRequestEligibility>[0]> & {
		status: ShiftAttendanceStatus;
	},
): Parameters<typeof getExcuseRequestEligibility>[0] {
	return {
		isExcused: false,
		didArriveLate: false,
		didLeaveEarly: false,
		reviewedAt: null,
		excuseRequestedAt: null,
		...overrides,
	};
}

const afterShift = new Date(SHIFT_END.getTime() + HOUR_MS);

describe("getExcuseRequestDeadline", () => {
	it("is 24 hours after the shift ends", () => {
		expect(getExcuseRequestDeadline(SHIFT_END)).toEqual(
			new Date(SHIFT_END.getTime() + 24 * HOUR_MS),
		);
	});
});

describe("getExcuseRequestEligibility", () => {
	it.each([
		["absent", { status: "absent" as const }],
		["late", { status: "present" as const, didArriveLate: true }],
		["left early", { status: "present" as const, didLeaveEarly: true }],
	])("allows requests for %s shifts after the shift ends", (_, overrides) => {
		const result = getExcuseRequestEligibility(
			createAttendance(overrides),
			SHIFT_END,
			afterShift,
		);
		expect(result).toEqual({
			eligible: true,
			deadline: getExcuseRequestDeadline(SHIFT_END),
		});
	});

	it("rejects shifts with no issues", () => {
		const result = getExcuseRequestEligibility(
			createAttendance({ status: "present" }),
			SHIFT_END,
			afterShift,
		);
		expect(result.eligible).toBe(false);
	});

	it("rejects upcoming, dropped, and dropped makeup shifts", () => {
		for (const status of ["upcoming", "dropped", "dropped_makeup"] as const) {
			const result = getExcuseRequestEligibility(
				createAttendance({ status }),
				SHIFT_END,
				afterShift,
			);
			expect(result.eligible).toBe(false);
		}
	});

	it("rejects requests before the shift ends", () => {
		const result = getExcuseRequestEligibility(
			createAttendance({ status: "present", didArriveLate: true }),
			SHIFT_END,
			new Date(SHIFT_END.getTime() - HOUR_MS),
		);
		expect(result.eligible).toBe(false);
	});

	it("allows requests right up to the deadline", () => {
		const result = getExcuseRequestEligibility(
			createAttendance({ status: "absent" }),
			SHIFT_END,
			new Date(SHIFT_END.getTime() + EXCUSE_REQUEST_WINDOW_MS),
		);
		expect(result.eligible).toBe(true);
	});

	it("rejects requests after the deadline", () => {
		const result = getExcuseRequestEligibility(
			createAttendance({ status: "absent" }),
			SHIFT_END,
			new Date(SHIFT_END.getTime() + EXCUSE_REQUEST_WINDOW_MS + 1),
		);
		expect(result.eligible).toBe(false);
	});

	it("rejects already excused, reviewed, or requested shifts", () => {
		for (const overrides of [
			{ isExcused: true },
			{ reviewedAt: afterShift },
			{ excuseRequestedAt: afterShift },
		]) {
			const result = getExcuseRequestEligibility(
				createAttendance({ status: "absent", ...overrides }),
				SHIFT_END,
				afterShift,
			);
			expect(result.eligible).toBe(false);
		}
	});
});
