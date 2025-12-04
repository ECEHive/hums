import path from "node:path";
import { config } from "dotenv";
import { ZEnvSchema } from "./schema";

config({
	path: path.join(process.cwd(), ".env"),
	debug: false,
});

const parsedEnvResult = ZEnvSchema.safeParse(process.env);

if (!parsedEnvResult.success) {
	throw new Error("Invalid environment variables");
}

export const env = parsedEnvResult.data;

export type { TEnvSchema } from "./schema";
