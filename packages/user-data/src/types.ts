export type UserDataProviderName = "legacy" | "buzzapi";

export interface UserProfile {
	username: string;
	name: string;
	email: string;
	cardNumber?: string;
}

export interface UserDataProvider {
	fetchByUsername(username: string): Promise<UserProfile | null>;
	fetchByCardNumber(cardNumber: string): Promise<UserProfile | null>;
}
