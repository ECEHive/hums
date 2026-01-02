import { permissionProtectedProcedure, router } from "../../trpc";
import { getAllHandler } from "./get-all.route";
import { getValueHandler } from "./get-value.route";
import { resetValueHandler } from "./reset-value.route";
import {
	ZGetAllSchema,
	ZGetValueSchema,
	ZResetValueSchema,
	ZSetManySchema,
	ZSetValueSchema,
} from "./schemas";
import { setManyHandler } from "./set-many.route";
import { setValueHandler } from "./set-value.route";

export const configRouter = router({
	getAll: permissionProtectedProcedure("config.read")
		.input(ZGetAllSchema)
		.query(getAllHandler),
	getValue: permissionProtectedProcedure("config.read")
		.input(ZGetValueSchema)
		.query(getValueHandler),
	setValue: permissionProtectedProcedure("config.write")
		.input(ZSetValueSchema)
		.mutation(setValueHandler),
	setMany: permissionProtectedProcedure("config.write")
		.input(ZSetManySchema)
		.mutation(setManyHandler),
	resetValue: permissionProtectedProcedure("config.write")
		.input(ZResetValueSchema)
		.mutation(resetValueHandler),
});
