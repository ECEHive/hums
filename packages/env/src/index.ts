import { ZEnvSchema } from "./schema";

const parsedEnvResult = ZEnvSchema.safeParse(process.env);

if (!parsedEnvResult.success) {
	throw new Error("Invalid environment variables");
}

export const env = parsedEnvResult.data;

export type { TEnvSchema } from "./schema";
