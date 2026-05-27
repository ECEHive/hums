/**
 * Institutional affiliation policy for HUMS access control.
 *
 * The allow-list is intentionally defined as a static constant. This provides
 * predictable, auditable behaviour and makes it easy to expand in the future
 * (e.g. by loading overrides from the database or environment configuration).
 */

/**
 * Affiliations that are permitted to access HUMS.
 *
 * These values are matched case-insensitively against the
 * `eduPersonPrimaryAffiliation` attribute from the identity provider.
 */
export const ALLOWED_AFFILIATIONS = ["student", "faculty", "staff"] as const;

export type AllowedAffiliation = (typeof ALLOWED_AFFILIATIONS)[number];

/**
 * Returns `true` when the provided affiliation string is in the allow-list.
 *
 * Matching is case-insensitive and leading/trailing whitespace is ignored.
 * A `null` or `undefined` affiliation is never permitted, which means users
 * whose affiliation has not yet been synced from the identity provider will
 * be denied access until a sync occurs.
 */
export function isAffiliationAllowed(
	affiliation: string | null | undefined,
): boolean {
	if (!affiliation) return false;
	return (ALLOWED_AFFILIATIONS as readonly string[]).includes(
		affiliation.toLowerCase().trim(),
	);
}

/**
 * Human-readable description of the allowed affiliations, suitable for
 * use in error messages shown to end users.
 */
export const ALLOWED_AFFILIATIONS_LABEL =
	"current Students, Faculty, and Staff";
