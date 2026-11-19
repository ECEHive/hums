import { beforeEach, describe, expect, it, vi } from "vitest";

const { mockPrisma, mockProvider } = vi.hoisted(() => ({
	mockPrisma: {
		controlGateway: { findUnique: vi.fn() },
		credential: { findUnique: vi.fn() },
		session: { findFirst: vi.fn() },
		controlLog: { create: vi.fn() },
		controlPoint: { update: vi.fn() },
	},
	mockProvider: {
		readState: vi.fn(),
		writeState: vi.fn(),
	},
}));

vi.mock("@ecehive/prisma", () => ({ prisma: mockPrisma }));
vi.mock("../credentials/hash", () => ({
	hashCredential: (value: string) => `hash:${value}`,
}));
vi.mock("./providers", () => ({ getControlProvider: () => mockProvider }));

import {
	GatewayError,
	type GatewayErrorCode,
	invokeControlGateway,
} from "./invoke-control-gateway";

// --- Fixtures ---

type User = {
	id: number;
	username: string;
	isSystemUser: boolean;
	roles: { id: number }[];
};

const operator: User = {
	id: 1,
	username: "op",
	isSystemUser: false,
	roles: [{ id: 10 }],
};
const users: Record<string, User> = { "111": operator };

function point(overrides: Record<string, unknown> = {}) {
	return {
		id: "p1",
		name: "Bandsaw",
		controlClass: "SWITCH",
		currentState: false,
		isActive: true,
		requiresBuddy: false,
		providerConfig: {},
		provider: { isActive: true, providerType: "GEORGIA_TECH_PLC", config: {} },
		authorizedRoles: [{ id: 10 }],
		authorizedUsers: [],
		...overrides,
	};
}

function gateway(
	actions: { action: string; controlPoint: ReturnType<typeof point> }[],
) {
	return {
		id: 7,
		name: "Bandsaw kiosk",
		isActive: true,
		actions: actions.map((a, i) => ({ id: i + 1, ...a })),
	};
}

function invoke(credentialValue = "111") {
	return invokeControlGateway({ accessToken: "token", credentialValue });
}

async function expectGatewayError(
	promise: Promise<unknown>,
	code: GatewayErrorCode,
) {
	const error = await promise.catch((e: unknown) => e);
	expect(error).toBeInstanceOf(GatewayError);
	expect((error as GatewayError).code).toBe(code);
	return error as GatewayError;
}

beforeEach(() => {
	vi.clearAllMocks();
	mockPrisma.credential.findUnique.mockImplementation(
		({ where }: { where: { hash: string } }) => {
			const user = users[where.hash.replace("hash:", "")];
			return Promise.resolve(user ? { user } : null);
		},
	);
	mockPrisma.session.findFirst.mockResolvedValue({ id: 99 });
	mockProvider.writeState.mockResolvedValue({ success: true });
});

// --- Tests ---

describe("all or nothing", () => {
	const allowed = point({ id: "p1", name: "Allowed" });
	const denied = point({
		id: "p2",
		name: "Denied",
		authorizedRoles: [{ id: 999 }],
	});

	it("runs nothing when any action is not permitted", async () => {
		mockPrisma.controlGateway.findUnique.mockResolvedValue(
			gateway([
				{ action: "TURN_ON", controlPoint: allowed },
				{ action: "TURN_ON", controlPoint: denied },
			]),
		);

		const error = await expectGatewayError(invoke(), "NOT_AUTHORIZED");

		expect(mockProvider.writeState).not.toHaveBeenCalled();
		expect(error.results).toMatchObject([
			{ status: "not_run" },
			{ status: "blocked", reason: "NOT_AUTHORIZED" },
		]);
		expect(error.message).toContain("not authorized");
	});

	it("reports unavailable equipment ahead of user problems", async () => {
		mockPrisma.controlGateway.findUnique.mockResolvedValue(
			gateway([
				{ action: "TURN_ON", controlPoint: denied },
				{
					action: "TURN_ON",
					controlPoint: point({ id: "p3", isActive: false }),
				},
			]),
		);

		const error = await expectGatewayError(invoke(), "ACTION_UNAVAILABLE");

		expect(error.results).toMatchObject([
			{ status: "blocked", reason: "NOT_AUTHORIZED" },
			{ status: "blocked", reason: "POINT_INACTIVE" },
		]);
	});

	it("stops at the first failed write and reports what already ran", async () => {
		mockPrisma.controlGateway.findUnique.mockResolvedValue(
			gateway([
				{ action: "TURN_ON", controlPoint: point({ id: "a", name: "A" }) },
				{ action: "TURN_ON", controlPoint: point({ id: "b", name: "B" }) },
				{ action: "TURN_ON", controlPoint: point({ id: "c", name: "C" }) },
			]),
		);
		mockProvider.writeState
			.mockResolvedValueOnce({ success: true })
			.mockResolvedValueOnce({ success: false, errorMessage: "PLC fault" });

		const error = await expectGatewayError(invoke(), "EXECUTION_FAILED");

		expect(mockProvider.writeState).toHaveBeenCalledTimes(2);
		expect(error.message).toContain("1 of 3");
		expect(error.results).toMatchObject([
			{ controlPointId: "a", status: "done" },
			{ controlPointId: "b", status: "failed", message: "PLC fault" },
			{ controlPointId: "c", status: "not_run" },
		]);
	});

	it("treats a provider exception as a failed write", async () => {
		mockPrisma.controlGateway.findUnique.mockResolvedValue(
			gateway([{ action: "TURN_ON", controlPoint: point() }]),
		);
		mockProvider.writeState.mockRejectedValue(new Error("socket hang up"));

		const error = await expectGatewayError(invoke(), "EXECUTION_FAILED");

		expect(error.message).toContain("nothing was run");
		expect(error.results).toMatchObject([
			{ status: "failed", message: "socket hang up" },
		]);
		expect(mockPrisma.controlLog.create).toHaveBeenCalledWith({
			data: expect.objectContaining({ success: false, newState: null }),
		});
	});

	it("does not report a database error after a write as a failed action", async () => {
		mockPrisma.controlGateway.findUnique.mockResolvedValue(
			gateway([{ action: "TURN_ON", controlPoint: point() }]),
		);
		mockPrisma.controlLog.create.mockRejectedValueOnce(new Error("db down"));

		const error = await invoke().catch((e: unknown) => e);

		expect(mockProvider.writeState).toHaveBeenCalledTimes(1);
		expect(error).not.toBeInstanceOf(GatewayError);
		expect((error as Error).message).toBe("db down");
	});

	it("runs every action, logs it and returns its new state", async () => {
		mockPrisma.controlGateway.findUnique.mockResolvedValue(
			gateway([
				{ action: "TURN_ON", controlPoint: allowed },
				{
					action: "TURN_OFF",
					controlPoint: point({ id: "p4", currentState: true }),
				},
			]),
		);

		const result = await invoke();

		expect(mockProvider.writeState).toHaveBeenNthCalledWith(
			1,
			{},
			{},
			true,
			"op",
		);
		expect(mockProvider.writeState).toHaveBeenNthCalledWith(
			2,
			{},
			{},
			false,
			"op",
		);
		expect(mockPrisma.controlLog.create).toHaveBeenCalledWith({
			data: expect.objectContaining({
				controlPointId: "p4",
				action: "TURN_OFF",
				previousState: true,
				newState: false,
				success: true,
			}),
		});
		expect(mockPrisma.controlPoint.update).toHaveBeenCalledWith({
			where: { id: "p4" },
			data: { currentState: false },
		});
		expect(result.results).toEqual([
			{
				controlPointId: "p1",
				controlPointName: "Allowed",
				action: "TURN_ON",
				status: "done",
				resolvedAction: "TURN_ON",
				newState: true,
			},
			{
				controlPointId: "p4",
				controlPointName: "Bandsaw",
				action: "TURN_OFF",
				status: "done",
				resolvedAction: "TURN_OFF",
				newState: false,
			},
		]);
	});
});

describe("TOGGLE", () => {
	it("turns an off switch on, using the live state, and logs TURN_ON", async () => {
		mockPrisma.controlGateway.findUnique.mockResolvedValue(
			// Cached state says on; the provider says off. The provider wins.
			gateway([
				{ action: "TOGGLE", controlPoint: point({ currentState: true }) },
			]),
		);
		mockProvider.readState.mockResolvedValue({ success: true, state: false });

		const result = await invoke();

		expect(mockProvider.writeState).toHaveBeenCalledWith({}, {}, true, "op");
		expect(mockPrisma.controlLog.create).toHaveBeenCalledWith({
			data: expect.objectContaining({
				action: "TURN_ON",
				previousState: false,
				newState: true,
			}),
		});
		expect(result.results).toMatchObject([
			{
				action: "TOGGLE",
				status: "done",
				resolvedAction: "TURN_ON",
				newState: true,
			},
		]);
	});

	it("turns an on switch off", async () => {
		mockPrisma.controlGateway.findUnique.mockResolvedValue(
			gateway([{ action: "TOGGLE", controlPoint: point() }]),
		);
		mockProvider.readState.mockResolvedValue({ success: true, state: true });

		const result = await invoke();

		expect(mockProvider.writeState).toHaveBeenCalledWith({}, {}, false, "op");
		expect(result.results).toMatchObject([
			{ status: "done", resolvedAction: "TURN_OFF", newState: false },
		]);
	});

	it("runs nothing when a live state cannot be read", async () => {
		mockPrisma.controlGateway.findUnique.mockResolvedValue(
			gateway([
				{ action: "TURN_ON", controlPoint: point({ id: "p0" }) },
				{ action: "TOGGLE", controlPoint: point() },
			]),
		);
		mockProvider.readState.mockResolvedValue({
			success: false,
			errorMessage: "PLC timeout",
		});

		const error = await expectGatewayError(invoke(), "CONTROL_UNAVAILABLE");

		expect(mockProvider.writeState).not.toHaveBeenCalled();
		expect(mockPrisma.controlLog.create).toHaveBeenCalledTimes(1);
		expect(mockPrisma.controlLog.create).toHaveBeenCalledWith({
			data: expect.objectContaining({
				controlPointId: "p1",
				userId: 1,
				action: "READ_STATE",
				success: false,
				errorMessage: "PLC timeout",
			}),
		});
		expect(error.results).toMatchObject([
			{ status: "not_run" },
			{ status: "failed", message: expect.stringContaining("PLC timeout") },
		]);
	});

	it("treats a provider exception as a failed read", async () => {
		mockPrisma.controlGateway.findUnique.mockResolvedValue(
			gateway([{ action: "TOGGLE", controlPoint: point() }]),
		);
		mockProvider.readState.mockRejectedValue(new Error("socket hang up"));

		const error = await expectGatewayError(invoke(), "CONTROL_UNAVAILABLE");

		expect(error.results).toMatchObject([
			{ status: "failed", message: expect.stringContaining("socket hang up") },
		]);
	});

	it("is rejected on door control points", async () => {
		mockPrisma.controlGateway.findUnique.mockResolvedValue(
			gateway([
				{ action: "TOGGLE", controlPoint: point({ controlClass: "DOOR" }) },
			]),
		);

		const error = await expectGatewayError(invoke(), "ACTION_UNAVAILABLE");

		expect(mockProvider.readState).not.toHaveBeenCalled();
		expect(error.results).toMatchObject([
			{ status: "blocked", reason: "TOGGLE_NOT_SWITCH" },
		]);
	});
});

describe("concurrent scans", () => {
	it("flips a TOGGLE twice when two scans arrive at once", async () => {
		mockPrisma.controlGateway.findUnique.mockResolvedValue(
			gateway([{ action: "TOGGLE", controlPoint: point() }]),
		);
		// A slow PLC: without a lock both scans would read "off".
		let plcState = false;
		mockProvider.readState.mockImplementation(async () => {
			await new Promise((r) => setTimeout(r, 10));
			return { success: true, state: plcState };
		});
		mockProvider.writeState.mockImplementation(
			async (_p: unknown, _c: unknown, state: boolean) => {
				await new Promise((r) => setTimeout(r, 10));
				plcState = state;
				return { success: true };
			},
		);

		const [first, second] = await Promise.all([invoke(), invoke()]);

		expect(first.results).toMatchObject([{ resolvedAction: "TURN_ON" }]);
		expect(second.results).toMatchObject([{ resolvedAction: "TURN_OFF" }]);
		expect(plcState).toBe(false);
	});
});

describe("active session", () => {
	it.each([
		["TURN_ON", "SWITCH"],
		["TURN_OFF", "SWITCH"],
		["TOGGLE", "SWITCH"],
		["UNLOCK", "DOOR"],
	])("is required for %s", async (action, controlClass) => {
		mockPrisma.controlGateway.findUnique.mockResolvedValue(
			gateway([{ action, controlPoint: point({ controlClass }) }]),
		);
		mockPrisma.session.findFirst.mockResolvedValue(null);

		const error = await expectGatewayError(invoke(), "NOT_AUTHORIZED");

		// No PLC traffic at all for a user who is not signed in.
		expect(mockProvider.readState).not.toHaveBeenCalled();
		expect(mockProvider.writeState).not.toHaveBeenCalled();
		expect(error.results).toMatchObject([
			{ status: "blocked", reason: "NO_ACTIVE_SESSION" },
		]);
		expect(error.message).toContain("sign in");
	});

	it("says not authorized when the user also lacks a permission", async () => {
		mockPrisma.controlGateway.findUnique.mockResolvedValue(
			gateway([
				{ action: "TURN_ON", controlPoint: point() },
				{
					action: "TURN_ON",
					controlPoint: point({ id: "p2", authorizedRoles: [{ id: 999 }] }),
				},
			]),
		);
		mockPrisma.session.findFirst.mockResolvedValue(null);

		const error = await expectGatewayError(invoke(), "NOT_AUTHORIZED");

		expect(error.message).toContain("not authorized");
	});

	it("is not required for system users", async () => {
		users["333"] = { ...operator, id: 3, isSystemUser: true };
		mockPrisma.controlGateway.findUnique.mockResolvedValue(
			gateway([{ action: "TURN_ON", controlPoint: point() }]),
		);
		mockPrisma.session.findFirst.mockResolvedValue(null);

		const result = await invoke("333");

		expect(result.results[0].status).toBe("done");
		delete users["333"];
	});
});

describe("requiresBuddy", () => {
	it("rejects buddy-required points, including for system users", async () => {
		users["333"] = { ...operator, id: 3, isSystemUser: true };
		mockPrisma.controlGateway.findUnique.mockResolvedValue(
			gateway([
				{ action: "TURN_ON", controlPoint: point({ requiresBuddy: true }) },
			]),
		);

		for (const credentialValue of ["111", "333"]) {
			const error = await expectGatewayError(
				invoke(credentialValue),
				"ACTION_UNAVAILABLE",
			);
			expect(error.results).toMatchObject([
				{ status: "blocked", reason: "REQUIRES_BUDDY" },
			]);
		}
		expect(mockProvider.writeState).not.toHaveBeenCalled();
		delete users["333"];
	});
});

describe("errors", () => {
	it("rejects an unknown token", async () => {
		mockPrisma.controlGateway.findUnique.mockResolvedValue(null);
		await expectGatewayError(invoke(), "INVALID_TOKEN");
	});

	it("rejects an inactive gateway", async () => {
		mockPrisma.controlGateway.findUnique.mockResolvedValue({
			...gateway([]),
			isActive: false,
		});
		await expectGatewayError(invoke(), "GATEWAY_INACTIVE");
	});

	it("rejects an unknown card", async () => {
		mockPrisma.controlGateway.findUnique.mockResolvedValue(gateway([]));
		await expectGatewayError(invoke("000"), "INVALID_CREDENTIAL");
	});
});
