import { beforeEach, describe, expect, it, vi } from "vitest";

const { mockPrisma } = vi.hoisted(() => ({
	mockPrisma: {
		controlGateway: { findUnique: vi.fn(), update: vi.fn() },
	},
}));

vi.mock("@ecehive/prisma", () => ({ prisma: mockPrisma }));

import { regenerateControlGatewayToken } from "./regenerate-control-gateway-token";

beforeEach(() => {
	vi.clearAllMocks();
	mockPrisma.controlGateway.update.mockImplementation(
		({ data }: { data: { accessToken: string } }) =>
			Promise.resolve({ id: 7, name: "Bandsaw kiosk", ...data }),
	);
});

describe("regenerateControlGatewayToken", () => {
	it("replaces the token with a new random one", async () => {
		mockPrisma.controlGateway.findUnique.mockResolvedValue({ id: 7 });

		const first = await regenerateControlGatewayToken(7);
		const second = await regenerateControlGatewayToken(7);

		expect(first.accessToken).toMatch(/^[0-9a-f]{64}$/);
		expect(second.accessToken).not.toBe(first.accessToken);
		expect(mockPrisma.controlGateway.update).toHaveBeenCalledWith(
			expect.objectContaining({ where: { id: 7 } }),
		);
	});

	it("rejects an unknown gateway", async () => {
		mockPrisma.controlGateway.findUnique.mockResolvedValue(null);

		await expect(regenerateControlGatewayToken(404)).rejects.toMatchObject({
			code: "NOT_FOUND",
		});
		expect(mockPrisma.controlGateway.update).not.toHaveBeenCalled();
	});
});
