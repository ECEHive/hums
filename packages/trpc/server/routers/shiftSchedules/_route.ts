import {
	permissionProtectedProcedure,
	protectedProcedure,
	router,
} from "../../trpc";
import { bulkCreateHandler, ZBulkCreateSchema } from "./bulkCreate.route";
import { bulkDeleteHandler, ZBulkDeleteSchema } from "./bulkDelete.route";
import { createHandler, ZCreateSchema } from "./create.route";
import { deleteHandler, ZDeleteSchema } from "./delete.route";
import {
	forceRegisterHandler,
	ZForceRegisterSchema,
} from "./forceRegister.route";
import {
	forceUnregisterHandler,
	ZForceUnregisterSchema,
} from "./forceUnregister.route";
import { getHandler, ZGetSchema } from "./get.route";
import { listHandler, ZListSchema } from "./list.route";
import {
	listAllUsersWithStatsHandler,
	ZListAllUsersWithStatsSchema,
} from "./listAllUsersWithStats.route";
import {
	listEligibleUsersHandler,
	ZListEligibleUsersSchema,
} from "./listEligibleUsers.route";
import {
	listForExportHandler,
	ZListForExportSchema,
} from "./listForExport.route";
import {
	listForOverviewHandler,
	ZListForOverviewSchema,
} from "./listForOverview.route";
import {
	listForRegistrationHandler,
	ZListForRegistrationSchema,
} from "./listForRegistration.route";
import {
	listForUserManagementHandler,
	ZListForUserManagementSchema,
} from "./listForUserManagement.route";
import {
	onScheduleUpdateHandler,
	ZOnScheduleUpdateSchema,
} from "./onScheduleUpdate.route";
import { registerHandler, ZRegisterSchema } from "./register.route";
import { unregisterHandler, ZUnregisterSchema } from "./unregister.route";
import { updateHandler, ZUpdateSchema } from "./update.route";

export const shiftSchedulesRouter = router({
	list: permissionProtectedProcedure("shift_schedules.list")
		.input(ZListSchema)
		.query(listHandler),
	listAllUsersWithStats: permissionProtectedProcedure(
		"shift_schedules.manipulate",
	)
		.input(ZListAllUsersWithStatsSchema)
		.query(listAllUsersWithStatsHandler),
	listEligibleUsers: permissionProtectedProcedure("shift_schedules.manipulate")
		.input(ZListEligibleUsersSchema)
		.query(listEligibleUsersHandler),
	listForExport: permissionProtectedProcedure("shift_schedules.list")
		.input(ZListForExportSchema)
		.query(listForExportHandler),
	listForOverview: permissionProtectedProcedure("shift_schedules.list")
		.input(ZListForOverviewSchema)
		.query(listForOverviewHandler),
	listForRegistration: protectedProcedure
		.input(ZListForRegistrationSchema)
		.query(listForRegistrationHandler),
	listForUserManagement: permissionProtectedProcedure(
		"shift_schedules.manipulate",
	)
		.input(ZListForUserManagementSchema)
		.query(listForUserManagementHandler),
	get: permissionProtectedProcedure("shift_schedules.get")
		.input(ZGetSchema)
		.query(getHandler),
	create: permissionProtectedProcedure("shift_schedules.create")
		.input(ZCreateSchema)
		.mutation(createHandler),
	bulkCreate: permissionProtectedProcedure("shift_schedules.create")
		.input(ZBulkCreateSchema)
		.mutation(bulkCreateHandler),
	bulkDelete: permissionProtectedProcedure("shift_schedules.delete")
		.input(ZBulkDeleteSchema)
		.mutation(bulkDeleteHandler),
	update: permissionProtectedProcedure("shift_schedules.update")
		.input(ZUpdateSchema)
		.mutation(updateHandler),
	delete: permissionProtectedProcedure("shift_schedules.delete")
		.input(ZDeleteSchema)
		.mutation(deleteHandler),
	forceRegister: permissionProtectedProcedure("shift_schedules.manipulate")
		.input(ZForceRegisterSchema)
		.mutation(forceRegisterHandler),
	forceUnregister: permissionProtectedProcedure("shift_schedules.manipulate")
		.input(ZForceUnregisterSchema)
		.mutation(forceUnregisterHandler),
	register: protectedProcedure.input(ZRegisterSchema).mutation(registerHandler),
	unregister: protectedProcedure
		.input(ZUnregisterSchema)
		.mutation(unregisterHandler),
	onScheduleUpdate: protectedProcedure
		.input(ZOnScheduleUpdateSchema)
		.subscription(onScheduleUpdateHandler),
});
