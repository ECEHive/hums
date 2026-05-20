export type UserDataProviderName = "legacy" | "buzzapi";

export interface UserProfile {
	username: string;
	name: string;
	email: string;
	cardNumbers?: string[];
	/** College/department/major code extracted from BuzzAPI gtCurriculum (e.g. "E/ECE/CMPE"). Only present when the data source provides it. */
	department?: string;
}

export interface UserDataProvider {
	fetchByUsername(username: string): Promise<UserProfile | null>;
	fetchByCardNumber(cardNumber: string): Promise<UserProfile | null>;
}
