import type {
	InferEnum,
	InferInsertModel,
	InferSelectModel,
} from "drizzle-orm";
import type * as schema from "./schema";

export type SelectUser = InferSelectModel<typeof schema.users>;
export type InsertUser = InferInsertModel<typeof schema.users>;

export type SelectPeriod = InferSelectModel<typeof schema.periods>;
export type InsertPeriod = InferInsertModel<typeof schema.periods>;

export type SelectShiftSchedule = InferSelectModel<typeof schema.shiftSchedule>;
export type InsertShiftSchedule = InferInsertModel<typeof schema.shiftSchedule>;

export type SelectShiftOccurrences = InferSelectModel<
	typeof schema.shiftOccurrences
>;
export type InsertShiftOccurrences = InferInsertModel<
	typeof schema.shiftOccurrences
>;

export type SelectShiftScheduleAssignments = InferSelectModel<
	typeof schema.shiftScheduleAssignments
>;
export type InsertShiftScheduleAssignments = InferInsertModel<
	typeof schema.shiftScheduleAssignments
>;

export type ShiftAttendanceStatus = InferEnum<
	typeof schema.shiftAttendanceStatus
>;

export type SelectShiftAttendances = InferSelectModel<
	typeof schema.shiftAttendances
>;
export type InsertShiftAttendances = InferInsertModel<
	typeof schema.shiftAttendances
>;

export type SelectPermission = InferSelectModel<typeof schema.permissions>;
export type InsertPermission = InferInsertModel<typeof schema.permissions>;
