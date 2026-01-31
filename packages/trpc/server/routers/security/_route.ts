import {
	kioskProtectedProcedure,
	permissionProtectedProcedure,
	router,
} from "../../trpc";
import {
	deleteSnapshotHandler,
	ZDeleteSnapshotSchema,
} from "./deleteSnapshot.route";
import { getImageHandler, ZGetImageSchema } from "./getImage.route";
import {
	listSnapshotsHandler,
	ZListSnapshotsSchema,
} from "./listSnapshots.route";
import {
	lookupUserByCardHandler,
	ZLookupUserByCardSchema,
} from "./lookupUserByCard.route";
import {
	uploadSnapshotHandler,
	ZUploadSnapshotSchema,
} from "./uploadSnapshot.route";

export const securityRouter = router({
	// Kiosk endpoints for uploading snapshots
	uploadSnapshot: kioskProtectedProcedure
		.input(ZUploadSnapshotSchema)
		.mutation(uploadSnapshotHandler),

	// Quick lookup for user ID by card number (for snapshot association)
	lookupUserByCard: kioskProtectedProcedure
		.input(ZLookupUserByCardSchema)
		.query(lookupUserByCardHandler),

	// Admin endpoints for viewing and managing snapshots
	listSnapshots: permissionProtectedProcedure("security.view")
		.input(ZListSnapshotsSchema)
		.query(listSnapshotsHandler),

	getImage: permissionProtectedProcedure("security.view")
		.input(ZGetImageSchema)
		.query(getImageHandler),

	deleteSnapshot: permissionProtectedProcedure("security.delete")
		.input(ZDeleteSnapshotSchema)
		.mutation(deleteSnapshotHandler),
});
