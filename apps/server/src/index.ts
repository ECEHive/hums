import { env } from "@ecehive/env";
import { updateSystemUsers } from "@ecehive/features";
import { server } from "./fastify";

Promise.resolve()
	.then(() => updateSystemUsers())
	.then(() => {
		console.log("System users updated");
	})
	.catch((err) => {
		console.error("Error updating system users:", err);
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
