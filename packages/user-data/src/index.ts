import { env, type TEnvSchema } from "@ecehive/env";
import { normalizeCardNumber } from "./card-number";
import { BuzzApiUserDataProvider } from "./providers/buzzapi";
import { LegacyUserDataProvider } from "./providers/legacy";
import type {
	UserDataProvider,
	UserDataProviderName,
	UserProfile,
} from "./types";

let cachedProvider: UserDataProvider | null = null;

export function getUserDataProvider(): UserDataProvider {
	if (!cachedProvider) {
		cachedProvider = createUserDataProvider(env);
	}
	return cachedProvider;
}

export function createUserDataProvider(config: TEnvSchema): UserDataProvider {
	switch (config.DATA_PROVIDER) {
		case "buzzapi":
			return new BuzzApiUserDataProvider({
				baseUrl: config.BUZZAPI_BASE_URL,
				username: config.BUZZAPI_USER,
				password: config.BUZZAPI_PASSWORD,
				fallbackEmailDomain: config.FALLBACK_EMAIL_DOMAIN,
			});
		default: // "legacy"
			return new LegacyUserDataProvider({
				host: config.LDAP_HOST,
				baseDn: config.LDAP_BASE_DN,
				fallbackEmailDomain: config.FALLBACK_EMAIL_DOMAIN,
			});
	}
}

export type { UserDataProvider, UserProfile, UserDataProviderName };
export { normalizeCardNumber };
