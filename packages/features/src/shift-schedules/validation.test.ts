import { describe, expect, it } from "vitest";
import {
	type BalancingScheduleLite,
	hasTimeOverlap,
	meetsBalancingRequirement,
	type ShiftScheduleLite,
	type ShiftTypeLite,
	validateBalancingRequirement,
	validateNoTimeOverlap,
} from "./validation";

function users(count: number) {
	return Array.from({ length: count }, (_, i) => ({ id: i + 1 }));
}

function schedule(
	overrides: Partial<BalancingScheduleLite> & { id: number },
): BalancingScheduleLite {
	return {
		shiftTypeId: 1,
		dayOfWeek: 1,
		startTime: "10:00",
		endTime: "12:00",
		slots: 3,
		users: [],
		...overrides,
	};
}

// Asserts meets/validate agree, so the list view and register can't disagree.
function expectBalancing(
	target: BalancingScheduleLite,
	all: BalancingScheduleLite[],
	allowed: boolean,
) {
	expect(meetsBalancingRequirement(target, all)).toBe(allowed);
	if (allowed) {
		expect(() => validateBalancingRequirement(target, all)).not.toThrow();
	} else {
		expect(() => validateBalancingRequirement(target, all)).toThrow();
	}
}

const MODES: {
	name: string;
	flags: ShiftTypeLite;
	violator: Partial<BalancingScheduleLite>;
	message: RegExp;
}[] = [
	{
		name: "isBalancedAcrossPeriod",
		flags: { isBalancedAcrossPeriod: true },
		violator: { dayOfWeek: 3, startTime: "14:00", endTime: "16:00" },
		message: /in the period/,
	},
	{
		name: "isBalancedAcrossDay",
		flags: { isBalancedAcrossDay: true },
		violator: { startTime: "14:00", endTime: "16:00" },
		message: /on Monday/,
	},
	{
		name: "isBalancedAcrossOverlap",
		flags: { isBalancedAcrossOverlap: true },
		violator: { startTime: "11:00", endTime: "13:00" },
		message: /overlapping/,
	},
];

describe.each(MODES)("balancing: $name", ({ flags, violator, message }) => {
	const target = schedule({ id: 1, users: users(2), shiftType: flags });

	it("blocks when a same-type schedule in scope has fewer users", () => {
		const other = schedule({ id: 2, users: users(1), ...violator });
		expectBalancing(target, [target, other], false);
		expect(() => validateBalancingRequirement(target, [target, other])).toThrow(
			message,
		);
	});

	// #381: other shift types (e.g. ones PIs can't sign up for) blocked registration
	it("ignores schedules of other shift types", () => {
		const other = schedule({
			id: 2,
			shiftTypeId: 2,
			users: users(1),
			...violator,
		});
		expectBalancing(target, [target, other], true);
	});

	it("allows when the same-type schedule has equal users", () => {
		const other = schedule({ id: 2, users: users(2), ...violator });
		expectBalancing(target, [target, other], true);
	});

	it("skips full schedules", () => {
		const full = schedule({ id: 2, slots: 1, users: users(1), ...violator });
		expectBalancing(target, [target, full], true);
	});
});

describe("balancing: scope of each mode", () => {
	it("day mode ignores other days", () => {
		const target = schedule({
			id: 1,
			users: users(2),
			shiftType: { isBalancedAcrossDay: true },
		});
		const otherDay = schedule({ id: 2, dayOfWeek: 2 });
		expectBalancing(target, [target, otherDay], true);
	});

	it.each([
		["back-to-back after", 1, "12:00", "14:00"],
		["back-to-back before", 1, "08:00", "10:00"],
		["same time on another day", 2, "10:00", "12:00"],
	])("overlap mode ignores %s", (_label, dayOfWeek, startTime, endTime) => {
		const target = schedule({
			id: 1,
			users: users(2),
			shiftType: { isBalancedAcrossOverlap: true },
		});
		const other = schedule({ id: 2, dayOfWeek, startTime, endTime });
		expectBalancing(target, [target, other], true);
	});

	it.each([
		["partial overlap", "11:59", "13:00"],
		["containing", "09:00", "13:00"],
		["contained", "10:30", "11:30"],
	])("overlap mode blocks on %s", (_label, startTime, endTime) => {
		const target = schedule({
			id: 1,
			users: users(2),
			shiftType: { isBalancedAcrossOverlap: true },
		});
		const other = schedule({ id: 2, startTime, endTime });
		expectBalancing(target, [target, other], false);
	});

	it("passes without a shift type or with all flags off", () => {
		const other = schedule({ id: 2 });
		const noType = schedule({ id: 1, users: users(2) });
		const flagsOff = schedule({
			id: 1,
			users: users(2),
			shiftType: {
				isBalancedAcrossPeriod: false,
				isBalancedAcrossDay: false,
				isBalancedAcrossOverlap: false,
			},
		});
		expectBalancing(noType, [noType, other], true);
		expectBalancing(flagsOff, [flagsOff, other], true);
	});

	it("excludes the target itself, even a stale copy with fewer users", () => {
		const shiftType = {
			isBalancedAcrossPeriod: true,
			isBalancedAcrossDay: true,
			isBalancedAcrossOverlap: true,
		};
		const target = schedule({ id: 1, users: users(2), shiftType });
		const staleCopy = schedule({ id: 1, shiftType });
		expectBalancing(target, [staleCopy], true);
	});
});

describe("hasTimeOverlap / validateNoTimeOverlap", () => {
	const target: ShiftScheduleLite = {
		id: 1,
		dayOfWeek: 1,
		startTime: "10:00",
		endTime: "12:00",
	};

	it("does not treat back-to-back or other-day registrations as overlapping", () => {
		const registered = [
			{ id: 2, dayOfWeek: 1, startTime: "08:00", endTime: "10:00" },
			{ id: 3, dayOfWeek: 1, startTime: "12:00", endTime: "14:00" },
			{ id: 4, dayOfWeek: 2, startTime: "10:00", endTime: "12:00" },
		];
		expect(hasTimeOverlap(target, registered)).toBe(false);
		expect(() => validateNoTimeOverlap(target, registered)).not.toThrow();
	});

	it("detects an overlap and names the conflicting shift", () => {
		const registered = [
			{ id: 2, dayOfWeek: 1, startTime: "11:00", endTime: "13:00" },
		];
		expect(hasTimeOverlap(target, registered)).toBe(true);
		expect(() => validateNoTimeOverlap(target, registered)).toThrow(
			"on Monday (11:00 - 13:00)",
		);
	});
});
