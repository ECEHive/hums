import { describe, expect, it, vi } from "vitest";
import { PluginRegistry } from "../registry";
import type { HumsPlugin, PluginServerContext } from "../types";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makePlugin(
	name: string,
	opts: Partial<
		Pick<HumsPlugin, "dependencies" | "optionalDependencies" | "server">
	> = {},
): HumsPlugin {
	return { name, ...opts };
}

/**
 * Minimal stub for PluginServerContext — enough to satisfy the interface
 * without importing any heavyweight server packages.
 */
const stubCtx = {} as unknown as PluginServerContext;
/** Context factory for loadAll — returns the shared stub regardless of plugin name. */
const ctxFactory = (_: string): PluginServerContext => stubCtx;

// ---------------------------------------------------------------------------
// register / getPlugin / has / getAll
// ---------------------------------------------------------------------------
describe("PluginRegistry — registration", () => {
	it("registers a plugin and makes it retrievable by name", () => {
		const registry = new PluginRegistry();
		const plugin = makePlugin("sessions");
		registry.register(plugin);

		expect(registry.getPlugin("sessions")).toBe(plugin);
	});

	it("has() returns true after registration", () => {
		const registry = new PluginRegistry();
		registry.register(makePlugin("sessions"));
		expect(registry.has("sessions")).toBe(true);
	});

	it("has() returns false for an unregistered plugin", () => {
		const registry = new PluginRegistry();
		expect(registry.has("sessions")).toBe(false);
	});

	it("getPlugin() returns undefined for an unregistered plugin", () => {
		const registry = new PluginRegistry();
		expect(registry.getPlugin("sessions")).toBeUndefined();
	});

	it("getAll() returns all registered plugins in insertion order", () => {
		const registry = new PluginRegistry();
		const a = makePlugin("alpha");
		const b = makePlugin("beta");
		registry.register(a);
		registry.register(b);

		expect(registry.getAll()).toEqual([a, b]);
	});

	it("throws when registering two plugins with the same name", () => {
		const registry = new PluginRegistry();
		registry.register(makePlugin("sessions"));

		expect(() => registry.register(makePlugin("sessions"))).toThrow(
			/already registered/i,
		);
	});
});

// ---------------------------------------------------------------------------
// loadAll — ordering and server.register calls
// ---------------------------------------------------------------------------
describe("PluginRegistry — loadAll ordering", () => {
	it("calls server.register for every plugin", async () => {
		const registry = new PluginRegistry();
		const calls: string[] = [];

		const pluginA: HumsPlugin = {
			name: "alpha",
			server: {
				register: async () => {
					calls.push("alpha");
				},
			},
		};
		const pluginB: HumsPlugin = {
			name: "beta",
			server: {
				register: async () => {
					calls.push("beta");
				},
			},
		};

		const importMap = {
			alpha: async () => pluginA,
			beta: async () => pluginB,
		};

		await registry.loadAll(["alpha", "beta"], importMap, ctxFactory);
		expect(calls).toHaveLength(2);
		expect(calls).toContain("alpha");
		expect(calls).toContain("beta");
	});

	it("registers a dependency before its dependent", async () => {
		const registry = new PluginRegistry();
		const order: string[] = [];

		const sessions: HumsPlugin = {
			name: "sessions",
			server: {
				register: async () => {
					order.push("sessions");
				},
			},
		};
		const attendance: HumsPlugin = {
			name: "attendance",
			dependencies: ["sessions"],
			server: {
				register: async () => {
					order.push("attendance");
				},
			},
		};

		const importMap = {
			sessions: async () => sessions,
			attendance: async () => attendance,
		};

		await registry.loadAll(["attendance", "sessions"], importMap, ctxFactory);

		expect(order.indexOf("sessions")).toBeLessThan(order.indexOf("attendance"));
	});

	it("handles chains of three dependencies in correct order", async () => {
		const registry = new PluginRegistry();
		const order: string[] = [];

		const a: HumsPlugin = {
			name: "a",
			server: {
				register: async () => {
					order.push("a");
				},
			},
		};
		const b: HumsPlugin = {
			name: "b",
			dependencies: ["a"],
			server: {
				register: async () => {
					order.push("b");
				},
			},
		};
		const c: HumsPlugin = {
			name: "c",
			dependencies: ["b"],
			server: {
				register: async () => {
					order.push("c");
				},
			},
		};

		const importMap = {
			a: async () => a,
			b: async () => b,
			c: async () => c,
		};

		await registry.loadAll(["c", "b", "a"], importMap, ctxFactory);

		expect(order).toEqual(["a", "b", "c"]);
	});

	it("skips server.register when a plugin has no server", async () => {
		const registry = new PluginRegistry();
		const called = vi.fn();

		const pluginA: HumsPlugin = { name: "alpha" }; // no server
		const pluginB: HumsPlugin = {
			name: "beta",
			server: { register: called },
		};

		await registry.loadAll(
			["alpha", "beta"],
			{ alpha: async () => pluginA, beta: async () => pluginB },
			ctxFactory,
		);

		expect(called).toHaveBeenCalledOnce();
	});
});

// ---------------------------------------------------------------------------
// loadAll — optional dependencies
// ---------------------------------------------------------------------------
describe("PluginRegistry — optional dependencies", () => {
	it("loads an optional dep before its dependent when both are present", async () => {
		const registry = new PluginRegistry();
		const order: string[] = [];

		const sessions: HumsPlugin = {
			name: "sessions",
			server: {
				register: async () => {
					order.push("sessions");
				},
			},
		};
		const control: HumsPlugin = {
			name: "control",
			optionalDependencies: ["sessions"],
			server: {
				register: async () => {
					order.push("control");
				},
			},
		};

		await registry.loadAll(
			["control", "sessions"],
			{
				control: async () => control,
				sessions: async () => sessions,
			},
			ctxFactory,
		);

		expect(order.indexOf("sessions")).toBeLessThan(order.indexOf("control"));
	});

	it("does not throw when an optional dep is absent", async () => {
		const registry = new PluginRegistry();

		const control: HumsPlugin = {
			name: "control",
			optionalDependencies: ["sessions"], // sessions NOT in names
			server: { register: vi.fn() },
		};

		await expect(
			registry.loadAll(
				["control"],
				{ control: async () => control },
				ctxFactory,
			),
		).resolves.toBeUndefined();
	});
});

// ---------------------------------------------------------------------------
// loadAll — error cases
// ---------------------------------------------------------------------------
describe("PluginRegistry — error cases", () => {
	it("throws when a required dependency is not in the enabled list", async () => {
		const registry = new PluginRegistry();

		const control: HumsPlugin = {
			name: "control",
			dependencies: ["sessions"], // sessions is NOT in names
		};

		await expect(
			registry.loadAll(
				["control"],
				{ control: async () => control },
				ctxFactory,
			),
		).rejects.toThrow(/sessions/);
	});

	it("throws when a cycle is present (A → B → A)", async () => {
		const registry = new PluginRegistry();

		// A depends on B, B depends on A
		const a: HumsPlugin = { name: "a", dependencies: ["b"] };
		const b: HumsPlugin = { name: "b", dependencies: ["a"] };

		await expect(
			registry.loadAll(
				["a", "b"],
				{ a: async () => a, b: async () => b },
				ctxFactory,
			),
		).rejects.toThrow(/circular/i);
	});

	it("throws when a cycle is present (A → B → C → A)", async () => {
		const registry = new PluginRegistry();

		const a: HumsPlugin = { name: "a", dependencies: ["c"] };
		const b: HumsPlugin = { name: "b", dependencies: ["a"] };
		const c: HumsPlugin = { name: "c", dependencies: ["b"] };

		await expect(
			registry.loadAll(
				["a", "b", "c"],
				{
					a: async () => a,
					b: async () => b,
					c: async () => c,
				},
				ctxFactory,
			),
		).rejects.toThrow(/circular/i);
	});

	it("throws when importMap is missing an entry for a requested plugin", async () => {
		const registry = new PluginRegistry();

		await expect(registry.loadAll(["missing"], {}, ctxFactory)).rejects.toThrow(
			/missing/,
		);
	});
});
