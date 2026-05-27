import { getLogger } from "@ecehive/logger";
import type { HumsPlugin, WorkerDefinition } from "../types";

const logger = getLogger("core:workers");

/**
 * Collects {@link WorkerDefinition} instances from plugins and manages their
 * lifecycle (start / stop).
 *
 * Workers are long-running background tasks (e.g. periodic jobs, polling
 * loops) declared by plugins via `plugin.server.workers`. They are started
 * after all plugins have been initialised and stopped on server shutdown.
 *
 * @example
 * ```ts
 * const scheduler = new WorkerScheduler();
 * for (const plugin of registry.getAll()) {
 *   scheduler.collectFrom(plugin);
 * }
 * scheduler.startAll();
 * // On shutdown:
 * scheduler.stopAll();
 * ```
 */
export class WorkerScheduler {
	private readonly workers: WorkerDefinition[] = [];

	/**
	 * Collect all workers declared by `plugin.server.workers` (if any).
	 *
	 * Safe to call on plugins that have no server block or no workers array.
	 */
	collectFrom(plugin: HumsPlugin): void {
		const pluginWorkers = plugin.server?.workers ?? [];
		for (const worker of pluginWorkers) {
			this.workers.push(worker);
		}
	}

	/**
	 * Call `start()` on every collected worker.
	 *
	 * Logs a summary when at least one worker is started; silent otherwise.
	 */
	startAll(): void {
		if (this.workers.length === 0) {
			return;
		}

		for (const worker of this.workers) {
			worker.start();
		}

		logger.info("Plugin workers started", {
			count: this.workers.length,
			workers: this.workers.map((w) => w.name),
		});
	}

	/**
	 * Call `stop()` on every collected worker that declares one.
	 *
	 * Safe to call even if no workers were started.
	 */
	stopAll(): void {
		for (const worker of this.workers) {
			worker.stop?.();
		}
	}

	/** Total number of workers collected so far. */
	get count(): number {
		return this.workers.length;
	}
}
