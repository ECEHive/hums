/**
 * Control Kiosk Router
 *
 * This router provides endpoints for the control kiosk application,
 * allowing users to tap their cards and control equipment they have permissions for.
 */

import { controlProtectedProcedure, router } from "../../trpc";
import {
	checkUserPermissionsHandler,
	ZCheckUserPermissionsSchema,
} from "./checkUserPermissions.route";
import {
	getControlPointsHandler,
	ZGetControlPointsSchema,
} from "./getControlPoints.route";
import { kioskOperateHandler, ZKioskOperateSchema } from "./operate.route";
import {
	controlTapInOutHandler,
	ZControlTapInOutSchema,
} from "./tapInOut.route";

export const controlKioskRouter = router({
	// Get control points available on this device
	getControlPoints: controlProtectedProcedure
		.input(ZGetControlPointsSchema)
		.query(getControlPointsHandler),

	// Check what control points a user can operate
	checkUserPermissions: controlProtectedProcedure
		.input(ZCheckUserPermissionsSchema)
		.query(checkUserPermissionsHandler),

	// Operate a control point as a user
	operate: controlProtectedProcedure
		.input(ZKioskOperateSchema)
		.mutation(kioskOperateHandler),

	// Tap in/out for session management
	tapInOut: controlProtectedProcedure
		.input(ZControlTapInOutSchema)
		.mutation(controlTapInOutHandler),
});
