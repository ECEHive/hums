import { searchLdap } from "@ecehive/ldap";
import { normalizeCardNumber } from "../card-number";
import type { UserDataProvider, UserProfile } from "../types";

const SUMS_ENDPOINT =
	"https://sums.gatech.edu/SUMSAPI/rest/API/GetUserNameAndEmailByBuzzCardNumber";

type LegacyProviderConfig = {
	host: string;
	baseDn: string;
	fallbackEmailDomain: string;
};

type SumsResponse = {
	UserName?: string;
};

export class LegacyUserDataProvider implements UserDataProvider {
	constructor(private readonly config: LegacyProviderConfig) {}

	async fetchByUsername(username: string): Promise<UserProfile | null> {
		const trimmed = username.trim();
		if (!trimmed) return null;

		let name = trimmed;
		let email = `${trimmed}@${this.config.fallbackEmailDomain}`;

		try {
			const ldapResponse = await searchLdap(
				this.config.host,
				this.config.baseDn,
				`(uid=${trimmed})`,
			);

			const entry = ldapResponse.entries[0];
			if (entry) {
				const displayName = entry.displayName?.toString();
				const givenName = entry.givenName?.toString();
				const surname = entry.sn?.toString();
				const mail = entry.mail?.toString();

				if (displayName) {
					name = displayName;
				}

				if (givenName && surname) {
					name = `${givenName} ${surname}`.trim();
				}

				if (mail) {
					email = mail;
				}
			}
		} catch (error) {
			console.error("[user-data][legacy] LDAP lookup failed", error);
		}

		return {
			username: trimmed,
			name,
			email,
		};
	}

	async fetchByCardNumber(cardNumber: string): Promise<UserProfile | null> {
		const normalized = normalizeCardNumber(cardNumber);
		if (!normalized) return null;

		const response = await fetch(
			`${SUMS_ENDPOINT}?BuzzCardNumber=${normalized}`,
			{
				method: "GET",
				headers: {
					"Content-Type": "application/json",
				},
			},
		);

		if (!response.ok) {
			throw new Error("SUMS user lookup failed");
		}

		const data = (await response.json()) as SumsResponse;
		const usernameMatch = data.UserName
			? /\(([^)]+)\)/.exec(data.UserName)
			: null;
		const username = usernameMatch?.[1];
		if (!username) {
			return null;
		}

		const profile = (await this.fetchByUsername(username)) ?? {
			username,
			name: username,
			email: `${username}@${this.config.fallbackEmailDomain}`,
		};

		return {
			...profile,
			cardNumber: normalized,
		};
	}
}
