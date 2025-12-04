import { getUserDataProvider } from "@ecehive/user-data";

export async function fetchUserInfo(username: string) {
	const provider = getUserDataProvider();
	const fallbackEmail = `${username}@gatech.edu`;
	const profile = await provider.fetchByUsername(username);

	return {
		name: profile?.name ?? username,
		username: profile?.username ?? username,
		email: profile?.email || fallbackEmail,
		cardNumber: profile?.cardNumber,
	};
}
