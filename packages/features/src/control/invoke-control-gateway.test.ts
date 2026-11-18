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
				newState: true,
			},
			{
				controlPointId: "p4",
				controlPointName: "Bandsaw",
				action: "TURN_OFF",
				status: "done",
				newState: false,
			},
		]);
	});
});

describe("active session", () => {
	it.each([
		["TURN_ON", "SWITCH"],
		["TURN_OFF", "SWITCH"],
		["UNLOCK", "DOOR"],
	])("is required for %s", async (action, controlClass) => {
		mockPrisma.controlGateway.findUnique.mockResolvedValue(
			gateway([{ action, controlPoint: point({ controlClass }) }]),
		);
		mockPrisma.session.findFirst.mockResolvedValue(null);

		const error = await expectGatewayError(invoke(), "NOT_AUTHORIZED");

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
