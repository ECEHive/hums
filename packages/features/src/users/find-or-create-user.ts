import { createUser } from "./create-user";
import { findUser } from "./find-user";

export async function findOrCreateUser(username: string) {
	// Find or create the user
	const existingUser = await findUser(username);
	if (existingUser) {
		return existingUser;
	}

	// Create the user if not found
	const newUser = await createUser(username);
	return newUser;
}
