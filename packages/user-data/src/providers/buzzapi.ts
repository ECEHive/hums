import { normalizeCardNumber } from "../card-number";
import type { UserDataProvider, UserProfile } from "../types";

type BuzzApiProviderConfig = {
	baseUrl: string;
	username: string;
	password: string;
	fallbackEmailDomain: string;
	timeoutMs?: number;
};

type BuzzApiResponse = {
	api_result_status?: string;
	api_error_message?: string;
	api_result_data?: BuzzApiPerson | BuzzApiPerson[];
};

type BuzzApiPerson = {
	displayName?: string;
	givenName?: string;
	sn?: string;
	gtAccessCardNumber?: string;
	gtPersonDirectoryId?: string;
	gtPrimaryEmailAddress?: string;
	gtPrimaryGTAccountUsername?: string;
};

const REQUESTED_ATTRIBUTES = [
	"gtPrimaryEmailAddress",
	"gtPrimaryGTAccountUsername",
	"displayName",
	"givenName",
	"sn",
	"gtAccessCardNumber",
].join(",");

export class BuzzApiUserDataProvider implements UserDataProvider {
	constructor(private readonly config: BuzzApiProviderConfig) {}

	async fetchByUsername(username: string): Promise<UserProfile | null> {
		const trimmed = username.trim();
		if (!trimmed) return null;
		const result = await this.request(`gtPrimaryGTAccountUsername=${trimmed}`);
		return result;
	}

	async fetchByCardNumber(cardNumber: string): Promise<UserProfile | null> {
		const normalized = normalizeCardNumber(cardNumber);
		if (!normalized) return null;
		return this.request(`gtAccessCardNumber=${normalized}`);
	}

	private async request(filter: string): Promise<UserProfile | null> {
		const url = this.normalizeBaseUrl();
		const response = await fetch(`${url}/central.iam.gted.people/read`, {
			method: "POST",
			headers: {
				"Content-Type": "application/json",
			},
			body: JSON.stringify({
				api_app_id: this.config.username,
				api_app_password: this.config.password,
				api_request_mode: "sync",
				api_receive_timeout: this.config.timeoutMs ?? 5000,
				filter,
				requested_attributes: REQUESTED_ATTRIBUTES,
			}),
		});

		if (!response.ok) {
			throw new Error(`BuzzAPI request failed with status ${response.status}`);
		}

		const payload = (await response.json()) as BuzzApiResponse;
		if (
			payload.api_result_status &&
			payload.api_result_status.toLowerCase() !== "success"
		) {
			const reason = payload.api_error_message || payload.api_result_status;
			throw new Error(`BuzzAPI request failed: ${reason}`);
		}
		const result = Array.isArray(payload.api_result_data)
			? payload.api_result_data[0]
			: payload.api_result_data;

		if (!result) {
			return null;
		}

		const username = result.gtPrimaryGTAccountUsername?.trim();
		if (!username) {
			return null;
		}

		const displayName = result.displayName?.trim();
		const given = result.givenName?.trim();
		const surname = result.sn?.trim();
		const name =
			given && surname
				? `${given} ${surname}`.trim()
				: (displayName?.trim() ?? username);

		const email =
			result.gtPrimaryEmailAddress?.trim() ||
			`${username}@${this.config.fallbackEmailDomain}`;

		const cardNumber = normalizeCardNumber(result.gtAccessCardNumber);

		return {
			username,
			name,
			email,
			cardNumber,
		};
	}

	private normalizeBaseUrl() {
		return this.config.baseUrl.replace(/\/$/, "");
	}
}
