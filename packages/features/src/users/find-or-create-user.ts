import { type CreateUserOptions, createUser } from "./create-user";
import { findUser } from "./find-user";

export async function findOrCreateUser(
	username: string,
	options?: CreateUserOptions,
) {
	// Find or create the user
	const existingUser = await findUser(username);
	if (existingUser) {
		return existingUser;
	}

	// Create the user if not found
	const newUser = await createUser(username, options);
	return newUser;
}
