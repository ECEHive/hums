import cp from "node:child_process";

/**
 * Searches an LDAP server and returns parsed results.
 * @param host Server host
 * @param baseDN Base DN (distinguished name) for the search
 * @param filter Filter string for the search
 * @param attributes Optional list of attributes to retrieve
 * @returns Parsed LDAP response with entries and metadata
 */
export async function searchLdap(
	host: string,
	baseDN: string,
	filter: string,
	attributes: string[] = [],
): Promise<ParsedLdapResponse> {
	const ldapResponse = await searchLdapRaw(host, baseDN, filter, attributes);
	return parseLdapResponse(ldapResponse);
}

/**
 * Searches an LDAP server using the ldapsearch command-line tool.
 * @param host Server host
 * @param baseDN Base DN (distinguished name) for the search
 * @param filter Filter string for the search
 * @param attributes Optional list of attributes to retrieve
 * @returns String from ldapsearch command output
 */
export function searchLdapRaw(
	host: string,
	baseDN: string,
	filter: string,
	attributes: string[] = [],
): Promise<string> {
	return new Promise((resolve, reject) => {
		const args = [
			"-x",
			"-H",
			`ldap://${host}`,
			"-b",
			baseDN,
			filter,
			...attributes,
		];

		const ldapProcess = cp.spawn("ldapsearch", args);

		let output = "";
		let errorOutput = "";

		ldapProcess.stdout.on("data", (data) => {
			output += data.toString();
		});

		ldapProcess.stderr.on("data", (data) => {
			errorOutput += data.toString();
		});

		ldapProcess.on("close", (code) => {
			if (code === 0) {
				resolve(output);
			} else {
				reject(
					new Error(`ldapsearch failed with code ${code}: ${errorOutput}`),
				);
			}
		});
	});
}

interface LdapEntry {
	[key: string]: string | string[] | null;
}

interface LdapMetadata {
	[key: string]: string | null;
}

interface ParsedLdapResponse {
	entries: LdapEntry[];
	metadata: LdapMetadata;
}

/**
 * Parses an LDAP text response into structured entries and metadata.
 * @param response LDAP text response
 * @returns Parsed LDAP response with entries and metadata
 */
export function parseLdapResponse(response: string): ParsedLdapResponse {
	const lines = response.split(/\r?\n/);
	const entries: LdapEntry[] = [];
	const metadata: LdapMetadata = {};
	let currentEntry: LdapEntry = {};
	let inEntrySection = false;

	for (const rawLine of lines) {
		const line = rawLine.trim();

		// Skip completely empty lines
		if (line === "") {
			// When we hit a blank line after an entry, push it
			if (Object.keys(currentEntry).length > 0) {
				entries.push(currentEntry);
				currentEntry = {};
			}
			continue;
		}

		// Ignore comment lines
		if (line.startsWith("#")) continue;

		// Detect metadata section (after "search result" or no dn/objectClass found)
		if (
			/^search:/i.test(line) ||
			/^result:/i.test(line) ||
			/^num/i.test(line)
		) {
			inEntrySection = false;
		}

		// Split key-value pair (lines like `key: value`)
		const [key, ...valueParts] = line.split(":");
		if (!key || valueParts.length === 0) continue;
		let value: string | null = valueParts.join(":").trim();

		if (/^dn:/i.test(line) || /^objectClass:/i.test(line)) {
			inEntrySection = true;
		}

		if (value === "UNPUBLISHED INFO") {
			value = null;
		}

		if (inEntrySection) {
			// Add to current entry
			if (currentEntry[key]) {
				const existing = currentEntry[key] as string | null | string[];
				if (Array.isArray(existing)) {
					if (value !== null) {
						existing.push(value);
					}
				} else {
					// Convert to array, remove nulls if present
					currentEntry[key] = [existing, value].filter((v) => v !== null);
				}
			} else {
				currentEntry[key] = value;
			}
		} else {
			// Store as metadata
			metadata[key] = value;
		}
	}

	// Push last entry if still in progress
	if (Object.keys(currentEntry).length > 0) {
		entries.push(currentEntry);
	}

	return { entries, metadata };
}
