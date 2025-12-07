import { ZEnvSchema } from "./schema";

const parsedEnvResult = ZEnvSchema.safeParse(process.env);

if (!parsedEnvResult.success) {
	throw new Error(
		`Environment variable validation failed: ${parsedEnvResult.error.message}`,
	);
}

export const env = parsedEnvResult.data;

export type { TEnvSchema } from "./schema";
