import { permissionProtectedProcedure, router } from "../../trpc";
import { listAuditLogsHandler, ZListAuditLogsSchema } from "./list.route";

export const auditLogsRouter = router({
	list: permissionProtectedProcedure("audit_logs.list")
		.input(ZListAuditLogsSchema)
		.query(listAuditLogsHandler),
});
