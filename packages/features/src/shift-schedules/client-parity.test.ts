import { describe, expect, it } from "vitest";
import {
	applyScheduleDelta,
	type SchedulesData,
} from "../../../../apps/client/src/components/shift-schedules/schedule-delta-utils";
import type { ShiftSchedule } from "../../../../apps/client/src/components/shift-schedules/shift-scheduler-utils";
import {
	type BalancingScheduleLite,
	meetsBalancingRequirementForAll,
} from "./validation";

// The client recomputes balancing itself after each live update; if it drifts
// from the server, students see shifts as open that the server will refuse.
describe("client balancing after a live update", () => {
	function random(seed: number) {
		let state = seed;
		return (n: number) => {
			state = (Math.imul(state, 1103515245) + 12345) >>> 0;
			return (state >>> 16) % n;
		};
	}

	it("matches what the registration list computes", () => {
		const pick = random(381);
		const userIds = (count: number) =>
			Array.from({ length: count }, (_, i) => ({
				id: i + 1,
				name: `U${i + 1}`,
			}));
		const time = (minutes: number) =>
			`${String(Math.floor(minutes / 60)).padStart(2, "0")}:${String(minutes % 60).padStart(2, "0")}`;
		let compared = 0;
		let blocked = 0;

		for (let layout = 0; layout < 300; layout++) {
			const flags = new Map(
				[1, 2, 3].map((id) => [
					id,
					{
						isBalancedAcrossPeriod: pick(2) === 0,
						isBalancedAcrossDay: pick(2) === 0,
						isBalancedAcrossOverlap: pick(2) === 0,
					},
				]),
			);
			const currentUserId = 1 + pick(6);

			const schedules: ShiftSchedule[] = Array.from(
				{ length: 2 + pick(20) },
				(_, i) => {
					const start = 8 * 60 + pick(16) * 30;
					const slots = pick(4);
					const users = userIds(6).slice(0, pick(slots + 1));
					const shiftTypeId = 1 + pick(3);
					const typeFlags = flags.get(shiftTypeId);
					if (!typeFlags) throw new Error(`no flags for ${shiftTypeId}`);
					return {
						id: i + 1,
						shiftTypeId,
						shiftTypeName: "",
						shiftTypeColor: null,
						shiftTypeLocation: "",
						slots,
						dayOfWeek: pick(3),
						startTime: time(start),
						endTime: time(start + 30 * (1 + pick(4))),
						availableSlots: slots - users.length,
						isRegistered: users.some((u) => u.id === currentUserId),
						canRegister: false,
						canUnregister: false,
						canSelfAssign: true,
						meetsRoleRequirement: true,
						meetsBalancingRequirement: false,
						hasTimeOverlap: false,
						blockedByMaxRequirement: false,
						users,
						...typeFlags,
					};
				},
			);
			const data: SchedulesData = {
				period: {
					id: 1,
					scheduleSignupStart: "2026-01-01T00:00:00Z",
					scheduleSignupEnd: "2027-01-01T00:00:00Z",
					min: null,
					max: null,
					minMaxUnit: null,
				},
				schedules,
				isWithinSignupWindow: true,
				isWithinModifyWindow: true,
				isWithinVisibilityWindow: true,
				requirementProgress: null,
			};

			const target = schedules[pick(schedules.length)] as ShiftSchedule;
			const after = applyScheduleDelta(
				data,
				{
					type: "register",
					shiftScheduleId: target.id,
					userId: currentUserId,
					periodId: 1,
					timestamp: new Date(0),
					delta: {
						user: { id: currentUserId, name: "" },
						availableSlots: 0,
						totalSlots: target.slots,
						users: userIds(6).slice(0, pick(target.slots + 1)),
					},
				},
				currentUserId,
			);

			const server = meetsBalancingRequirementForAll(
				after.schedules.map(
					(s): BalancingScheduleLite => ({
						id: s.id,
						shiftTypeId: s.shiftTypeId,
						dayOfWeek: s.dayOfWeek,
						startTime: s.startTime,
						endTime: s.endTime,
						slots: s.slots,
						users: s.users,
					}),
				),
				flags,
			);
			for (const s of after.schedules) {
				const expected = server.get(s.id);
				expect(
					s.meetsBalancingRequirement,
					`layout ${layout}, schedule ${s.id}`,
				).toBe(expected);
				compared++;
				if (!expected) blocked++;
			}
		}

		expect(compared).toBeGreaterThan(2500);
		// Guards the generator: mostly-empty layouts would pass trivially
		expect(blocked / compared).toBeGreaterThan(0.2);
	});
});
