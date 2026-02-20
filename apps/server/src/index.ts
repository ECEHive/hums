import { env } from "@ecehive/env";
import { updateSystemUsers } from "@ecehive/features";
import { getLogger } from "@ecehive/logger";
import * as workers from "@ecehive/workers";
import { createServer } from "./fastify";

const logger = getLogger("server:startup");

Promise.resolve()
	.then(async () => {
		logger.info("Starting server initialization");
		try {
			await updateSystemUsers();
			logger.info("System users synchronized");
		} catch (err) {
			logger.warn("Failed to update system users, skipping", {
				error: err instanceof Error ? err.message : String(err),
			});
		}
	})
	.then(() => workers.start())
	.then(() => {
		logger.info("Background workers started");
	})
	.catch((err) => {
		logger.fatal("Failed to start background workers", { error: err.message });
		process.exit(1);
	})
	.then(() => createServer())
	.then((server) =>
		server.listen({
			port: env.PORT,
			host: "0.0.0.0",
		}),
	)
	.then(() => {
		logger.info("Server ready", { port: env.PORT, host: "0.0.0.0" });
	})
	.catch((err) => {
		logger.fatal("Failed to start server", { error: err.message });
		process.exit(1);
	});
