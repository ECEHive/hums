import {
	kioskProtectedProcedure,
	permissionProtectedProcedure,
	router,
} from "../../trpc";
import {
	deleteSnapshotHandler,
	ZDeleteSnapshotSchema,
} from "./deleteSnapshot.route";
import {
	getDevicesWithSnapshotsHandler,
	ZGetDevicesWithSnapshotsSchema,
} from "./getDevicesWithSnapshots.route";
import { getImageHandler, ZGetImageSchema } from "./getImage.route";
import {
	getLatestByDeviceHandler,
	ZGetLatestByDeviceSchema,
} from "./getLatestByDevice.route";
import {
	getTimelineSnapshotsHandler,
	ZGetTimelineSnapshotsSchema,
} from "./getTimelineSnapshots.route";
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
	listSnapshots: permissionProtectedProcedure("security.list")
		.input(ZListSnapshotsSchema)
		.query(listSnapshotsHandler),

	getLatestByDevice: permissionProtectedProcedure("security.list")
		.input(ZGetLatestByDeviceSchema)
		.query(getLatestByDeviceHandler),

	getDevicesWithSnapshots: permissionProtectedProcedure("security.list")
		.input(ZGetDevicesWithSnapshotsSchema)
		.query(getDevicesWithSnapshotsHandler),

	getTimelineSnapshots: permissionProtectedProcedure("security.list")
		.input(ZGetTimelineSnapshotsSchema)
		.query(getTimelineSnapshotsHandler),

	getImage: permissionProtectedProcedure("security.list")
		.input(ZGetImageSchema)
		.query(getImageHandler),

	deleteSnapshot: permissionProtectedProcedure("security.delete")
		.input(ZDeleteSnapshotSchema)
		.mutation(deleteSnapshotHandler),
});
