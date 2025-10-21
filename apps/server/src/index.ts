import { initialize } from "@ecehive/drizzle";
import { env } from "@ecehive/env";
import { server } from "./fastify";

Promise.resolve()
	.then(() => initialize())
	.then(() => {
		console.log("Database initialized");
	})
	.catch((err) => {
		console.error("Error initializing database:", err);
		process.exit(1);
	})
	.then(() =>
		server.listen({
			port: env.PORT,
			host: "0.0.0.0",
		}),
	)
	.then(() => {
		console.log(`Server listening at http://localhost:${env.PORT}`);
	})
	.catch((err) => {
		console.error("Error starting server:", err);
		process.exit(1);
	});
