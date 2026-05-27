import type { HumsPlugin, PluginServerContext } from "./types";

/**
 * Central registry for all loaded HUMS plugins.
 *
 * Responsibilities:
 * - Maintain an ordered collection of registered plugins.
 * - Resolve load order using Kahn's topological sort algorithm.
 * - Enforce hard dependencies and silently skip missing optional ones.
 * - Detect and report circular dependencies before any plugin is started.
 */
export class PluginRegistry {
	private readonly plugins = new Map<string, HumsPlugin>();

	// ---------------------------------------------------------------------------
	// Registration
	// ---------------------------------------------------------------------------

	/**
	 * Register a plugin.
	 *
	 * @throws if a plugin with the same name is already registered.
	 */
	register(plugin: HumsPlugin): void {
		if (this.plugins.has(plugin.name)) {
			throw new Error(
				`Plugin "${plugin.name}" is already registered. Each plugin name must be unique.`,
			);
		}
		this.plugins.set(plugin.name, plugin);
	}

	// ---------------------------------------------------------------------------
	// Lookup
	// ---------------------------------------------------------------------------

	/**
	 * Retrieve a registered plugin by name.
	 *
	 * Returns `undefined` if no plugin with that name has been registered.
	 * Plugins use this to access sibling plugin public APIs at runtime.
	 *
	 * @example
	 * const sessions = ctx.plugins.getPlugin("sessions") as SessionsPlugin | undefined;
	 */
	getPlugin(name: string): HumsPlugin | undefined {
		return this.plugins.get(name);
	}

	/**
	 * Returns all registered plugins in insertion order.
	 */
	getAll(): HumsPlugin[] {
		return Array.from(this.plugins.values());
	}

	/**
	 * Returns true if a plugin with the given name has been registered.
	 */
	has(name: string): boolean {
		return this.plugins.has(name);
	}

	// ---------------------------------------------------------------------------
	// Dependency resolution — Kahn's algorithm
	// ---------------------------------------------------------------------------

	/**
	 * Compute a topological load order for the given plugin names.
	 *
	 * All plugins in `names` must already be registered before this is called.
	 *
	 * Edges are `dependency → dependent` (dependency loads first).
	 * Hard dependencies that are not in `names` cause an error.
	 * Optional dependencies that are not in `names` are silently ignored.
	 *
	 * @throws if any hard dependency is missing from `names`.
	 * @throws if a circular dependency is detected.
	 */
	private topologicalSort(names: string[]): string[] {
		const nameSet = new Set(names);

		// adjacency: dep → list of plugins that depend on dep
		const graph = new Map<string, string[]>();
		// how many unresolved dependencies each plugin still has
		const inDegree = new Map<string, number>();

		for (const name of names) {
			graph.set(name, []);
			inDegree.set(name, 0);
		}

		for (const name of names) {
			const plugin = this.plugins.get(name);
			if (!plugin) {
				throw new Error(
					`Cannot sort: plugin "${name}" has not been registered.`,
				);
			}

			// Hard dependencies
			for (const dep of plugin.dependencies ?? []) {
				if (!nameSet.has(dep)) {
					throw new Error(
						`Plugin "${name}" requires dependency "${dep}", but "${dep}" is not in the enabled plugin list. ` +
							`Add "${dep}" to ENABLED_PLUGINS or remove the dependency.`,
					);
				}
				// dep must complete before name
				graph.get(dep)?.push(name);
				inDegree.set(name, (inDegree.get(name) ?? 0) + 1);
			}

			// Optional dependencies — only add the edge if the dep is loaded
			for (const dep of plugin.optionalDependencies ?? []) {
				if (nameSet.has(dep)) {
					graph.get(dep)?.push(name);
					inDegree.set(name, (inDegree.get(name) ?? 0) + 1);
				}
			}
		}

		// Kahn's algorithm
		// Start with all nodes that have no pending dependencies
		const queue: string[] = [];
		for (const [name, degree] of inDegree) {
			if (degree === 0) {
				queue.push(name);
			}
		}

		const sorted: string[] = [];
		while (queue.length > 0) {
			// biome-ignore lint/style/noNonNullAssertion: queue.length > 0 guarantees shift() is defined
			const current = queue.shift()!;
			sorted.push(current);

			for (const dependent of graph.get(current) ?? []) {
				const newDegree = (inDegree.get(dependent) ?? 0) - 1;
				inDegree.set(dependent, newDegree);
				if (newDegree === 0) {
					queue.push(dependent);
				}
			}
		}

		if (sorted.length !== names.length) {
			// Some plugins never reached in-degree 0 — there is a cycle.
			const inCycle = names.filter((n) => !sorted.includes(n));
			throw new Error(
				`Circular dependency detected among plugins: [${inCycle.join(", ")}]. ` +
					`Each plugin in this set depends on at least one other plugin in the same set.`,
			);
		}

		return sorted;
	}

	// ---------------------------------------------------------------------------
	// Lifecycle
	// ---------------------------------------------------------------------------

	/**
	 * Import, register, and initialise all plugins in dependency order.
	 *
	 * Steps:
	 * 1. Call each lazy importer in `importMap` to obtain the plugin object.
	 * 2. Register every plugin.
	 * 3. Compute a topological sort of the plugin names.
	 * 4. Call `plugin.server.register(ctx)` in sorted order, creating a
	 *    per-plugin context via `ctxFactory`.
	 * 5. (Workers are started separately by the server scheduler.)
	 *
	 * @param names      Ordered list of plugin names to load (respects `ENABLED_PLUGINS`).
	 * @param importMap  Record mapping plugin names to lazy `() => Promise<HumsPlugin>` importers.
	 * @param ctxFactory Factory that returns a {@link PluginServerContext} scoped to each plugin.
	 *                   Called once per plugin, receiving the plugin's name.
	 *
	 * @throws if any name in `names` lacks an entry in `importMap`.
	 * @throws if any hard dependency is missing or a cycle is found.
	 */
	async loadAll(
		names: string[],
		importMap: Record<string, () => Promise<HumsPlugin>>,
		ctxFactory: (pluginName: string) => PluginServerContext,
	): Promise<void> {
		// Step 1 & 2 — import and register
		for (const name of names) {
			const importer = importMap[name];
			if (!importer) {
				throw new Error(
					`No import entry found for plugin "${name}". ` +
						`Add it to the plugin map in apps/server/src/plugin-map.ts.`,
				);
			}
			const plugin = await importer();
			this.register(plugin);
		}

		// Step 3 — resolve order
		const sortedNames = this.topologicalSort(names);

		// Step 4 — call server.register() in dependency order
		for (const name of sortedNames) {
			// biome-ignore lint/style/noNonNullAssertion: guaranteed by topologicalSort
			const plugin = this.plugins.get(name)!;
			if (plugin.server) {
				const ctx = ctxFactory(name);
				await plugin.server.register(ctx);
			}
		}
	}
}
