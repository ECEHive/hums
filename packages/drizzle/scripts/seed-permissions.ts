import * as dotenv from "dotenv";
import { Pool } from "pg";

dotenv.config();

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) throw new Error("DATABASE_URL not defined in .env");

const pool = new Pool({
	connectionString: databaseUrl,
});

const permissions = [
	// Period Exceptions
	"periodExceptions.list",
	"periodExceptions.get",
	"periodExceptions.create",
	"periodExceptions.update",
	"periodExceptions.delete",

	// Periods
	"periods.list",
	"periods.get",
	"periods.create",
	"periods.update",
	"periods.delete",

	// Permissions
	"permissions.list",
	"permissions.get",

	// Role Permissions
	"rolePermissions.list",
	"rolePermissions.get",
	"rolePermissions.create",
	"rolePermissions.update",
	"rolePermissions.delete",

	// Roles
	"roles.list",
	"roles.get",
	"roles.create",
	"roles.update",
	"roles.delete",

	// Shift Occurrence Assignments
	"shiftOccurrenceAssignments.list",

	// Shift Occurrences
	"shiftOccurrences.list",
	"shiftOccurrences.get",

	// Shift Schedule Assignments
	"shiftScheduleAssignments.register",
	"shiftScheduleAssignments.create",
	"shiftScheduleAssignments.delete",

	// Shift Schedules
	"shiftSchedules.list",
	"shiftSchedules.get",
	"shiftSchedules.create",
	"shiftSchedules.update",
	"shiftSchedules.delete",

	// Shift Type Roles
	"shiftTypeRoles.list",
	"shiftTypeRoles.get",
	"shiftTypeRoles.create",
	"shiftTypeRoles.update",
	"shiftTypeRoles.delete",

	// Shift Types
	"shift_types.list",
	"shift_types.get",
	"shift_types.create",
	"shift_types.update",
	"shift_types.delete",

	// User Roles
	"userRoles.list",
	"userRoles.get",
	"userRoles.create",
	"userRoles.createBulk",
	"userRoles.update",
	"userRoles.delete",
	"userRoles.deleteBulk",

	// Users
	"users.list",
	"users.get",
	"users.create",
	"users.update",
];

async function seedPermissions() {
	const client = await pool.connect();
	try {
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
