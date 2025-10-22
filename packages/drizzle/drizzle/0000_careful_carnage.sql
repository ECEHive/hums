CREATE TYPE "public"."shift_attendance_status" AS ENUM('present', 'absent', 'arrived_late', 'left_early');--> statement-breakpoint
CREATE TYPE "public"."shift_occurrence_assignment_status" AS ENUM('assigned', 'dropped', 'picked_up');--> statement-breakpoint
CREATE TYPE "public"."shift_type_role_requirement" AS ENUM('disabled', 'all', 'any');--> statement-breakpoint
CREATE TABLE "period_exceptions" (
	"id" serial PRIMARY KEY NOT NULL,
	"period_id" integer NOT NULL,
	"name" text NOT NULL,
	"start" timestamp NOT NULL,
	"end" timestamp NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "periods" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"start" timestamp NOT NULL,
	"end" timestamp NOT NULL,
	"visible_start" timestamp,
	"visible_end" timestamp,
	"schedule_signup_start" timestamp,
	"schedule_signup_end" timestamp,
	"schedule_modify_start" timestamp,
	"schedule_modify_end" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "permissions" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "permissions_name_unique" UNIQUE("name")
);
--> statement-breakpoint
CREATE TABLE "role_permissions" (
	"id" serial PRIMARY KEY NOT NULL,
	"role_id" integer NOT NULL,
	"permission_id" integer NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "role_permissions_role_id_permission_id_unique" UNIQUE("role_id","permission_id")
);
--> statement-breakpoint
CREATE TABLE "roles" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "roles_name_unique" UNIQUE("name")
);
--> statement-breakpoint
CREATE TABLE "shift_attendances" (
	"id" serial PRIMARY KEY NOT NULL,
	"occurrence_assignment_id" integer NOT NULL,
	"status" "shift_attendance_status" DEFAULT 'absent' NOT NULL,
	"time_in" timestamp,
	"time_out" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "shift_occurrence_assignments" (
	"id" serial PRIMARY KEY NOT NULL,
	"shift_occurrence_id" integer NOT NULL,
	"user_id" integer NOT NULL,
	"status" "shift_occurrence_assignment_status" DEFAULT 'assigned' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "shift_occurrence_assignments_shift_occurrence_id_user_id_unique" UNIQUE("shift_occurrence_id","user_id")
);
--> statement-breakpoint
CREATE TABLE "shift_occurrences" (
	"id" serial PRIMARY KEY NOT NULL,
	"shift_schedule_id" integer NOT NULL,
	"timestamp" timestamp NOT NULL,
	"slot" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "shift_occurrences_shift_schedule_id_timestamp_slot_unique" UNIQUE("shift_schedule_id","timestamp","slot")
);
--> statement-breakpoint
CREATE TABLE "shift_schedule_assignments" (
	"id" serial PRIMARY KEY NOT NULL,
	"shift_schedule_id" integer NOT NULL,
	"user_id" integer NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "shift_schedule_assignments_shift_schedule_id_user_id_unique" UNIQUE("shift_schedule_id","user_id")
);
--> statement-breakpoint
CREATE TABLE "shift_schedules" (
	"id" serial PRIMARY KEY NOT NULL,
	"shift_type_id" integer NOT NULL,
	"slot" integer DEFAULT 0 NOT NULL,
	"day_of_week" integer NOT NULL,
	"start_time" time NOT NULL,
	"end_time" time NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "shift_schedules_shift_type_id_day_of_week_start_time_unique" UNIQUE("shift_type_id","day_of_week","start_time")
);
--> statement-breakpoint
CREATE TABLE "shift_type_roles" (
	"id" serial PRIMARY KEY NOT NULL,
	"shift_type_id" integer NOT NULL,
	"role_id" integer NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "shift_type_roles_shift_type_id_role_id_unique" UNIQUE("shift_type_id","role_id")
);
--> statement-breakpoint
CREATE TABLE "shift_types" (
	"id" serial PRIMARY KEY NOT NULL,
	"period_id" integer NOT NULL,
	"name" text NOT NULL,
	"location" text NOT NULL,
	"description" text,
	"color" text,
	"icon" text,
	"is_balanced_across_overlap" boolean DEFAULT false NOT NULL,
	"is_balanced_across_day" boolean DEFAULT false NOT NULL,
	"is_balanced_across_period" boolean DEFAULT false NOT NULL,
	"allow_self_assign" boolean DEFAULT true NOT NULL,
	"do_require_roles" "shift_type_role_requirement" DEFAULT 'disabled' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "user_roles" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"role_id" integer NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "user_roles_user_id_role_id_unique" UNIQUE("user_id","role_id")
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" serial PRIMARY KEY NOT NULL,
	"username" text NOT NULL,
	"name" text NOT NULL,
	"email" text NOT NULL,
	"is_system_user" boolean DEFAULT false NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "users_username_unique" UNIQUE("username"),
	CONSTRAINT "users_email_unique" UNIQUE("email")
);
--> statement-breakpoint
ALTER TABLE "period_exceptions" ADD CONSTRAINT "period_exceptions_period_id_periods_id_fk" FOREIGN KEY ("period_id") REFERENCES "public"."periods"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "role_permissions" ADD CONSTRAINT "role_permissions_role_id_roles_id_fk" FOREIGN KEY ("role_id") REFERENCES "public"."roles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "role_permissions" ADD CONSTRAINT "role_permissions_permission_id_permissions_id_fk" FOREIGN KEY ("permission_id") REFERENCES "public"."permissions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "shift_attendances" ADD CONSTRAINT "shift_attendances_occurrence_assignment_id_shift_occurrence_assignments_id_fk" FOREIGN KEY ("occurrence_assignment_id") REFERENCES "public"."shift_occurrence_assignments"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "shift_occurrence_assignments" ADD CONSTRAINT "shift_occurrence_assignments_shift_occurrence_id_shift_occurrences_id_fk" FOREIGN KEY ("shift_occurrence_id") REFERENCES "public"."shift_occurrences"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "shift_occurrence_assignments" ADD CONSTRAINT "shift_occurrence_assignments_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "shift_occurrences" ADD CONSTRAINT "shift_occurrences_shift_schedule_id_shift_schedules_id_fk" FOREIGN KEY ("shift_schedule_id") REFERENCES "public"."shift_schedules"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "shift_schedule_assignments" ADD CONSTRAINT "shift_schedule_assignments_shift_schedule_id_shift_schedules_id_fk" FOREIGN KEY ("shift_schedule_id") REFERENCES "public"."shift_schedules"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "shift_schedule_assignments" ADD CONSTRAINT "shift_schedule_assignments_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "shift_schedules" ADD CONSTRAINT "shift_schedules_shift_type_id_shift_types_id_fk" FOREIGN KEY ("shift_type_id") REFERENCES "public"."shift_types"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "shift_type_roles" ADD CONSTRAINT "shift_type_roles_shift_type_id_shift_types_id_fk" FOREIGN KEY ("shift_type_id") REFERENCES "public"."shift_types"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "shift_type_roles" ADD CONSTRAINT "shift_type_roles_role_id_roles_id_fk" FOREIGN KEY ("role_id") REFERENCES "public"."roles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "shift_types" ADD CONSTRAINT "shift_types_period_id_periods_id_fk" FOREIGN KEY ("period_id") REFERENCES "public"."periods"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_roles" ADD CONSTRAINT "user_roles_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_roles" ADD CONSTRAINT "user_roles_role_id_roles_id_fk" FOREIGN KEY ("role_id") REFERENCES "public"."roles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint

-- Seed permissions
INSERT INTO permissions (name) VALUES
	-- Period Exceptions
	('periodExceptions.list'),
	('periodExceptions.get'),
	('periodExceptions.create'),
	('periodExceptions.update'),
	('periodExceptions.delete'),

	-- Periods
	('periods.list'),
	('periods.get'),
	('periods.create'),
	('periods.update'),
	('periods.delete'),

	-- Permissions
	('permissions.list'),
	('permissions.get'),

	-- Role Permissions
	('rolePermissions.list'),
	('rolePermissions.get'),
	('rolePermissions.create'),
	('rolePermissions.update'),
	('rolePermissions.delete'),

	-- Roles
	('roles.list'),
	('roles.get'),
	('roles.create'),
	('roles.update'),
	('roles.delete'),

	-- Shift Occurrence Assignments
	('shiftOccurrenceAssignments.list'),
	('shiftOccurrenceAssignments.drop'),
	('shiftOccurrenceAssignments.pickup'),

	-- Shift Occurrences
	('shiftOccurrences.list'),
	('shiftOccurrences.get'),

	-- Shift Schedule Assignments
	('shiftScheduleAssignments.register'),
	('shiftScheduleAssignments.unregister'),
	('shiftScheduleAssignments.create'),
	('shiftScheduleAssignments.delete'),

	-- Shift Schedules
	('shiftSchedules.list'),
	('shiftSchedules.get'),
	('shiftSchedules.create'),
	('shiftSchedules.update'),
	('shiftSchedules.delete'),

	-- Shift Type Roles
	('shiftTypeRoles.list'),
	('shiftTypeRoles.get'),
	('shiftTypeRoles.create'),
	('shiftTypeRoles.update'),
	('shiftTypeRoles.delete'),

	-- Shift Types
	('shift_types.list'),
	('shift_types.get'),
	('shift_types.create'),
	('shift_types.update'),
	('shift_types.delete'),

	-- User Roles
	('userRoles.list'),
	('userRoles.get'),
	('userRoles.create'),
	('userRoles.createBulk'),
	('userRoles.update'),
	('userRoles.delete'),
	('userRoles.deleteBulk'),

	-- Users
	('users.list'),
	('users.get'),
	('users.create'),
	('users.update')
ON CONFLICT (name) DO NOTHING;