import type { z } from "zod";
import { ZEnvSchema } from "./schema";

const applyAuthDefaults = (rawEnv: z.infer<typeof ZEnvSchema>) => {
	const authLoginUrl =
		rawEnv.AUTH_CAS_LOGIN_URL ?? `${rawEnv.AUTH_CAS_SERVER}/cas/login`;
	const authValidateUrl =
		rawEnv.AUTH_CAS_VALIDATE_URL ??
		`${rawEnv.AUTH_CAS_SERVER}/cas/serviceValidate`;
	const authLogoutUrl =
		rawEnv.AUTH_CAS_LOGOUT_URL ?? `${rawEnv.AUTH_CAS_SERVER}/cas/logout`;

	if (rawEnv.AUTH_PROVIDER === "CAS_PROXIED" && !rawEnv.AUTH_CAS_PROXY_URL) {
		throw new Error(
			"AUTH_CAS_PROXY_URL is required when AUTH_PROVIDER is CAS_PROXIED",
		);
	}

	return {
		...rawEnv,
		AUTH_CAS_LOGIN_URL: authLoginUrl,
		AUTH_CAS_VALIDATE_URL: authValidateUrl,
		AUTH_CAS_LOGOUT_URL: authLogoutUrl,
	};
};

const parsedEnvResult = ZEnvSchema.safeParse(process.env);

if (!parsedEnvResult.success) {
	throw new Error(
		`Environment variable validation failed: ${parsedEnvResult.error.message}`,
	);
}
const hydratedEnv = applyAuthDefaults(parsedEnvResult.data);

export const env = hydratedEnv;

export type TEnvSchema = typeof env;
