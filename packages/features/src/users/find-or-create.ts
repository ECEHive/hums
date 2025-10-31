import { createUser } from "./create";
import { findUser } from "./find";

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
