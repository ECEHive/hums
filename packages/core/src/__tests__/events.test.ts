import { describe, expect, it, vi } from "vitest";
import { EventBus } from "../events/bus";

// ---------------------------------------------------------------------------
// Helper: a minimal event map used throughout these tests
// ---------------------------------------------------------------------------
type TestEventMap = {
	"test:basic": { value: string };
	"test:number": number;
	"test:void": undefined;
	"test:complex": { userId: number; name: string };
};

function createBus() {
	return new EventBus<TestEventMap>();
}

// ---------------------------------------------------------------------------
// on / emit
// ---------------------------------------------------------------------------
describe("EventBus — on / emit", () => {
	it("calls a registered handler when the matching event is emitted", () => {
		const bus = createBus();
		const handler = vi.fn();

		bus.on("test:basic", handler);
		bus.emit("test:basic", { value: "hello" });

		expect(handler).toHaveBeenCalledOnce();
		expect(handler).toHaveBeenCalledWith({ value: "hello" });
	});

	it("passes the exact payload to the handler", () => {
		const bus = createBus();
		const received: Array<{ userId: number; name: string }> = [];

		bus.on("test:complex", (p) => received.push(p));
		bus.emit("test:complex", { userId: 42, name: "Alice" });

		expect(received).toHaveLength(1);
		expect(received[0]).toEqual({ userId: 42, name: "Alice" });
	});

	it("calls all handlers registered for the same event", () => {
		const bus = createBus();
		const a = vi.fn();
		const b = vi.fn();

		bus.on("test:number", a);
		bus.on("test:number", b);
		bus.emit("test:number", 99);

		expect(a).toHaveBeenCalledWith(99);
		expect(b).toHaveBeenCalledWith(99);
	});

	it("does not call handlers for other events", () => {
		const bus = createBus();
		const handler = vi.fn();

		bus.on("test:complex", handler);
		bus.emit("test:basic", { value: "unrelated" });

		expect(handler).not.toHaveBeenCalled();
	});

	it("emitting with no listeners is a no-op", () => {
		const bus = createBus();
		expect(() => bus.emit("test:basic", { value: "x" })).not.toThrow();
	});

	it("supports emitting `undefined` payloads", () => {
		const bus = createBus();
		const handler = vi.fn();

		bus.on("test:void", handler);
		bus.emit("test:void", undefined);

		expect(handler).toHaveBeenCalledWith(undefined);
	});
});

// ---------------------------------------------------------------------------
// off
// ---------------------------------------------------------------------------
describe("EventBus — off", () => {
	it("removes a specific handler so it no longer fires", () => {
		const bus = createBus();
		const handler = vi.fn();

		bus.on("test:basic", handler);
		bus.off("test:basic", handler);
		bus.emit("test:basic", { value: "x" });

		expect(handler).not.toHaveBeenCalled();
	});

	it("off on a handler not registered is a no-op", () => {
		const bus = createBus();
		const handler = vi.fn();

		expect(() => bus.off("test:basic", handler)).not.toThrow();
	});

	it("off on one handler does not affect sibling handlers", () => {
		const bus = createBus();
		const a = vi.fn();
		const b = vi.fn();

		bus.on("test:number", a);
		bus.on("test:number", b);
		bus.off("test:number", a);
		bus.emit("test:number", 1);

		expect(a).not.toHaveBeenCalled();
		expect(b).toHaveBeenCalledOnce();
	});
});

// ---------------------------------------------------------------------------
// on returns unsubscribe function
// ---------------------------------------------------------------------------
describe("EventBus — on return value (unsubscribe)", () => {
	it("returns an unsubscribe function that removes the handler", () => {
		const bus = createBus();
		const handler = vi.fn();

		const unsub = bus.on("test:basic", handler);
		unsub();
		bus.emit("test:basic", { value: "y" });

		expect(handler).not.toHaveBeenCalled();
	});

	it("calling unsub twice is a no-op", () => {
		const bus = createBus();
		const handler = vi.fn();

		const unsub = bus.on("test:basic", handler);
		unsub();
		expect(() => unsub()).not.toThrow();
	});
});

// ---------------------------------------------------------------------------
// once
// ---------------------------------------------------------------------------
describe("EventBus — once", () => {
	it("fires the handler exactly once", () => {
		const bus = createBus();
		const handler = vi.fn();

		bus.once("test:number", handler);
		bus.emit("test:number", 1);
		bus.emit("test:number", 2);
		bus.emit("test:number", 3);

		expect(handler).toHaveBeenCalledOnce();
		expect(handler).toHaveBeenCalledWith(1);
	});

	it("passes the correct payload on the single invocation", () => {
		const bus = createBus();
		const received: number[] = [];

		bus.once("test:number", (n) => received.push(n));
		bus.emit("test:number", 42);

		expect(received).toEqual([42]);
	});

	it("returns an unsubscribe function that prevents the handler from firing", () => {
		const bus = createBus();
		const handler = vi.fn();

		const unsub = bus.once("test:basic", handler);
		unsub();
		bus.emit("test:basic", { value: "z" });

		expect(handler).not.toHaveBeenCalled();
	});
});

// ---------------------------------------------------------------------------
// Typed payloads — compile-time contract verified at runtime
// ---------------------------------------------------------------------------
describe("EventBus — typed payloads", () => {
	it("preserves the full payload structure", () => {
		const bus = createBus();
		let captured: { userId: number; name: string } | null = null;

		bus.on("test:complex", (p) => {
			captured = p;
		});
		bus.emit("test:complex", { userId: 7, name: "Bob" });

		expect(captured).toEqual({ userId: 7, name: "Bob" });
	});
});

// ---------------------------------------------------------------------------
// Error isolation
// ---------------------------------------------------------------------------
describe("EventBus — error isolation", () => {
	it("catches an error thrown by one handler and continues calling siblings", () => {
		const bus = createBus();
		const good = vi.fn();

		bus.on("test:basic", () => {
			throw new Error("handler error");
		});
		bus.on("test:basic", good);

		// Should not propagate
		expect(() => bus.emit("test:basic", { value: "x" })).not.toThrow();
		expect(good).toHaveBeenCalledOnce();
	});
});

// ---------------------------------------------------------------------------
// clear
// ---------------------------------------------------------------------------
describe("EventBus — clear", () => {
	it("clears all handlers for a specific event", () => {
		const bus = createBus();
		const handler = vi.fn();

		bus.on("test:basic", handler);
		bus.clear("test:basic");
		bus.emit("test:basic", { value: "x" });

		expect(handler).not.toHaveBeenCalled();
	});

	it("clears all handlers for all events when called with no argument", () => {
		const bus = createBus();
		const a = vi.fn();
		const b = vi.fn();

		bus.on("test:basic", a);
		bus.on("test:number", b);
		bus.clear();

		bus.emit("test:basic", { value: "x" });
		bus.emit("test:number", 1);

		expect(a).not.toHaveBeenCalled();
		expect(b).not.toHaveBeenCalled();
	});
});

// ---------------------------------------------------------------------------
// listenerCount
// ---------------------------------------------------------------------------
describe("EventBus — listenerCount", () => {
	it("returns 0 when no handlers are registered", () => {
		const bus = createBus();
		expect(bus.listenerCount("test:basic")).toBe(0);
	});

	it("returns the correct count after adding handlers", () => {
		const bus = createBus();
		bus.on("test:basic", vi.fn());
		bus.on("test:basic", vi.fn());
		expect(bus.listenerCount("test:basic")).toBe(2);
	});

	it("decrements after removing a handler", () => {
		const bus = createBus();
		const h = vi.fn();
		bus.on("test:basic", h);
		bus.off("test:basic", h);
		expect(bus.listenerCount("test:basic")).toBe(0);
	});

	it("decrements after once fires", () => {
		const bus = createBus();
		bus.once("test:number", vi.fn());
		bus.emit("test:number", 1);
		expect(bus.listenerCount("test:number")).toBe(0);
	});
});
