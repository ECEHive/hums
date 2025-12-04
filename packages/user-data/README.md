# `@ecehive/user-data`

Configurable adapters for fetching user information from BuzzAPI or legacy LDAP/SUMS sources. Provides a shared interface for the rest of the application to look up people by username or BuzzCard number.

## Configuration

Set `DATA_PROVIDER` to choose between providers:

| Provider | Description |
| -------- | ----------- |
| `legacy` | Uses Georgia Tech LDAP for user info and SUMS API for BuzzCard lookups. Default. |
| `buzzapi` | Uses BuzzAPI for both user info and BuzzCard lookups. |

### Legacy Provider

Requires:
- `LDAP_HOST` – LDAP server hostname (default: `whitepages.gatech.edu`)
- `LDAP_BASE_DN` – Base DN for queries (default: `dc=whitepages,dc=gatech,dc=edu`)

### BuzzAPI Provider

Requires:
- `BUZZAPI_BASE_URL` – Base URL of the BuzzAPI instance
- `BUZZAPI_USER` – Service account username
- `BUZZAPI_PASSWORD` – Service account password

### Shared

- `FALLBACK_EMAIL_DOMAIN` – Domain appended when lookups don't return an email (default: `gatech.edu`)

## Usage

```ts
import { getUserDataProvider } from "@ecehive/user-data";

const provider = getUserDataProvider();

// Look up by GT username
const profileByUsername = await provider.fetchByUsername("gburdell3");

// Look up by BuzzCard number (9-digit string)
const profileByCard = await provider.fetchByCardNumber("000788997");
```
