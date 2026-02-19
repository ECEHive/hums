import { Client } from "pg";

/**
 * Migration deployment script that handles credential HMAC secret injection.
 *
 * When CREDENTIAL_HMAC_SECRET is set in the environment, this script:
 * 1. Sets the secret as a PostgreSQL database-level setting
 * 2. Runs `prisma migrate deploy`
 * 3. Cleans up the database-level setting
 *
 * This ensures the hash_credential_values migration can read the HMAC secret
 * via current_setting('credential.hmac_secret') in PostgreSQL.
 */

const databaseUrl = process.env.DATABASE_URL;
const hmacSecret = process.env.CREDENTIAL_HMAC_SECRET;

if (!databaseUrl) {
	console.error("DATABASE_URL is required");
	process.exit(1);
}

async function setDatabaseSetting(secret: string): Promise<string> {
	const client = new Client({ connectionString: databaseUrl });
	await client.connect();

	const result = await client.query<{ current_database: string }>(
		"SELECT current_database()",
	);
	const dbName = result.rows[0].current_database;

	// ALTER DATABASE ... SET does not support parameterized queries,
	// so we escape single quotes manually to prevent SQL injection.
	const escaped = secret.replace(/'/g, "''");
	await client.query(
		`ALTER DATABASE "${dbName}" SET "credential.hmac_secret" = '${escaped}'`,
	);
	console.log("Set credential.hmac_secret on database");

	await client.end();
	return dbName;
}

// This cleanup is important to avoid leaving the HMAC secret in the database
async function resetDatabaseSetting(dbName: string): Promise<void> {
	const client = new Client({ connectionString: databaseUrl });
	await client.connect();

	await client.query(
		`ALTER DATABASE "${dbName}" RESET "credential.hmac_secret"`,
	);
	console.log("Cleaned up credential.hmac_secret from database");

	await client.end();
}

async function runMigrations(): Promise<void> {
	const proc = Bun.spawn(["bun", "x", "prisma", "migrate", "deploy"], {
		cwd: import.meta.dir,
		stdio: ["inherit", "inherit", "inherit"],
		env: process.env,
	});

	const exitCode = await proc.exited;
	if (exitCode !== 0) {
		throw new Error(`prisma migrate deploy exited with code ${exitCode}`);
	}
}

async function main(): Promise<void> {
	let dbName: string | undefined;

	try {
		if (hmacSecret) {
			dbName = await setDatabaseSetting(hmacSecret);
		}

		await runMigrations();
	} finally {
		if (dbName) {
			try {
				await resetDatabaseSetting(dbName);
			} catch (cleanupError) {
				console.warn(
					"Failed to clean up credential.hmac_secret setting:",
					cleanupError,
				);
			}
		}
	}
}

main().catch((error) => {
	console.error("Migration failed:", error);
	process.exit(1);
});
