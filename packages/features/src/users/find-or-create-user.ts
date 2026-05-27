import {
	type CreateUserData,
	type CreateUserOptions,
	createUser,
} from "./create-user";
import { findUser } from "./find-user";
import { refreshUserProfileIfStale } from "./refresh-user-profile";

export async function findOrCreateUser(
	username: string,
	options?: Omit<CreateUserData, "username">,
	createOptions?: CreateUserOptions,
) {
	// Find or create the user
	const existingUser = await findUser(username);
	if (existingUser) {
		// Refresh the profile if it is older than the cache TTL so that changes
		// to affiliation, card numbers, and other identity attributes are picked
		// up in a timely fashion.
		return refreshUserProfileIfStale(existingUser);
	}

	// Create the user if not found
	const newUser = await createUser({ username, ...options }, createOptions);
	return newUser;
}
