import { beforeEach, describe, expect, it, vi } from "vitest";

const { mockPrisma } = vi.hoisted(() => ({
	mockPrisma: { controlPoint: { findMany: vi.fn() } },
}));

vi.mock("@ecehive/prisma", () => ({ prisma: mockPrisma }));

import { validateGatewayActions } from "./validate-gateway-actions";

const SAW = "00000000-0000-4000-8000-000000000001";
const DOOR = "00000000-0000-4000-8000-000000000002";

beforeEach(() => {
	mockPrisma.controlPoint.findMany.mockImplementation(
		({ where }: { where: { id: { in: string[] } } }) =>
			Promise.resolve(
				[
					{ id: SAW, name: "Bandsaw", controlClass: "SWITCH" },
					{ id: DOOR, name: "Shop door", controlClass: "DOOR" },
				].filter((p) => where.id.in.includes(p.id)),
			),
	);
});

describe("validateGatewayActions", () => {
	it("accepts one valid action per point", async () => {
		await expect(
			validateGatewayActions([
				{ controlPointId: SAW, action: "TURN_ON" },
				{ controlPointId: DOOR, action: "UNLOCK" },
			]),
		).resolves.toBeUndefined();
	});

	it.each([
		["TURN_ON", "TURN_ON"],
		["TURN_ON", "TURN_OFF"],
	] as const)("rejects a point used twice (%s, %s)", async (first, second) => {
		await expect(
			validateGatewayActions([
				{ controlPointId: SAW, action: first },
				{ controlPointId: SAW, action: second },
			]),
		).rejects.toMatchObject({
			code: "BAD_REQUEST",
			message: expect.stringContaining("Bandsaw is used more than once"),
		});
	});

	it.each([
		[SAW, "UNLOCK", "Switch control points"],
		[DOOR, "TURN_ON", "Door control points"],
		["00000000-0000-4000-8000-000000000009", "TURN_ON", "not found"],
	] as const)("rejects %s with %s", async (controlPointId, action, message) => {
		await expect(
			validateGatewayActions([{ controlPointId, action }]),
		).rejects.toMatchObject({
			code: "BAD_REQUEST",
			message: expect.stringContaining(message),
		});
	});
});
