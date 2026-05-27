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
	gtBuzzcardNumber?: string | string[];
	gtPersonDirectoryId?: string;
	gtPrimaryEmailAddress?: string;
	gtPrimaryGTAccountUsername?: string;
	gtCurriculum?: string[];
	eduPersonPrimaryAffiliation?: string;
};

const REQUESTED_ATTRIBUTES = [
	"gtPrimaryEmailAddress",
	"gtPrimaryGTAccountUsername",
	"displayName",
	"givenName",
	"sn",
	"gtAccessCardNumber",
	"gtBuzzcardNumber",
	"gtCurriculum",
	"eduPersonPrimaryAffiliation",
].join(",");

/**
 * Extracts the department code from the gtCurriculum array.
 * The department value is a short, uppercase-only path such as "E/ECE/CMPE".
 * Longer student enrollment paths (e.g. "student/major/...") are ignored.
 */
function extractDepartment(gtCurriculum?: string[]): string | undefined {
	if (!gtCurriculum || gtCurriculum.length === 0) return undefined;
	const DEPT_PATTERN = /^[A-Z0-9]{1,10}(\/[A-Z0-9]{1,10}){1,4}$/;
	return gtCurriculum.find((entry) => DEPT_PATTERN.test(entry.trim()));
}

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
		return this.request(`gtBuzzcardNumber=${normalized}`);
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
				api_receive_timeout: this.config.timeoutMs ?? 15000,
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

		const rawCards = result.gtBuzzcardNumber
			? Array.isArray(result.gtBuzzcardNumber)
				? result.gtBuzzcardNumber
				: [result.gtBuzzcardNumber]
			: result.gtAccessCardNumber
				? [result.gtAccessCardNumber]
				: [];

		const cardNumbers = rawCards
			.map((c) => normalizeCardNumber(c))
			.filter((c): c is string => c !== undefined);

		const department = extractDepartment(result.gtCurriculum);
		const affiliation = result.eduPersonPrimaryAffiliation?.trim() || undefined;

		return {
			username,
			name,
			email,
			...(cardNumbers.length > 0 ? { cardNumbers } : {}),
			...(department !== undefined ? { department } : {}),
			...(affiliation !== undefined ? { affiliation } : {}),
		};
	}

	private normalizeBaseUrl() {
		return this.config.baseUrl.replace(/\/$/, "");
	}
}
