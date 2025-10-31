import { env } from "@ecehive/env";
import { searchLdap } from "@ecehive/ldap";

export async function fetchUserInfo(username: string) {
	let name = username;
	let email = `${username}@gatech.edu`;

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

	return {
		name,
		username,
		email,
	};
}
