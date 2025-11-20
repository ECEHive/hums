import { permissionProtectedProcedure, router } from "../../trpc";
import { generateHandler, ZGenerateSchema } from "./generate.route";

export const reportsRouter = router({
	generate: permissionProtectedProcedure("reports.generate")
		.input(ZGenerateSchema)
		.query(generateHandler),
});
