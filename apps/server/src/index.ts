import { env } from "@ecehive/env";
import { server } from "./fastify";

server
	.listen({
		port: env.PORT,
		host: "0.0.0.0",
	})
	.then(() => {
		console.log(`Server is running on http://localhost:${env.PORT}`);
	});
