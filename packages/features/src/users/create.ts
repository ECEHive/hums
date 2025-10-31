import { db, users } from "@ecehive/drizzle";
import { env } from "@ecehive/env";
import { searchLdap } from "@ecehive/ldap";
import { TRPCError } from "@trpc/server";

export async function createUser(username: string) {
	try {
		// Set basic defaults
		let name = username;
		let email = `${username}@gatech.edu`;

		// Attempt to fetch user information from LDAP
		try {
			const ldapResponse = await searchLdap(
				env.LDAP_HOST,
				env.LDAP_BASE_DN,
				`(uid=${username})`,
			);
			const mainLdapEntry = ldapResponse.entries[0];
			if (mainLdapEntry) {
				// Use displayName if available
				name = mainLdapEntry.displayName?.toString() ?? name;

				// But, prefer givenName + sn if available
				if (mainLdapEntry.givenName && mainLdapEntry.sn) {
					name =
						`${mainLdapEntry.givenName.toString() ?? ""} ${mainLdapEntry.sn.toString() ?? ""}`.trim();
				}

				email = mainLdapEntry.mail?.toString() ?? email;
			}
		} catch (error) {
			// If LDAP fetch fails, proceed with defaults
			console.error("LDAP fetch failed:", error);
		}

		const createUserResponse = await db
			.insert(users)
			.values({
				name,
				username,
				email,
			})
			.returning();

		return createUserResponse[0];
	} catch {
		console.error("User creation failed for username:", username);
		throw new TRPCError({
			code: "INTERNAL_SERVER_ERROR",
			message: "Failed to create user",
		});
	}
}
