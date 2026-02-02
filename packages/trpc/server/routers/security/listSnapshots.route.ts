import { prisma } from "@ecehive/prisma";
import z from "zod";
import type { TPermissionProtectedProcedureContext } from "../../trpc";

export const ZListSnapshotsSchema = z.object({
	// Pagination
	page: z.number().min(1).default(1),
	pageSize: z.number().min(1).max(100).default(20),
	// Filters
	deviceId: z.number().optional(),
	userId: z.number().optional(),
	userSearch: z.string().optional(),
	eventType: z.enum(["TAP", "PRESENCE"]).optional(),
	startDate: z.date().optional(),
	endDate: z.date().optional(),
	faceDetected: z.boolean().optional(),
});

export type TListSnapshotsOptions = {
	ctx: TPermissionProtectedProcedureContext;
	input: z.infer<typeof ZListSnapshotsSchema>;
};

export async function listSnapshotsHandler(options: TListSnapshotsOptions) {
	const { input } = options;
	const {
		page,
		pageSize,
		deviceId,
		userId,
		userSearch,
		eventType,
		startDate,
		endDate,
		faceDetected,
	} = input;

	const where = {
		...(deviceId !== undefined && { deviceId }),
		...(userId !== undefined && { userId }),
		...(userSearch && {
			user: {
				OR: [
					{ name: { contains: userSearch, mode: "insensitive" as const } },
					{ username: { contains: userSearch, mode: "insensitive" as const } },
				],
			},
		}),
		...(eventType !== undefined && { eventType }),
		...(faceDetected !== undefined && { faceDetected }),
		...(startDate || endDate
			? {
					capturedAt: {
						...(startDate && { gte: startDate }),
						...(endDate && { lte: endDate }),
					},
				}
			: {}),
	};

	const [snapshots, totalCount] = await Promise.all([
		prisma.securitySnapshot.findMany({
			where,
			orderBy: { capturedAt: "desc" },
			skip: (page - 1) * pageSize,
			take: pageSize,
			select: {
				id: true,
				eventType: true,
				capturedAt: true,
				faceDetected: true,
				faceConfidence: true,
				device: {
					select: {
						id: true,
						name: true,
					},
				},
				user: {
					select: {
						id: true,
						name: true,
						username: true,
					},
				},
			},
		}),
		prisma.securitySnapshot.count({ where }),
	]);

	return {
		snapshots,
		pagination: {
			page,
			pageSize,
			totalCount,
			totalPages: Math.ceil(totalCount / pageSize),
		},
	};
}
