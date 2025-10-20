import * as dotenv from "dotenv";
import { Pool } from "pg";

dotenv.config();

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) throw new Error("DATABASE_URL not defined in .env");

const pool = new Pool({
	connectionString: databaseUrl,
});

const categories = ["roles", "rolePermissions", "userRoles"];
const actions = ["create", "delete", "get", "list", "update"];
const extra = [
	"users.get",
	"users.list",
	"permissions.get",
	"permissions.list",
];

async function seedPermissions() {
	const client = await pool.connect();
	try {
		const permissions: string[] = [
			...categories.flatMap((cat) => actions.map((act) => `${cat}.${act}`)),
			...extra,
		];

		for (const name of permissions) {
			// Insert if it doesn't already exist
			await client.query(
				`INSERT INTO permissions (name)
         VALUES ($1)
         ON CONFLICT (name) DO NOTHING`,
				[name],
			);
		}

		console.log("Permissions seeded successfully");
	} catch (err) {
		console.error("Error seeding permissions:", err);
	} finally {
		client.release();
		await pool.end();
	}
}

seedPermissions();
