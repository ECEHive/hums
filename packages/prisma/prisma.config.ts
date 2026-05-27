import { defineConfig, env } from "prisma/config";

export default defineConfig({
	schema: "./schema",
	migrations: {
		path: "./migrations",
	},
	datasource: {
		url: env("DATABASE_URL"),
	},
});
