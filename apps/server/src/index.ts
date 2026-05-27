import type { HumsEventMap, PluginServerContext } from "@ecehive/core";
import {
	EventBus,
	PluginRegistry,
	RestRegistrarImpl,
	TrpcRegistrarImpl,
	WorkerScheduler,
} from "@ecehive/core";
import { env } from "@ecehive/env";
import { ConfigService, updateSystemUsers } from "@ecehive/features";
import { getLogger } from "@ecehive/logger";
import { prisma } from "@ecehive/prisma";
import * as workers from "@ecehive/workers";
import { createServer } from "./fastify";
import { pluginMap } from "./plugin-map";

const logger = getLogger("server:startup");

async function main() {
	logger.info("Starting server initialization");

	// --- Plugin system setup ---
	const registry = new PluginRegistry();
	const events = new EventBus<HumsEventMap>();
	const trpcRegistrar = new TrpcRegistrarImpl();
	const restRegistrar = new RestRegistrarImpl();

	// Determine which plugins to load.
	// When ENABLED_PLUGINS is set, use that list; otherwise load every plugin
	// present in the plugin map (i.e. "all by default").
	const enabledPlugins =
		env.ENABLED_PLUGINS !== undefined
			? env.ENABLED_PLUGINS.split(",")
					.map((s) => s.trim())
					.filter(Boolean)
			: Object.keys(pluginMap);

	const ctxFactory = (pluginName: string): PluginServerContext => ({
		db: prisma,
		config: ConfigService,
		logger: getLogger(`plugin:${pluginName}`),
		events,
		trpc: trpcRegistrar,
		rest: restRegistrar,
		plugins: registry,
	});

	if (enabledPlugins.length > 0) {
		logger.info("Loading plugins", { plugins: enabledPlugins });
		await registry.loadAll(enabledPlugins, pluginMap, ctxFactory);
		logger.info("Plugins loaded", { count: registry.getAll().length });
	} else {
		logger.info("No plugins enabled");
	}

	// Start plugin-contributed background workers (separate from core workers)
	const pluginWorkers = new WorkerScheduler();
	for (const plugin of registry.getAll()) {
		pluginWorkers.collectFrom(plugin);
	}
	pluginWorkers.startAll();

	// --- System users ---
	try {
		await updateSystemUsers();
		logger.info("System users synchronized");
	} catch (err) {
		logger.warn("Failed to update system users, skipping", {
			error: err instanceof Error ? err.message : String(err),
		});
	}

	// --- Core background workers ---
	workers.start();
	logger.info("Background workers started");

	// --- HTTP server ---
	const server = await createServer({ trpcRegistrar, restRegistrar });
	await server.listen({ port: env.PORT, host: "0.0.0.0" });
	logger.info("Server ready", { port: env.PORT, host: "0.0.0.0" });
}

main().catch((err) => {
	logger.fatal("Failed to start server", {
		error: err instanceof Error ? err.message : String(err),
	});
	process.exit(1);
});
