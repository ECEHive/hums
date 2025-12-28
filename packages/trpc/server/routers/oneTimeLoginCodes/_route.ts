import {
	kioskProtectedProcedure,
	protectedProcedure,
	router,
} from "../../trpc";
import { checkUsageHandler, ZCheckUsageSchema } from "./checkUsage.route";
import { generateHandler, ZGenerateSchema } from "./generate.route";
import { useHandler, ZUseSchema } from "./use.route";

export const oneTimeLoginCodesRouter = router({
	generate: kioskProtectedProcedure
		.input(ZGenerateSchema)
		.mutation(generateHandler),
	use: protectedProcedure.input(ZUseSchema).mutation(useHandler),
	checkUsage: kioskProtectedProcedure
		.input(ZCheckUsageSchema)
		.query(checkUsageHandler),
});
