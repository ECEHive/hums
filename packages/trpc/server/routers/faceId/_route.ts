import {
	kioskProtectedProcedure,
	protectedProcedure,
	router,
} from "../../trpc";
import {
	deleteEnrollmentHandler,
	ZDeleteEnrollmentSchema,
} from "./deleteEnrollment.route";
import { enrollHandler, ZEnrollSchema } from "./enroll.route";
import {
	getEnrolledFacesHandler,
	ZGetEnrolledFacesSchema,
} from "./getEnrolledFaces.route";
import { getMyEnrollmentHandler } from "./getMyEnrollment.route";
import {
	kioskDeleteEnrollmentHandler,
	ZKioskDeleteEnrollmentSchema,
} from "./kioskDeleteEnrollment.route";
import { matchFaceHandler, ZMatchFaceSchema } from "./matchFace.route";
import {
	verifyCardForEnrollmentHandler,
	ZVerifyCardForEnrollmentSchema,
} from "./verifyCardForEnrollment.route";

export const faceIdRouter = router({
	// Kiosk endpoints for Face ID
	verifyCardForEnrollment: kioskProtectedProcedure
		.input(ZVerifyCardForEnrollmentSchema)
		.mutation(verifyCardForEnrollmentHandler),

	enroll: kioskProtectedProcedure.input(ZEnrollSchema).mutation(enrollHandler),

	getEnrolledFaces: kioskProtectedProcedure
		.input(ZGetEnrolledFacesSchema)
		.query(getEnrolledFacesHandler),

	// Match a face descriptor against enrolled faces (server-side matching)
	matchFace: kioskProtectedProcedure
		.input(ZMatchFaceSchema)
		.mutation(matchFaceHandler),

	// Kiosk endpoint to delete enrollment (for re-enrollment flow)
	kioskDeleteEnrollment: kioskProtectedProcedure
		.input(ZKioskDeleteEnrollmentSchema)
		.mutation(kioskDeleteEnrollmentHandler),

	// User endpoint to check their own enrollment status
	getMyEnrollment: protectedProcedure.query(getMyEnrollmentHandler),

	// User endpoint to delete their own enrollment
	deleteEnrollment: protectedProcedure
		.input(ZDeleteEnrollmentSchema)
		.mutation(deleteEnrollmentHandler),
});
