import { Client } from "pg";

(async () => {
	const client = new Client({
		connectionString: process.env.DATABASE_URL,
	});

	try {
		await client.connect();

		// Clear all tables in the public schema
		const publicTables = await client.query(
			"SELECT tablename FROM pg_tables WHERE schemaname='public'",
		);
		for (const { tablename } of publicTables.rows) {
			await client.query(`DROP TABLE IF EXISTS "${tablename}" CASCADE`);
			console.log(`Dropped table: ${tablename}`);
		}

		// Clear all tables in the drizzle schema
		const drizzleTables = await client.query(
			"SELECT tablename FROM pg_tables WHERE schemaname='drizzle'",
		);
		for (const { tablename } of drizzleTables.rows) {
			await client.query(
				`DROP TABLE IF EXISTS "drizzle"."${tablename}" CASCADE`,
			);
			console.log(`Dropped table: drizzle.${tablename}`);
		}

		// Clear all custom types (ENUMs) in the public schema
		const publicTypes = await client.query(`
			SELECT t.typname 
			FROM pg_type t 
			JOIN pg_catalog.pg_namespace n ON n.oid = t.typnamespace 
			WHERE n.nspname = 'public' AND t.typtype = 'e'
		`);
		for (const { typname } of publicTypes.rows) {
			await client.query(`DROP TYPE IF EXISTS "public"."${typname}" CASCADE`);
			console.log(`Dropped type: ${typname}`);
		}

		console.log("All tables and types cleared.");
	} catch (error) {
		console.error("Error clearing database:", error);
		process.exit(1);
	} finally {
		await client.end();
	}
})();
